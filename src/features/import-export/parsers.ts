import type { PlatformPreset, ParsedImportRow } from './types';
import type { MediaType, TrackingStatus } from '../../types/database.types';

export function normalizeTitleString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function generateRowFingerprint(
  title: string,
  year?: number,
  type?: MediaType,
  externalId?: string
): string {
  const normTitle = normalizeTitleString(title);
  const y = year || 0;
  const t = type || 'movie';
  const ext = externalId ? externalId.trim().toLowerCase() : '';
  return `${normTitle}_${y}_${t}_${ext}`;
}

export function detectPlatformPreset(headers: string[]): PlatformPreset {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/['"\s_]/g, ''));

  if (normalized.some((h) => h.includes('letterboxduri') || h === 'letterboxdurl')) {
    return 'letterboxd';
  }

  if (normalized.includes('const') && normalized.some((h) => h.includes('yourrating') || h.includes('titletype'))) {
    return 'imdb';
  }

  if (normalized.includes('traktid') || (normalized.includes('tmdbid') && normalized.includes('watchedat'))) {
    return 'trakt';
  }

  if (
    normalized.some((h) => h.includes('seriestitle') || h.includes('mywatchedepisodes') || h.includes('myreadchapters'))
  ) {
    return 'mal';
  }

  return 'generic';
}

export function parseLetterboxdRow(raw: Record<string, any>, index: number): ParsedImportRow | null {
  const title = raw['Name'] || raw['name'] || raw['Title'] || raw['title'];
  if (!title) return null;

  const year = raw['Year'] ? parseInt(raw['Year'], 10) : undefined;
  const rawRating = raw['Rating'] !== undefined && raw['Rating'] !== '' ? parseFloat(raw['Rating']) : undefined;
  // Letterboxd ratings are 0.5 to 5.0 stars -> convert to 1 to 10 points
  const rating = rawRating ? Math.min(10, Math.max(1, Math.round(rawRating * 2))) : undefined;

  const uri = raw['Letterboxd URI'] || raw['letterboxd_uri'] || '';
  const isRewatch = String(raw['Rewatch'] || '').toLowerCase() === 'yes';
  const status: TrackingStatus = isRewatch ? 'reconsuming' : 'completed';

  const fingerprint = generateRowFingerprint(title, year, 'movie', uri);

  return {
    index,
    rawTitle: title,
    normalizedTitle: normalizeTitleString(title),
    year,
    mediaType: 'movie',
    externalId: uri,
    status,
    rating,
    completedAt: raw['Watched Date'] || raw['Date'] || undefined,
    notes: raw['Tags'] || undefined,
    fingerprint,
  };
}

export function parseImdbRow(raw: Record<string, any>, index: number): ParsedImportRow | null {
  const title = raw['Title'] || raw['title'] || raw['Original Title'];
  if (!title) return null;

  const constId = raw['Const'] || raw['const'] || '';
  const year = raw['Year'] ? parseInt(raw['Year'], 10) : undefined;
  const rawType = String(raw['Title Type'] || raw['title_type'] || '').toLowerCase();

  let mediaType: MediaType = 'movie';
  if (rawType.includes('tv') || rawType.includes('series') || rawType.includes('episode')) {
    mediaType = 'tv';
  }

  const rawRating = raw['Your Rating'] ? parseInt(raw['Your Rating'], 10) : undefined;
  const rating = rawRating && rawRating >= 1 && rawRating <= 10 ? rawRating : undefined;

  const fingerprint = generateRowFingerprint(title, year, mediaType, constId);

  return {
    index,
    rawTitle: title,
    normalizedTitle: normalizeTitleString(title),
    year,
    mediaType,
    externalId: constId,
    status: 'completed',
    rating,
    completedAt: raw['Date Rated'] || raw['Release Date'] || undefined,
    fingerprint,
  };
}

export function parseTraktRow(raw: Record<string, any>, index: number): ParsedImportRow | null {
  const title = raw['title'] || raw['Title'];
  if (!title) return null;

  const year = raw['year'] || raw['Year'] ? parseInt(raw['year'] || raw['Year'], 10) : undefined;
  const rawType = String(raw['type'] || raw['Type'] || 'movie').toLowerCase();
  const mediaType: MediaType = rawType.includes('show') || rawType.includes('tv') ? 'tv' : 'movie';
  const extId = String(raw['trakt_id'] || raw['tmdb_id'] || raw['imdb_id'] || '');

  const rawRating = raw['rating'] || raw['Rating'] ? parseInt(raw['rating'] || raw['Rating'], 10) : undefined;
  const rating = rawRating && rawRating >= 1 && rawRating <= 10 ? rawRating : undefined;

  const fingerprint = generateRowFingerprint(title, year, mediaType, extId);

  return {
    index,
    rawTitle: title,
    normalizedTitle: normalizeTitleString(title),
    year,
    mediaType,
    externalId: extId,
    status: 'completed',
    rating,
    completedAt: raw['watched_at'] || undefined,
    fingerprint,
  };
}

export function parseMalRow(raw: Record<string, any>, index: number): ParsedImportRow | null {
  const title = raw['series_title'] || raw['title'] || raw['Title'];
  if (!title) return null;

  const rawSeriesType = String(raw['series_type'] || '').toLowerCase();
  const isReading =
    'my_read_chapters' in raw ||
    'series_chapters' in raw ||
    rawSeriesType.includes('manga') ||
    rawSeriesType.includes('manhwa') ||
    rawSeriesType.includes('novel');

  let mediaType: MediaType = 'anime_series';
  if (isReading) {
    mediaType = rawSeriesType.includes('manhwa') ? 'manhwa' : 'manga';
  } else {
    mediaType = rawSeriesType.includes('movie') ? 'anime_film' : 'anime_series';
  }

  // Map MAL Status codes:
  // 1: Watching/Reading, 2: Completed, 3: On-Hold, 4: Dropped, 6: Plan to Watch/Read
  const rawStatus = String(raw['my_status'] || '2').toLowerCase();
  let status: TrackingStatus = 'completed';
  if (rawStatus === '1' || rawStatus.includes('watching') || rawStatus.includes('reading')) {
    status = 'active';
  } else if (rawStatus === '2' || rawStatus.includes('completed')) {
    status = 'completed';
  } else if (rawStatus === '3' || rawStatus.includes('hold') || rawStatus.includes('paused')) {
    status = 'paused';
  } else if (rawStatus === '4' || rawStatus.includes('dropped')) {
    status = 'dropped';
  } else if (rawStatus === '6' || rawStatus.includes('plan')) {
    status = 'planned';
  }

  const rawScore = raw['my_score'] ? parseInt(raw['my_score'], 10) : undefined;
  const rating = rawScore && rawScore >= 1 && rawScore <= 10 ? rawScore : undefined;

  const eps = raw['my_watched_episodes'] ? parseInt(raw['my_watched_episodes'], 10) : undefined;
  let chs = raw['my_read_chapters'] ? parseFloat(raw['my_read_chapters']) : undefined;
  if (isReading && chs === undefined && eps !== undefined) {
    chs = eps;
  }
  const vols = raw['my_read_volumes'] ? parseInt(raw['my_read_volumes'], 10) : undefined;

  const fingerprint = generateRowFingerprint(title, undefined, mediaType);

  return {
    index,
    rawTitle: title,
    normalizedTitle: normalizeTitleString(title),
    mediaType,
    status,
    rating,
    episodesWatched: eps,
    chaptersRead: chs,
    volumesRead: vols,
    fingerprint,
  };
}

export function parseGenericRow(raw: Record<string, any>, index: number): ParsedImportRow | null {
  const title = raw['Title'] || raw['title'] || raw['Name'] || raw['name'];
  if (!title) return null;

  const year = raw['Year'] || raw['year'] ? parseInt(raw['Year'] || raw['year'], 10) : undefined;
  const typeStr = String(raw['MediaType'] || raw['media_type'] || raw['Type'] || 'movie').toLowerCase();

  let mediaType: MediaType = 'movie';
  if (['tv', 'show', 'tv_show'].includes(typeStr)) mediaType = 'tv';
  else if (typeStr === 'anime_series') mediaType = 'anime_series';
  else if (typeStr === 'anime_film') mediaType = 'anime_film';
  else if (typeStr === 'manga') mediaType = 'manga';
  else if (typeStr === 'manhwa') mediaType = 'manhwa';

  const rawRating = raw['Rating'] || raw['rating'] ? parseInt(raw['Rating'] || raw['rating'], 10) : undefined;
  const rating = rawRating && rawRating >= 1 && rawRating <= 10 ? rawRating : undefined;

  const fingerprint = generateRowFingerprint(title, year, mediaType);

  return {
    index,
    rawTitle: title,
    normalizedTitle: normalizeTitleString(title),
    year,
    mediaType,
    status: (raw['Status'] || raw['status'] || 'completed').toLowerCase() as TrackingStatus,
    rating,
    episodesWatched: raw['Episodes'] ? parseInt(raw['Episodes'], 10) : undefined,
    chaptersRead: raw['Chapters'] ? parseFloat(raw['Chapters']) : undefined,
    fingerprint,
  };
}
