/**
 * Active Metadata Healer for Stale / Blank Posters & Backdrops.
 * Automatically recovers missing media images from TMDB and AniList APIs in the background,
 * updates local UI state immediately, and commits healed records to Supabase.
 */

import { fetchTmdbMediaById } from './tmdbClient';
import { fetchAniListMediaById } from './anilistClient';
import { getCatalogTitleById } from './catalogService';
import { resolvePosterUrl, resolveBackdropUrl } from '../../lib/imageUtils';
import { updateLibraryItem, type UserLibraryItem } from '../library/libraryService';

// Set to prevent duplicate simultaneous healing requests for the same ID
const activeHealingSet = new Set<string>();

/**
 * Checks whether an item or title has missing/blank poster or backdrop images.
 */
export function isMetadataMissingImages(title: any): boolean {
  if (!title) return false;

  const rawPoster = title.poster_url || title.poster_path;
  const isPosterMissing =
    !rawPoster ||
    typeof rawPoster !== 'string' ||
    !rawPoster.trim() ||
    rawPoster === 'null' ||
    rawPoster === 'undefined' ||
    rawPoster === '/assets/trackup-logo.jpg';

  const rawBackdrop = title.backdrop_url || title.backdrop_path || title.bannerImage;
  const isBackdropMissing =
    !rawBackdrop ||
    typeof rawBackdrop !== 'string' ||
    !rawBackdrop.trim() ||
    rawBackdrop === 'null' ||
    rawBackdrop === 'undefined' ||
    rawBackdrop === '/assets/trackup-logo.jpg';

  return isPosterMissing || isBackdropMissing;
}

/**
 * Determines whether a title can be healed using available external provider IDs.
 */
export function canHealTitle(title: any, titleId?: string): boolean {
  if (!title) return false;

  const hasMissingImages = isMetadataMissingImages(title);
  if (!hasMissingImages) return false;

  const effectiveId = titleId || title.id || '';

  const hasTmdbId =
    typeof title.tmdb_id === 'number' ||
    Boolean(title.tmdb_id) ||
    /^(tmdb_|tv_|movie_)/.test(effectiveId);

  const hasAniListId =
    typeof title.anilist_id === 'number' ||
    Boolean(title.anilist_id) ||
    /^anilist_/.test(effectiveId);

  return hasTmdbId || hasAniListId;
}

export interface HealedImages {
  poster_url: string;
  backdrop_url: string;
  fullItem?: any;
}

/**
 * Fires a background fetch to the respective API (TMDB/AniList) to retrieve full media details
 * and returns high-resolution repaired poster and backdrop URLs.
 */
export async function healTitleMetadata(
  title: any,
  titleId?: string
): Promise<HealedImages | null> {
  const effectiveId = titleId || title?.id || '';
  const healingKey = `${effectiveId}_${title?.tmdb_id || ''}_${title?.anilist_id || ''}`;

  if (activeHealingSet.has(healingKey)) {
    return null;
  }

  activeHealingSet.add(healingKey);

  try {
    let freshData: any = null;

    // 1. Live TMDB TV hydration
    if (
      title?.tmdb_id &&
      (title.media_type === 'tv' || title.media_type === 'anime_series')
    ) {
      freshData = await fetchTmdbMediaById(Number(title.tmdb_id), 'tv');
    } else if (title?.tmdb_id && (title.media_type === 'movie' || title.media_type === 'anime_film')) {
      freshData = await fetchTmdbMediaById(Number(title.tmdb_id), 'movie');
    } else if (title?.tmdb_id) {
      // Default try TV then movie
      freshData = await fetchTmdbMediaById(Number(title.tmdb_id), 'tv');
      if (!freshData) {
        freshData = await fetchTmdbMediaById(Number(title.tmdb_id), 'movie');
      }
    }

    // 2. Live AniList hydration
    if (!freshData && title?.anilist_id) {
      freshData = await fetchAniListMediaById(Number(title.anilist_id));
    }

    // 3. Provider string ID fallback (e.g., "tmdb_tv_73586" or "anilist_154587")
    if (!freshData && effectiveId) {
      freshData = await getCatalogTitleById(effectiveId);
    }

    if (!freshData) {
      return null;
    }

    const resolvedPoster = resolvePosterUrl(
      freshData.poster_url ||
        freshData.poster_path ||
        freshData.coverImage?.extraLarge ||
        freshData.coverImage?.large
    );

    const resolvedBackdrop = resolveBackdropUrl(
      freshData.backdrop_url ||
        freshData.backdrop_path ||
        freshData.bannerImage
    );

    return {
      poster_url: resolvedPoster,
      backdrop_url: resolvedBackdrop,
      fullItem: freshData,
    };
  } catch (err) {
    console.warn('[MetadataHealer] Silent recovery failed:', err);
    return null;
  } finally {
    activeHealingSet.delete(healingKey);
  }
}

/**
 * Auto-heals an individual library item, updates local cache and persists to Supabase.
 */
export async function healLibraryItem(
  item: UserLibraryItem,
  userId: string
): Promise<HealedImages | null> {
  if (!item?.title || !canHealTitle(item.title, item.title_id)) {
    return null;
  }

  const healed = await healTitleMetadata(item.title, item.title_id);
  if (!healed) return null;

  // Persist to Supabase and update local storage
  await updateLibraryItem({
    userId,
    titleId: item.title_id,
    poster_url: healed.poster_url,
    backdrop_url: healed.backdrop_url,
    titleData: healed.fullItem ? { ...item.title, ...healed.fullItem } : undefined,
  });

  return healed;
}

/**
 * Heals a batch of library items in the background, firing onHealed callbacks
 * as each item completes so UI views update incrementally.
 */
export function healLibraryBatch(
  items: UserLibraryItem[],
  userId: string,
  onHealed?: (titleId: string, images: HealedImages) => void
): void {
  const needsHealing = items.filter((it) => it?.title && canHealTitle(it.title, it.title_id));
  if (needsHealing.length === 0) return;

  // Process up to 3 concurrent background requests to avoid rate limits
  const queue = [...needsHealing];
  const maxConcurrency = 3;
  let activeWorkers = 0;

  function processNext() {
    if (queue.length === 0) return;
    if (activeWorkers >= maxConcurrency) return;

    const currentItem = queue.shift();
    if (!currentItem) return;

    activeWorkers++;
    healLibraryItem(currentItem, userId)
      .then((healed) => {
        if (healed && onHealed) {
          onHealed(currentItem.title_id, healed);
        }
      })
      .catch(() => {})
      .finally(() => {
        activeWorkers--;
        processNext();
      });

    // Spawn additional workers if available
    if (activeWorkers < maxConcurrency && queue.length > 0) {
      processNext();
    }
  }

  for (let i = 0; i < maxConcurrency; i++) {
    processNext();
  }
}
