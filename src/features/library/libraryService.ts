import type { TrackingStatus } from '../../types/database.types';
import type { NormalizedCatalogItem } from '../../lib/validators';
import { MOCK_CATALOG_FIXTURES, getCatalogTitleById } from '../catalog/catalogService';

export interface UserLibraryItem {
  id: string;
  user_id: string;
  title_id: string;
  status: TrackingStatus;
  rating: number | null;
  is_private: boolean;
  personal_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_progressed_at: string;
  // Progress states
  episodes_watched: string[]; // array of episode IDs
  last_chapter_read: number;
  last_volume_read: number;
  // Populated title details
  title: NormalizedCatalogItem;
}

const LOCAL_STORAGE_LIBRARIES_KEY = 'trackup_user_libraries';
const LOCAL_STORAGE_WATCH_HISTORY_KEY = 'trackup_watch_history';
const LOCAL_STORAGE_READING_HISTORY_KEY = 'trackup_reading_history';

export interface HistoryRecord {
  id: string;
  user_id: string;
  library_id: string;
  title_id: string;
  type: 'watch' | 'read';
  episode_id?: string;
  chapter_number?: number;
  volume_number?: number;
  timestamp: string;
}

export function getStoredLibraries(): UserLibraryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LIBRARIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredLibraries(items: UserLibraryItem[]): void {
  localStorage.setItem(LOCAL_STORAGE_LIBRARIES_KEY, JSON.stringify(items));
}

export function getStoredHistory(): HistoryRecord[] {
  try {
    const rawWatch = localStorage.getItem(LOCAL_STORAGE_WATCH_HISTORY_KEY);
    const rawRead = localStorage.getItem(LOCAL_STORAGE_READING_HISTORY_KEY);
    const watch: HistoryRecord[] = rawWatch ? JSON.parse(rawWatch) : [];
    const read: HistoryRecord[] = rawRead ? JSON.parse(rawRead) : [];
    return [...watch, ...read];
  } catch {
    return [];
  }
}

export async function fetchUserLibrary(userId: string): Promise<UserLibraryItem[]> {
  const all = getStoredLibraries();
  return all.filter((item) => item.user_id === userId);
}

export async function upsertLibraryItem(params: {
  userId: string;
  titleId: string;
  status?: TrackingStatus;
  rating?: number | null;
  isPrivate?: boolean;
  notes?: string | null;
  titleData?: NormalizedCatalogItem;
}): Promise<UserLibraryItem> {
  const all = getStoredLibraries();
  const existingIndex = all.findIndex(
    (item) => item.user_id === params.userId && item.title_id === params.titleId
  );
  const existing = existingIndex >= 0 ? all[existingIndex] : null;

  let resolvedTitle: NormalizedCatalogItem =
    params.titleData ||
    existing?.title ||
    MOCK_CATALOG_FIXTURES.find((t) => t.id === params.titleId) || {
      id: params.titleId,
      media_type: 'movie',
      title: 'Unknown Title',
      genres: [],
    };

  // If title is not yet hydrated and has a known provider prefix, attempt live lookup
  if (resolvedTitle.title === 'Unknown Title') {
    try {
      const fetched = await getCatalogTitleById(params.titleId);
      if (fetched) {
        resolvedTitle = fetched;
      }
    } catch {
      // retain fallback
    }
  }

  const now = new Date().toISOString();

  if (existingIndex >= 0 && existing) {
    const nextStatus = params.status !== undefined ? params.status : existing.status;
    const isCompleted = nextStatus === 'completed';
    const isEpisodic = existing.title.media_type === 'tv' || existing.title.media_type === 'anime_series';
    let episodesWatched = existing.episodes_watched || [];
    if (isCompleted && isEpisodic && episodesWatched.length === 0 && existing.title.total_episodes) {
      episodesWatched = Array.from({ length: existing.title.total_episodes }, (_, i) => `ep_${i + 1}`);
    }

    const updated: UserLibraryItem = {
      ...existing,
      status: nextStatus,
      rating: params.rating !== undefined ? params.rating : existing.rating,
      is_private: params.isPrivate !== undefined ? params.isPrivate : existing.is_private,
      personal_notes: params.notes !== undefined ? params.notes : existing.personal_notes,
      title: (params.titleData && params.titleData.title !== 'Unknown Title') ? params.titleData : existing.title,
      episodes_watched: episodesWatched,
      last_progressed_at: now,
    };
    all[existingIndex] = updated;
    saveStoredLibraries(all);
    return updated;
  }

  const isNewCompleted = (params.status || 'planned') === 'completed';
  const isNewEpisodic = resolvedTitle.media_type === 'tv' || resolvedTitle.media_type === 'anime_series';
  const initialEpisodes = (isNewCompleted && isNewEpisodic && resolvedTitle.total_episodes)
    ? Array.from({ length: resolvedTitle.total_episodes }, (_, i) => `ep_${i + 1}`)
    : [];

  const newItem: UserLibraryItem = {
    id: `lib_${Math.random().toString(36).substring(2, 11)}`,
    user_id: params.userId,
    title_id: params.titleId,
    status: params.status || 'planned',
    rating: params.rating || null,
    is_private: params.isPrivate || false,
    personal_notes: params.notes || null,
    started_at: params.status === 'active' ? now : null,
    completed_at: params.status === 'completed' ? now : null,
    last_progressed_at: now,
    episodes_watched: initialEpisodes,
    last_chapter_read: 0,
    last_volume_read: 0,
    title: resolvedTitle,
  };

  all.push(newItem);
  saveStoredLibraries(all);
  return newItem;
}

