import type { TrackingStatus } from '../../types/database.types';
import type { NormalizedCatalogItem } from '../../lib/validators';
import { MOCK_CATALOG_FIXTURES, getCatalogTitleById } from '../catalog/catalogService';
import { supabase } from '../../lib/supabase';

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
  let modified = false;

  for (const item of all) {
    if (
      item.title_id === 'tmdb_tv_73586' ||
      item.title?.title === 'Yellowstone' ||
      item.title?.id === 'tmdb_tv_73586'
    ) {
      if (
        !item.title.poster_url ||
        item.title.poster_url.includes('peNC0') ||
        item.title.poster_url === '/assets/trackup-logo.jpg'
      ) {
        item.title.poster_url = 'https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg';
        (item.title as any).poster_path = 'https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg';
        modified = true;
      }
    }
  }

  if (modified) {
    saveStoredLibraries(all);
  }

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
    const isPlanned = nextStatus === 'planned';
    const isCompleted = nextStatus === 'completed';
    const isEpisodic = existing.title.media_type === 'tv' || existing.title.media_type === 'anime_series';

    // Interception logic: if newStatus is 'planned', reset episodes_watched to [] and progress to 0
    let episodesWatched = isPlanned ? [] : (existing.episodes_watched || []);
    let lastChapter = isPlanned ? 0 : (existing.last_chapter_read || 0);
    let lastVolume = isPlanned ? 0 : (existing.last_volume_read || 0);

    if (!isPlanned && isCompleted && isEpisodic && episodesWatched.length === 0 && existing.title.total_episodes) {
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
      last_chapter_read: lastChapter,
      last_volume_read: lastVolume,
      started_at: isPlanned ? null : (nextStatus === 'active' && !existing.started_at ? now : existing.started_at),
      completed_at: isPlanned ? null : (isCompleted && !existing.completed_at ? now : (isCompleted ? existing.completed_at : null)),
      last_progressed_at: now,
    };
    all[existingIndex] = updated;
    saveStoredLibraries(all);

    // Sync to Supabase database if available
    if (supabase) {
      try {
        await supabase
          .from('user_libraries')
          // @ts-expect-error dynamic typing
          .update({
            status: nextStatus,
            started_at: updated.started_at,
            completed_at: updated.completed_at,
            last_progressed_at: now,
            updated_at: now,
          })
          .match({ user_id: params.userId, title_id: params.titleId });

        if (isPlanned) {
          await supabase
            .from('user_episode_progress')
            .delete()
            .match({ user_id: params.userId, library_id: existing.id });
          await supabase
            .from('user_reading_progress')
            .delete()
            .match({ user_id: params.userId, library_id: existing.id });
        }
      } catch (err) {
        // silent fallback
      }
    }

    return updated;
  }

  const isNewPlanned = (params.status || 'planned') === 'planned';
  const isNewCompleted = !isNewPlanned && (params.status || 'planned') === 'completed';
  const isNewEpisodic = resolvedTitle.media_type === 'tv' || resolvedTitle.media_type === 'anime_series';
  const initialEpisodes = (!isNewPlanned && isNewCompleted && isNewEpisodic && resolvedTitle.total_episodes)
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
    completed_at: isNewCompleted ? now : null,
    last_progressed_at: now,
    episodes_watched: isNewPlanned ? [] : initialEpisodes,
    last_chapter_read: 0,
    last_volume_read: 0,
    title: resolvedTitle,
  };

  all.push(newItem);
  saveStoredLibraries(all);

  // Sync insert to Supabase if available
  if (supabase) {
    try {
      await (supabase.from('user_libraries') as any).upsert({
        id: newItem.id,
        user_id: newItem.user_id,
        title_id: newItem.title_id,
        status: newItem.status,
        rating: newItem.rating,
        is_private: newItem.is_private,
        personal_notes: newItem.personal_notes,
        started_at: newItem.started_at,
        completed_at: newItem.completed_at,
        last_progressed_at: newItem.last_progressed_at,
      });
    } catch {}
  }

  return newItem;
}

/**
 * Updates an item's tracking status with progress reset when status is downgraded to 'planned'.
 */
