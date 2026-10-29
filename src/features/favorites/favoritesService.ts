import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';
import { MOCK_CATALOG_FIXTURES, getCatalogTitleById } from '../catalog/catalogService';

export interface FavoriteItem {
  id: string;
  user_id: string;
  title_id: string;
  display_order: number;
  created_at: string;
  title: NormalizedCatalogItem;
}

export type FavoriteCategory = 'tv' | 'movie' | 'anime' | 'reading';

const LOCAL_STORAGE_FAVORITES_KEY = 'trackup_favorites';
const LOCAL_STORAGE_LIBRARIES_KEY = 'trackup_user_libraries';

export function getStoredFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredFavorites(favs: FavoriteItem[]): void {
  localStorage.setItem(LOCAL_STORAGE_FAVORITES_KEY, JSON.stringify(favs));
}

/**
 * Resolves full title metadata from library storage or catalog fixtures
 */
function resolveLocalTitle(titleId: string): NormalizedCatalogItem | null {
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

export async function fetchUserFavorites(userId: string): Promise<FavoriteItem[]> {
  const all = getStoredFavorites();
  const userFavs = all.filter((f) => f.user_id === userId);
  let needsSave = false;

  // Auto-heal broken / incomplete favorite entries (e.g. Unknown Title, missing poster, wrong media_type)
  for (const fav of userFavs) {
    const isBroken =
      !fav.title ||
      fav.title.title === 'Unknown Title' ||
      !fav.title.poster_url ||
      fav.title.poster_url === '/assets/trackup-logo.jpg' ||
      (fav.title.media_type === 'movie' &&
        (fav.title_id.includes('tv_') ||
          fav.title_id.includes('anime_') ||
          fav.title_id.includes('manga_') ||
          fav.title_id.includes('manhwa_')));

    if (isBroken) {
      let resolved = resolveLocalTitle(fav.title_id);
      if (!resolved) {
        try {
          const live = await getCatalogTitleById(fav.title_id);
          if (live && live.title !== 'Unknown Title') {
            resolved = live;
          }
        } catch {
          // ignore network failure
        }
      }

      if (resolved) {
        fav.title = resolved;
        needsSave = true;
      }
    }
  }

  if (needsSave) {
    saveStoredFavorites(all);
  }

  return userFavs.sort((a, b) => a.display_order - b.display_order);
}

export function isTitleFavorite(userId: string, titleId: string): boolean {
  const all = getStoredFavorites();
  return all.some((f) => f.user_id === userId && f.title_id === titleId);
}

export async function toggleFavorite(
  userId: string,
  titleId: string,
  titlePayload?: NormalizedCatalogItem
): Promise<boolean> {
  const all = getStoredFavorites();
  const existingIndex = all.findIndex((f) => f.user_id === userId && f.title_id === titleId);

  if (existingIndex >= 0) {
    // Remove favorite
    all.splice(existingIndex, 1);
    saveStoredFavorites(all);
    return false;
  }

  // Determine full normalized metadata
  let matchedTitle: NormalizedCatalogItem | null = null;

  if (titlePayload && titlePayload.title && titlePayload.title !== 'Unknown Title') {
    matchedTitle = titlePayload;
  } else {
    matchedTitle = resolveLocalTitle(titleId);
    if (!matchedTitle) {
      try {
        const live = await getCatalogTitleById(titleId);
        if (live && live.title !== 'Unknown Title') {
          matchedTitle = live;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!matchedTitle) {
    const inferredType = inferMediaTypeFromId(titleId);
    matchedTitle = {
      id: titleId,
      media_type: inferredType,
      title: titleId.replace(/^[a-z]+_/i, '').replace(/_/g, ' '),
      genres: [],
      poster_url: null,
      origin_country: inferredType === 'manhwa' ? 'KR' : inferredType === 'anime_series' || inferredType === 'manga' ? 'JP' : 'US',
    };
  }

  const newFav: FavoriteItem = {
    id: `fav_${Math.random().toString(36).substring(2, 10)}`,
    user_id: userId,
    title_id: titleId,
    display_order: all.filter((f) => f.user_id === userId).length,
    created_at: new Date().toISOString(),
    title: matchedTitle,
  };

  all.push(newFav);
  saveStoredFavorites(all);
  return true;
}

export async function removeFavorite(userId: string, titleId: string): Promise<void> {
  const all = getStoredFavorites();
  const updated = all.filter((f) => !(f.user_id === userId && f.title_id === titleId));
  saveStoredFavorites(updated);
}

/**
 * Strictly filters a list of FavoriteItems by dedicated category
 */
export function filterFavoritesByCategory(
  favorites: FavoriteItem[],
  category: FavoriteCategory
): FavoriteItem[] {
  return favorites.filter((f) => {
    const type = f.title?.media_type;
    if (category === 'tv') return type === 'tv';
    if (category === 'movie') return type === 'movie';
    if (category === 'anime') return type === 'anime_series' || type === 'anime_film';
    if (category === 'reading') return type === 'manga' || type === 'manhwa';
    return false;
  });
}