export async function logEpisodeProgress(params: {
  libraryId: string;
  userId: string;
  episodeId: string;
  watched: boolean;
}): Promise<UserLibraryItem> {
  const all = getStoredLibraries();
  const index = all.findIndex((item) => item.id === params.libraryId && item.user_id === params.userId);
  if (index < 0) throw new Error('Library entry not found');

  const item = all[index];
  const now = new Date().toISOString();
  let updatedEpisodes = [...item.episodes_watched];

  if (params.watched) {
    if (!updatedEpisodes.includes(params.episodeId)) {
      updatedEpisodes.push(params.episodeId);
    }
    // Append to watch history
    const history = JSON.parse(localStorage.getItem(LOCAL_STORAGE_WATCH_HISTORY_KEY) || '[]');
    history.push({
      id: `wh_${Math.random().toString(36).substring(2, 9)}`,
      user_id: params.userId,
      library_id: params.libraryId,
      title_id: item.title_id,
      type: 'watch',
      episode_id: params.episodeId,
      timestamp: now,
    });
    localStorage.setItem(LOCAL_STORAGE_WATCH_HISTORY_KEY, JSON.stringify(history));
  } else {
    updatedEpisodes = updatedEpisodes.filter((id) => id !== params.episodeId);
  }

  let nextStatus = item.status;
  if (params.watched && updatedEpisodes.length > 0) {
    if (!item.title.total_episodes || updatedEpisodes.length < item.title.total_episodes) {
      nextStatus = 'active';
    }
  }

  const updated: UserLibraryItem = {
    ...item,
    episodes_watched: updatedEpisodes,
    status: nextStatus,
    last_progressed_at: now,
  };

  all[index] = updated;
  saveStoredLibraries(all);
  return updated;
}