export async function updateItemStatus(params: {
  userId: string;
  titleId?: string;
  libraryId?: string;
  status: TrackingStatus;
}): Promise<UserLibraryItem> {
  const all = getStoredLibraries();
  const target = all.find(
    (item) =>
      item.user_id === params.userId &&
      ((params.libraryId && item.id === params.libraryId) || (params.titleId && item.title_id === params.titleId))
  );

  const titleId = params.titleId || target?.title_id || '';
  return upsertLibraryItem({
    userId: params.userId,
    titleId,
    status: params.status,
  });
}

/**
 * Calculates total episode count across standard, extended, and season-based title metadata.
 */
export function calculateTotalEpisodes(title?: NormalizedCatalogItem | null): number {
  if (!title) return 0;
  if (typeof title.total_episodes === 'number' && title.total_episodes > 0) {
    return title.total_episodes;
  }
  if (typeof (title as any).episodes === 'number' && (title as any).episodes > 0) {
    return (title as any).episodes;
  }
  if (Array.isArray(title.seasons) && title.seasons.length > 0) {
    const seasonsTotal = title.seasons.reduce(
      (acc, s) => acc + (s.episode_count || s.episodes?.length || 0),
      0
    );
    if (seasonsTotal > 0) return seasonsTotal;
  }
  return 0;
}

/**
 * Calculates how many distinct episodes are watched, matching season episodes by ID or number if available.
 */
export function calculateWatchedEpisodesCount(
  watchedEpisodes: string[],
  title?: NormalizedCatalogItem | null
): number {
  if (!Array.isArray(watchedEpisodes) || watchedEpisodes.length === 0) {
    return 0;
  }
  if (title?.seasons && Array.isArray(title.seasons) && title.seasons.length > 0) {
    const allSeasonEpisodes = title.seasons.flatMap((s) => s.episodes || []);
    if (allSeasonEpisodes.length > 0) {
      const matched = allSeasonEpisodes.filter((e) =>
        watchedEpisodes.includes(e.id) ||
        watchedEpisodes.includes(`ep_${e.episode_number}`) ||
        watchedEpisodes.some((id) => id === `ep_${e.episode_number}` || id.endsWith(`_${e.episode_number}`))
      );
      if (matched.length > 0) {
        return matched.length;
      }
    }
  }
  return watchedEpisodes.length;
}

/**
 * Infers the tracking status based on watched episodes vs total episodes:
 * - If 0 episodes watched: reverts to 'planned'
 * - If watchedCount >= totalEpisodes (and totalEpisodes > 0): promotes to 'completed'
 * - If 0 < watchedCount < totalEpisodes: promotes 'planned' or 'completed' to 'active' ('watching')
 */
