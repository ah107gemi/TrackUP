import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';
import { supabase } from '../../lib/supabase';
import { MOCK_CATALOG_FIXTURES, getCatalogTitleById } from '../catalog/catalogService';

export interface CustomListItem {
  id: string;
  list_id: string;
  title_id: string;
  notes?: string | null;
  display_order: number;
  created_at: string;
  title: NormalizedCatalogItem;
}

export interface CustomList {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  items: CustomListItem[];
}

const LOCAL_STORAGE_CUSTOM_LISTS_KEY = 'trackup_custom_lists';
const LOCAL_STORAGE_LIBRARIES_KEY = 'trackup_user_libraries';

export function getStoredCustomLists(): CustomList[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CUSTOM_LISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredCustomLists(lists: CustomList[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_LISTS_KEY, JSON.stringify(lists));
  } catch {
    // ignore
  }
}

/**
 * Resolves full title metadata from library storage or catalog fixtures
 */
export function resolveLocalTitle(titleId: string): NormalizedCatalogItem | null {
  // 1. Check curated fixtures
  const fixtureMatch = MOCK_CATALOG_FIXTURES.find((t) => t.id === titleId);
  if (fixtureMatch && fixtureMatch.title !== 'Unknown Title') {
    return fixtureMatch;
  }

  // 2. Check local user libraries
  try {
    const rawLib = localStorage.getItem(LOCAL_STORAGE_LIBRARIES_KEY);
    if (rawLib) {
      const lib = JSON.parse(rawLib);
      const match = lib.find((i: any) => i.title_id === titleId || i.id === titleId);
      if (match?.title && match.title.title !== 'Unknown Title') {
        return match.title;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Infers an appropriate fallback media_type from an ID string
 */
function inferMediaTypeFromId(id: string): MediaType {
  const lower = id.toLowerCase();
  if (lower.startsWith('tmdb_tv_') || lower.startsWith('tv_')) return 'tv';
  if (lower.startsWith('manhwa_') || lower.includes('_manhwa_') || lower.includes('solo_leveling')) return 'manhwa';
  if (lower.startsWith('manga_') || lower.includes('_manga_') || lower.includes('berserk')) return 'manga';
  if (lower.startsWith('anime_') || lower.includes('_anime_') || lower.startsWith('anilist_')) return 'anime_series';
  return 'movie';
}

/**
 * Fetches all custom lists for a user, including their items with hydrated titles
 */
export async function fetchUserCustomLists(userId: string): Promise<CustomList[]> {
  try {
    // 1. Try Supabase query
    const { data: dbLists, error: listErr } = await (supabase as any)
      .from('custom_lists')
      .select('id, user_id, name, description, is_private, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!listErr && dbLists && dbLists.length > 0) {
      const listIds = dbLists.map((l: any) => l.id);
      const { data: dbItems } = await (supabase as any)
        .from('list_items')
        .select('id, list_id, title_id, notes, display_order, created_at')
        .in('list_id', listIds)
        .order('display_order', { ascending: true });

      const hydratedLists: CustomList[] = await Promise.all(
        dbLists.map(async (l: any) => {
          const rawItems = (dbItems || []).filter((i: any) => i.list_id === l.id);
          const items: CustomListItem[] = await Promise.all(
            rawItems.map(async (i: any) => {
              let title = resolveLocalTitle(i.title_id);
              if (!title) {
                try {
                  title = await getCatalogTitleById(i.title_id);
                } catch {
                  // ignore
                }
              }
              if (!title) {
                title = {
                  id: i.title_id,
                  title: i.title_id.replace(/^[^_]+_/, '').replace(/_/g, ' '),
                  media_type: inferMediaTypeFromId(i.title_id),
                  genres: [],
                };
              }
              return {
                id: i.id,
                list_id: i.list_id,
                title_id: i.title_id,
                notes: i.notes,
                display_order: i.display_order,
                created_at: i.created_at,
                title,
              };
            })
          );

          return {
            id: l.id,
            user_id: l.user_id,
            name: l.name,
            description: l.description,
            is_private: Boolean(l.is_private),
            created_at: l.created_at,
            updated_at: l.updated_at,
            items,
          };
        })
      );

      // Cache locally
      const existing = getStoredCustomLists().filter((l) => l.user_id !== userId);
      saveStoredCustomLists([...existing, ...hydratedLists]);
      return hydratedLists;
    }
  } catch {
    // fallback to localStorage
  }

  // 2. LocalStorage Fallback
  const stored = getStoredCustomLists();
  let userLists = stored.filter((l) => l.user_id === userId);

  // If no lists exist yet for this user, generate a welcoming starter list
  if (userLists.length === 0) {
    const starterList: CustomList = {
      id: `list_${Date.now()}_starter`,
      user_id: userId,
      name: 'All-Time Masterpieces',
      description: 'Curated list of favorite shows, films, anime, and manga.',
      is_private: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [],
    };
    userLists = [starterList];
    saveStoredCustomLists([...stored, starterList]);
  }

  // Ensure title hydration
  return userLists.map((l) => ({
    ...l,
    items: (l.items || []).map((i) => {
      let title = i.title || resolveLocalTitle(i.title_id);
      if (!title) {
        title = {
          id: i.title_id,
          title: i.title_id.replace(/^[^_]+_/, '').replace(/_/g, ' '),
          media_type: inferMediaTypeFromId(i.title_id),
          genres: [],
        };
      }
      return {
        ...i,
        title,
      };
    }),
  }));
}

/**
 * Creates a new custom list
 */
export async function createCustomList(
  userId: string,
  name: string,
  description?: string,
  isPrivate: boolean = false
): Promise<CustomList> {
  const newListId = `list_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newList: CustomList = {
    id: newListId,
    user_id: userId,
    name: name.trim(),
    description: description ? description.trim() : null,
    is_private: isPrivate,
    created_at: now,
    updated_at: now,
    items: [],
  };

  // 1. Try Supabase
  try {
    const { data, error } = await (supabase as any)
      .from('custom_lists')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description ? description.trim() : null,
        is_private: isPrivate,
      })
      .select()
      .single();

    if (!error && data) {
      newList.id = data.id;
    }
  } catch {
    // continue with local list
  }

  // 2. Save to localStorage
  const stored = getStoredCustomLists();
  saveStoredCustomLists([...stored, newList]);

  return newList;
}

/**
 * Updates an existing custom list (name, description, is_private)
 */
export async function updateCustomList(
  listId: string,
  updates: { name?: string; description?: string; is_private?: boolean }
): Promise<CustomList> {
  const now = new Date().toISOString();

  // 1. Try Supabase
  try {
    await (supabase as any)
      .from('custom_lists')
      .update({
        ...updates,
        updated_at: now,
      })
      .eq('id', listId);
  } catch {
    // ignore
  }

  // 2. Update localStorage
  const stored = getStoredCustomLists();
  let updatedList: CustomList | null = null;

  const nextStored = stored.map((l) => {
    if (l.id === listId) {
      updatedList = {
        ...l,
        ...updates,
        updated_at: now,
      };
      return updatedList;
    }
    return l;
  });

  saveStoredCustomLists(nextStored);

  if (!updatedList) {
    throw new Error(`Custom list with id "${listId}" not found.`);
  }

  return updatedList;
}

/**
 * Deletes a custom list and its associated items
 */
export async function deleteCustomList(listId: string): Promise<boolean> {
  // 1. Try Supabase
  try {
    await (supabase as any).from('custom_lists').delete().eq('id', listId);
  } catch {
    // ignore
  }

  // 2. Update localStorage
  const stored = getStoredCustomLists();
  const nextStored = stored.filter((l) => l.id !== listId);
  saveStoredCustomLists(nextStored);

  return true;
}

/**
 * Adds a media title (any media type) to a custom list
 */
export async function addTitleToList(
  listId: string,
  titleOrId: NormalizedCatalogItem | string,
  notes?: string
): Promise<CustomListItem> {
  let titleObj: NormalizedCatalogItem;
  let titleId: string;

  if (typeof titleOrId === 'string') {
    titleId = titleOrId;
    const resolved = resolveLocalTitle(titleId);
    titleObj = resolved || {
      id: titleId,
      title: titleId.replace(/^[^_]+_/, '').replace(/_/g, ' '),
      media_type: inferMediaTypeFromId(titleId),
      genres: [],
    };
  } else {
    titleId = titleOrId.id;
    titleObj = titleOrId;
  }

  const stored = getStoredCustomLists();
  const targetList = stored.find((l) => l.id === listId);

  const existingItem = targetList?.items?.find((i) => i.title_id === titleId);
  if (existingItem) {
    return existingItem;
  }

  const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const displayOrder = (targetList?.items?.length || 0);

  const newItem: CustomListItem = {
    id: itemId,
    list_id: listId,
    title_id: titleId,
    notes: notes ? notes.trim() : null,
    display_order: displayOrder,
    created_at: now,
    title: titleObj,
  };

  // 1. Try Supabase
  try {
    const { data, error } = await (supabase as any)
      .from('list_items')
      .insert({
        list_id: listId,
        title_id: titleId,
        notes: notes ? notes.trim() : null,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (!error && data) {
      newItem.id = data.id;
    }
  } catch {
    // continue
  }

  // 2. Update localStorage
  const nextStored = stored.map((l) => {
    if (l.id === listId) {
      return {
        ...l,
        updated_at: now,
        items: [...(l.items || []), newItem],
      };
    }
    return l;
  });

  saveStoredCustomLists(nextStored);
  return newItem;
}

/**
 * Removes a title from a custom list
 */
export async function removeTitleFromList(listId: string, titleId: string): Promise<boolean> {
  // 1. Try Supabase
  try {
    await (supabase as any)
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('title_id', titleId);
  } catch {
    // ignore
  }

  // 2. Update localStorage
  const stored = getStoredCustomLists();
  const nextStored = stored.map((l) => {
    if (l.id === listId) {
      return {
        ...l,
        updated_at: new Date().toISOString(),
        items: (l.items || []).filter((i) => i.title_id !== titleId),
      };
    }
    return l;
  });

  saveStoredCustomLists(nextStored);
  return true;
}
