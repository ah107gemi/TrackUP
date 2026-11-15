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

/**
 * Generates an RFC 4122 compliant UUID v4 string
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates whether a given string is a valid UUID
 */
export function isValidUUID(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * Resolves the authenticated user ID strictly from the active Supabase session
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id && isValidUUID(authData.user.id)) {
      return authData.user.id;
    }
  } catch {
    // network or test environment fallback
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const sid = sessionData?.session?.user?.id;
    if (sid && isValidUUID(sid)) {
      return sid;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Loads custom lists from localStorage, auto-healing any legacy non-UUID string IDs
 */
export function getStoredCustomLists(): CustomList[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CUSTOM_LISTS_KEY);
    if (!raw) return [];
    const parsed: CustomList[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let hasMigrated = false;
    const sanitized = parsed.map((list) => {
      let currentList = { ...list };
      // Heal non-UUID list IDs (e.g. legacy list_123 strings)
      if (!isValidUUID(currentList.id)) {
        currentList.id = generateUUID();
        hasMigrated = true;
      }
      if (Array.isArray(currentList.items)) {
        currentList.items = currentList.items.map((item) => {
          let currentItem = { ...item };
          if (!isValidUUID(currentItem.id)) {
            currentItem.id = generateUUID();
            hasMigrated = true;
          }
          if (currentItem.list_id !== currentList.id) {
            currentItem.list_id = currentList.id;
            hasMigrated = true;
          }
          return currentItem;
        });
      }
      return currentList;
    });

    if (hasMigrated) {
      saveStoredCustomLists(sanitized);
    }
    return sanitized;
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
  const sessionUserId = await getAuthenticatedUserId();
  const effectiveUserId = isValidUUID(userId) ? userId : sessionUserId;

  // 1. Try Supabase query if we have a valid UUID to query for
  if (effectiveUserId && supabase) {
    try {
      const { data: dbLists, error: listErr } = await (supabase as any)
        .from('custom_lists')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: true });

      if (!listErr && Array.isArray(dbLists)) {
        if (dbLists.length > 0) {
          const listIds = dbLists.map((l: any) => l.id);
          const { data: dbItems, error: itemsErr } = await (supabase as any)
            .from('list_items')
            .select('*')
            .in('list_id', listIds)
            .order('created_at', { ascending: true });

          const stored = getStoredCustomLists();

          const hydratedLists: CustomList[] = await Promise.all(
            dbLists.map(async (l: any) => {
              const localList = stored.find((sl) => sl.id === l.id);
              const localItems = localList?.items || [];
              const rawDbItems = (!itemsErr && dbItems) ? dbItems.filter((i: any) => i.list_id === l.id) : [];

              // Merge items: start with Supabase items, keep any local items not yet in DB
              const mergedRawItems = [...rawDbItems];
              if (localItems.length > 0) {
                for (const li of localItems) {
                  const alreadyPresent = mergedRawItems.some(
                    (di: any) => (di.title_id || di.media_id) === (li.title_id || li.id)
                  );
                  if (!alreadyPresent) {
                    mergedRawItems.push({
                      id: li.id,
                      list_id: l.id,
                      title_id: li.title_id,
                      media_id: li.title_id,
                      notes: li.notes,
                      display_order: li.display_order ?? 0,
                      created_at: li.created_at,
                      media_type: li.title?.media_type,
                    });
                  }
                }
              }

              const items: CustomListItem[] = await Promise.all(
                mergedRawItems.map(async (i: any) => {
                  const itemTitleId = i.title_id || i.media_id;
                  let title = resolveLocalTitle(itemTitleId);
                  if (!title) {
                    try {
                      title = await getCatalogTitleById(itemTitleId);
                    } catch {
                      // ignore
                    }
                  }
                  if (!title) {
                    title = {
                      id: itemTitleId,
                      title: itemTitleId.replace(/^[^_]+_/, '').replace(/_/g, ' '),
                      media_type: (i.media_type as MediaType) || inferMediaTypeFromId(itemTitleId),
                      genres: [],
                    };
                  }
                  return {
                    id: i.id,
                    list_id: i.list_id,
                    title_id: itemTitleId,
                    notes: i.notes,
                    display_order: i.display_order ?? 0,
                    created_at: i.created_at,
                    title,
                  };
                })
              );

              return {
                id: l.id,
                user_id: l.user_id,
                name: l.name || l.list_name || 'Untitled List',
                description: l.description,
                is_private: Boolean(l.is_private),
                created_at: l.created_at,
                updated_at: l.updated_at,
                items,
              };
            })
          );

          // Cache locally, preserving lists from other users
          const existing = stored.filter(
            (sl) => sl.user_id !== effectiveUserId && (!userId || sl.user_id !== userId)
          );
          saveStoredCustomLists([...existing, ...hydratedLists]);
          return hydratedLists;
        } else {
          // Supabase returned 0 lists. Check if localStorage has unsynced lists for this user
          const stored = getStoredCustomLists();
          const localUserLists = stored.filter(
            (sl) => (effectiveUserId && sl.user_id === effectiveUserId) || (userId && sl.user_id === userId)
          );
          if (localUserLists.length > 0) {
            return localUserLists;
          }
        }
      }
    } catch {
      // fallback to localStorage
    }
  }

  // 2. LocalStorage Fallback
  const stored = getStoredCustomLists();
  let userLists = stored.filter(
    (l) => (userId && l.user_id === userId) || (effectiveUserId && l.user_id === effectiveUserId)
  );

  // If no lists exist yet for this user, generate a welcoming starter list with a strict UUID v4
  if (userLists.length === 0) {
    const starterId = generateUUID();
    const now = new Date().toISOString();
    const starterList: CustomList = {
      id: starterId,
      user_id: effectiveUserId || userId || 'local_tracker',
      name: 'All-Time Masterpieces',
      description: 'Curated list of favorite shows, films, anime, and manga.',
      is_private: false,
      created_at: now,
      updated_at: now,
      items: [],
    };
    userLists = [starterList];
    saveStoredCustomLists([...stored, starterList]);

    // If an authenticated session is active, sync the starter list to Supabase
    if (sessionUserId && supabase) {
      try {
        await (supabase as any).from('custom_lists').insert({
          id: starterId,
          user_id: sessionUserId,
          name: starterList.name,
          list_name: starterList.name,
          description: starterList.description,
          is_private: false,
        });
      } catch {
        // ignore offline / non-blocking sync error
      }
    }
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
  const sessionUserId = await getAuthenticatedUserId();
  const effectiveUserId = sessionUserId || (isValidUUID(userId) ? userId : userId);
  const listUuid = generateUUID();
  const now = new Date().toISOString();

  const newList: CustomList = {
    id: listUuid,
    user_id: effectiveUserId,
    name: name.trim(),
    description: description ? description.trim() : null,
    is_private: isPrivate,
    created_at: now,
    updated_at: now,
    items: [],
  };

  // 1. Try Supabase when authenticated session is present
  if (sessionUserId && supabase) {
    try {
      const payload: Record<string, any> = {
        id: listUuid,
        user_id: sessionUserId,
        name: name.trim(),
        list_name: name.trim(),
        description: description ? description.trim() : null,
        is_private: isPrivate,
      };

      const { data, error } = await (supabase as any)
        .from('custom_lists')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('[customListsService] custom_lists insert failed:', error);
        throw new Error(error.message || 'Failed to create custom list in Supabase.');
      }

      if (data?.id) {
        newList.id = data.id;
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch failed') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }
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
  const sessionUserId = await getAuthenticatedUserId();

  // 1. Try Supabase
  if (sessionUserId && isValidUUID(listId) && supabase) {
    try {
      const updatePayload: Record<string, any> = {
        updated_at: now,
      };
      if (updates.name !== undefined) {
        updatePayload.name = updates.name.trim();
        updatePayload.list_name = updates.name.trim();
      }
      if (updates.description !== undefined) {
        updatePayload.description = updates.description ? updates.description.trim() : null;
      }
      if (updates.is_private !== undefined) {
        updatePayload.is_private = updates.is_private;
      }

      const { error } = await (supabase as any)
        .from('custom_lists')
        .update(updatePayload)
        .eq('id', listId)
        .eq('user_id', sessionUserId);

      if (error) {
        console.error('[customListsService] custom_lists update failed:', error);
        throw new Error(error.message || 'Failed to update custom list in Supabase.');
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch failed') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }
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

  if (!updatedList) {
    updatedList = {
      id: listId,
      user_id: sessionUserId || '',
      name: updates.name || 'Untitled List',
      description: updates.description || null,
      is_private: Boolean(updates.is_private),
      created_at: now,
      updated_at: now,
      items: [],
    };
    nextStored.push(updatedList);
  }

  saveStoredCustomLists(nextStored);
  return updatedList;
}

/**
 * Deletes a custom list and its associated items
 */
export async function deleteCustomList(listId: string): Promise<boolean> {
  const sessionUserId = await getAuthenticatedUserId();

  // 1. Try Supabase
  if (sessionUserId && isValidUUID(listId) && supabase) {
    try {
      const { error } = await (supabase as any)
        .from('custom_lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', sessionUserId);

      if (error) {
        console.error('[customListsService] custom_lists delete failed:', error);
        throw new Error(error.message || 'Failed to delete custom list from Supabase.');
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch failed') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }
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
  let targetList = stored.find((l) => l.id === listId);

  // If list not found by exact ID, check if it had a legacy non-UUID prefix or match
  if (!targetList && !isValidUUID(listId)) {
    targetList = stored.find((l) => l.id.startsWith('list_') || l.id === listId);
  }

  // Ensure target list ID is a valid UUID v4
  let effectiveListId = targetList?.id || listId;
  if (!isValidUUID(effectiveListId)) {
    const freshUuid = generateUUID();
    if (targetList) {
      targetList.id = freshUuid;
      if (targetList.items) {
        targetList.items.forEach((item) => {
          item.list_id = freshUuid;
        });
      }
      saveStoredCustomLists(stored);
    }
    effectiveListId = freshUuid;
  }

  const existingItem = targetList?.items?.find((i) => i.title_id === titleId);
  if (existingItem) {
    return existingItem;
  }

  const itemUuid = generateUUID();
  const now = new Date().toISOString();
  const displayOrder = targetList?.items?.length || 0;

  const newItem: CustomListItem = {
    id: itemUuid,
    list_id: effectiveListId,
    title_id: titleId,
    notes: notes ? notes.trim() : null,
    display_order: displayOrder,
    created_at: now,
    title: titleObj,
  };

  const sessionUserId = await getAuthenticatedUserId();

  // 1. Try Supabase with strictly verified auth session user_id and UUIDs
  if (sessionUserId && supabase && isValidUUID(effectiveListId)) {
    try {
      // Step A: Ensure parent list exists in Supabase under sessionUserId
      const { data: parentCheck, error: parentCheckErr } = await (supabase as any)
        .from('custom_lists')
        .select('id')
        .eq('id', effectiveListId)
        .maybeSingle();

      if (!parentCheck && !parentCheckErr) {
        // Sync parent custom list to Supabase so foreign key & RLS on list_items succeed
        const parentName = targetList?.name || 'Custom List';
        const parentDesc = targetList?.description || null;
        const parentPrivate = Boolean(targetList?.is_private);

        const { error: insertParentErr } = await (supabase as any)
          .from('custom_lists')
          .insert({
            id: effectiveListId,
            user_id: sessionUserId,
            name: parentName,
            list_name: parentName,
            description: parentDesc,
            is_private: parentPrivate,
          });

        if (insertParentErr && !insertParentErr.message?.includes('duplicate key') && insertParentErr.code !== '23505') {
          console.error('[customListsService] Failed to auto-sync parent list to Supabase:', insertParentErr);
          throw new Error(insertParentErr.message || 'Parent custom list could not be verified in Supabase.');
        }
      }

      // Step B: Insert list_item strictly with sessionUserId and valid UUIDs
      const payload: Record<string, any> = {
        id: itemUuid,
        list_id: effectiveListId,
        user_id: sessionUserId,
        media_id: titleId,
        title_id: titleId,
        media_type: titleObj.media_type || inferMediaTypeFromId(titleId),
        notes: notes ? notes.trim() : null,
        display_order: displayOrder,
      };

      const { data, error } = await (supabase as any)
        .from('list_items')
        .insert(payload)
        .select()
        .single();

      if (error && !error.message?.includes('duplicate key') && error.code !== '23505') {
        console.error('[customListsService] Supabase list_items insert failed:', error);
        throw new Error(error.message || 'Supabase rejected list_items insert (RLS policy or schema violation).');
      }

      if (data?.id) {
        newItem.id = data.id;
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch failed') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }
  }

  // 2. Update localStorage: prioritize saving even if targetList was absent from empty localStorage
  const existsInStored = stored.some((l) => l.id === effectiveListId || (targetList && l.id === targetList.id));
  let nextStored: CustomList[];

  if (existsInStored) {
    nextStored = stored.map((l) => {
      if (l.id === effectiveListId || (targetList && l.id === targetList.id)) {
        const itemExists = (l.items || []).some((i) => i.title_id === titleId);
        return {
          ...l,
          id: effectiveListId,
          updated_at: now,
          items: itemExists ? l.items : [...(l.items || []), newItem],
        };
      }
      return l;
    });
  } else {
    const listName = targetList?.name || 'Custom List';
    const newList: CustomList = {
      id: effectiveListId,
      user_id: sessionUserId || (isValidUUID(targetList?.user_id) ? targetList!.user_id : ''),
      name: listName,
      description: targetList?.description || null,
      is_private: Boolean(targetList?.is_private),
      created_at: now,
      updated_at: now,
      items: [newItem],
    };
    nextStored = [...stored, newList];
  }

  saveStoredCustomLists(nextStored);
  return newItem;
}

/**
 * Removes a title from a custom list
 */
export async function removeTitleFromList(listId: string, titleId: string): Promise<boolean> {
  const sessionUserId = await getAuthenticatedUserId();
  const stored = getStoredCustomLists();
  const targetList = stored.find((l) => l.id === listId);
  const effectiveListId = targetList?.id || listId;

  // 1. Try Supabase
  if (sessionUserId && isValidUUID(effectiveListId) && supabase) {
    try {
      const { error } = await (supabase as any)
        .from('list_items')
        .delete()
        .eq('list_id', effectiveListId)
        .or(`title_id.eq.${titleId},media_id.eq.${titleId}`);

      if (error) {
        console.error('[customListsService] Supabase list_items delete failed:', error);
        throw new Error(error.message || 'Supabase rejected list_items delete (RLS policy violation).');
      }
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch failed') && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }
  }

  // 2. Update localStorage
  const nextStored = stored.map((l) => {
    if (l.id === effectiveListId || l.id === listId) {
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
