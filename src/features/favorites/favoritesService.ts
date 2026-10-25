import type { NormalizedCatalogItem } from '../../lib/validators';
import { MOCK_CATALOG_FIXTURES } from '../catalog/catalogService';

export interface FavoriteItem {
  id: string;
  user_id: string;
  title_id: string;
  display_order: number;
  created_at: string;
  title: NormalizedCatalogItem;
}

const LOCAL_STORAGE_FAVORITES_KEY = 'trackup_favorites';

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

export async function fetchUserFavorites(userId: string): Promise<FavoriteItem[]> {
  const all = getStoredFavorites();
  return all
    .filter((f) => f.user_id === userId)
    .sort((a, b) => a.display_order - b.display_order);
}

export function isTitleFavorite(userId: string, titleId: string): boolean {
  const all = getStoredFavorites();
  return all.some((f) => f.user_id === userId && f.title_id === titleId);
}

export async function toggleFavorite(userId: string, titleId: string): Promise<boolean> {
  const all = getStoredFavorites();
  const existingIndex = all.findIndex((f) => f.user_id === userId && f.title_id === titleId);

  if (existingIndex >= 0) {
    // Remove favorite
    all.splice(existingIndex, 1);
    saveStoredFavorites(all);
    return false;
  }

  // Find title details
  const matchedTitle = MOCK_CATALOG_FIXTURES.find((t) => t.id === titleId) || {
    id: titleId,
    media_type: 'movie',
    title: 'Unknown Title',
    genres: [],
  };

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