export async function logBatchEpisodeProgress(params: {
  libraryId: string;
  userId: string;
  episodeIds: string[];
  watched: boolean;
}): Promise<UserLibraryItem> {
  const all = getStoredLibraries();
  const index = all.findIndex((item) => item.id === params.libraryId && item.user_id === params.userId);
  if (index < 0) throw new Error('Library entry not found');

  const item = all[index];
  const now = new Date().toISOString();
  let updatedEpisodes = [...item.episodes_watched];

  if (params.watched) {
    params.episodeIds.forEach((epId) => {
      if (!updatedEpisodes.includes(epId)) {
        updatedEpisodes.push(epId);
      }
    });
    // Append to watch history
    const history = JSON.parse(localStorage.getItem(LOCAL_STORAGE_WATCH_HISTORY_KEY) || '[]');
    params.episodeIds.forEach((epId) => {
      history.push({
        id: `wh_${Math.random().toString(36).substring(2, 9)}`,
        user_id: params.userId,
        library_id: params.libraryId,
        title_id: item.title_id,
        type: 'watch',
        episode_id: epId,
        timestamp: now,
      });
    });
    localStorage.setItem(LOCAL_STORAGE_WATCH_HISTORY_KEY, JSON.stringify(history));
  } else {
    const toRemove = new Set(params.episodeIds);
    updatedEpisodes = updatedEpisodes.filter((id) => !toRemove.has(id));
  }

  let nextStatus = item.status;
  if (params.watched && updatedEpisodes.length > 0) {
    if (!item.title.total_episodes || updatedEpisodes.length < item.title.total_episodes) {
      nextStatus = 'active';
    }
  }

  const updated: UserLibraryItem = {
    ...item,
    episodes_watched: updatedEpisodes,
    status: nextStatus,
    last_progressed_at: now,
  };

  all[index] = updated;
  saveStoredLibraries(all);
  return updated;
}

export async function logReadingProgress(params: {
  libraryId: string;
  userId: string;
  chapter: number;
  volume?: number;
}): Promise<UserLibraryItem> {
  const all = getStoredLibraries();
  const index = all.findIndex((item) => item.id === params.libraryId && item.user_id === params.userId);
  if (index < 0) throw new Error('Library entry not found');

  const item = all[index];
  const now = new Date().toISOString();

  // Append to reading history
  const history = JSON.parse(localStorage.getItem(LOCAL_STORAGE_READING_HISTORY_KEY) || '[]');
  history.push({
    id: `rh_${Math.random().toString(36).substring(2, 9)}`,
    user_id: params.userId,
    library_id: params.libraryId,
    title_id: item.title_id,
    type: 'read',
    chapter_number: params.chapter,
    volume_number: params.volume || item.last_volume_read,
    timestamp: now,
  });
  localStorage.setItem(LOCAL_STORAGE_READING_HISTORY_KEY, JSON.stringify(history));

  let nextStatus = item.status;
  if (params.chapter > 0) {
    if (!item.title.total_chapters || params.chapter < item.title.total_chapters) {
      nextStatus = 'active';
    }
  }

  const updated: UserLibraryItem = {
    ...item,
    last_chapter_read: params.chapter,
    last_volume_read: params.volume !== undefined ? params.volume : item.last_volume_read,
    status: nextStatus,
    last_progressed_at: now,
  };

  all[index] = updated;
  saveStoredLibraries(all);
  return updated;
}

export async function clearUserLibrary(userId: string): Promise<number> {
  const all = getStoredLibraries();
  const remaining = all.filter((item) => item.user_id !== userId);
  const deletedCount = all.length - remaining.length;
  saveStoredLibraries(remaining);
  return deletedCount;
}

export async function clearImportedDummyTitles(userId: string): Promise<number> {
  const all = getStoredLibraries();
  const remaining = all.filter(
    (item) =>
      item.user_id !== userId ||
      (!item.title_id.startsWith('imported_') &&
        !item.title_id.startsWith('generic_') &&
        (item.title_id.startsWith('tmdb_') ||
          item.title_id.startsWith('anilist_') ||
          item.title_id.startsWith('movie_') ||
          item.title_id.startsWith('tv_') ||
          item.title_id.startsWith('anime_') ||
          item.title_id.startsWith('manga_') ||
          item.title_id.startsWith('manhwa_') ||
          item.title_id.startsWith('film_')))
  );
  const deletedCount = all.length - remaining.length;
  saveStoredLibraries(remaining);
  return deletedCount;
}