export function inferWatchedTrackingStatus(params: {
  currentStatus: TrackingStatus;
  watchedCount: number;
  totalEpisodes: number;
}): TrackingStatus {
  const { currentStatus, watchedCount, totalEpisodes } = params;

  if (watchedCount === 0) {
    if (currentStatus === 'active' || currentStatus === 'completed') {
      return 'planned';
    }
    return currentStatus;
  }

  if (totalEpisodes > 0 && watchedCount >= totalEpisodes) {
    return 'completed';
  }

  // watchedCount < totalEpisodes (or totalEpisodes is 0 / unknown)
  if (currentStatus === 'planned' || currentStatus === 'completed') {
    return 'active';
  }

  return currentStatus;
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

  const totalEpisodes = calculateTotalEpisodes(item.title);
  const watchedCount = calculateWatchedEpisodesCount(updatedEpisodes, item.title);
  const nextStatus = inferWatchedTrackingStatus({
    currentStatus: item.status,
    watchedCount,
    totalEpisodes,
  });

  const nextCompletedAt = nextStatus === 'completed' ? (item.completed_at || now) : null;
  const nextStartedAt = nextStatus === 'planned' ? null : (item.started_at || now);

  const updated: UserLibraryItem = {
    ...item,
    episodes_watched: updatedEpisodes,
    status: nextStatus,
    started_at: nextStartedAt,
    completed_at: nextCompletedAt,
    last_progressed_at: now,
  };

  all[index] = updated;
  saveStoredLibraries(all);

  // Sync to Supabase if available
  if (supabase) {
    try {
      await supabase
        .from('user_libraries')
        // @ts-expect-error dynamic typing
        .update({
          status: nextStatus,
          started_at: nextStartedAt,
          completed_at: nextCompletedAt,
          last_progressed_at: now,
          updated_at: now,
        })
        .match({ user_id: params.userId, id: params.libraryId });
    } catch {
      // silent fallback
    }
  }

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

  const totalEpisodes = calculateTotalEpisodes(item.title);
  const watchedCount = calculateWatchedEpisodesCount(updatedEpisodes, item.title);
  const nextStatus = inferWatchedTrackingStatus({
    currentStatus: item.status,
    watchedCount,
    totalEpisodes,
  });

  const nextCompletedAt = nextStatus === 'completed' ? (item.completed_at || now) : null;
  const nextStartedAt = nextStatus === 'planned' ? null : (item.started_at || now);

  const updated: UserLibraryItem = {
    ...item,
    episodes_watched: updatedEpisodes,
    status: nextStatus,
    started_at: nextStartedAt,
    completed_at: nextCompletedAt,
    last_progressed_at: now,
  };

  all[index] = updated;
  saveStoredLibraries(all);

  // Sync to Supabase if available
  if (supabase) {
    try {
      await supabase
        .from('user_libraries')
        // @ts-expect-error dynamic typing
        .update({
          status: nextStatus,
          started_at: nextStartedAt,
          completed_at: nextCompletedAt,
          last_progressed_at: now,
          updated_at: now,
        })
        .match({ user_id: params.userId, id: params.libraryId });
    } catch {
      // silent fallback
    }
  }

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

export async function removeLibraryItem(
  libraryId: string,
  userId: string,
  titleId?: string
): Promise<boolean> {
  const all = getStoredLibraries();
  const target = all.find((item) => (item.id === libraryId || (titleId && item.title_id === titleId)) && item.user_id === userId);
  const remaining = all.filter(
    (item) => !( (item.id === libraryId || (titleId && item.title_id === titleId)) && item.user_id === userId )
  );
  saveStoredLibraries(remaining);

  const effectiveTitleId = titleId || target?.title_id;

  // Wipe watch history
  try {
    const watchHistory = JSON.parse(localStorage.getItem(LOCAL_STORAGE_WATCH_HISTORY_KEY) || '[]');
    const filteredWatch = watchHistory.filter(
      (h: any) => !(h.user_id === userId && (h.library_id === libraryId || (effectiveTitleId && h.title_id === effectiveTitleId)))
    );
    localStorage.setItem(LOCAL_STORAGE_WATCH_HISTORY_KEY, JSON.stringify(filteredWatch));
  } catch {
    // ignore local storage errors
  }

  // Wipe reading history
  try {
    const readingHistory = JSON.parse(localStorage.getItem(LOCAL_STORAGE_READING_HISTORY_KEY) || '[]');
    const filteredReading = readingHistory.filter(
      (h: any) => !(h.user_id === userId && (h.library_id === libraryId || (effectiveTitleId && h.title_id === effectiveTitleId)))
    );
    localStorage.setItem(LOCAL_STORAGE_READING_HISTORY_KEY, JSON.stringify(filteredReading));
  } catch {
    // ignore
  }

  // Live Supabase hard delete if available
  if (supabase) {
    try {
      if (effectiveTitleId) {
        await supabase.from('user_libraries').delete().match({ user_id: userId, title_id: effectiveTitleId });
        await supabase.from('watch_history').delete().match({ user_id: userId, title_id: effectiveTitleId });
        await supabase.from('reading_history').delete().match({ user_id: userId, title_id: effectiveTitleId });
      } else {
        await supabase.from('user_libraries').delete().match({ id: libraryId, user_id: userId });
      }
    } catch (err) {
      console.warn('Failed to delete library entry from Supabase:', err);
    }
  }

  return true;
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
