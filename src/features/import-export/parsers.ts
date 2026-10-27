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

export function findColumnValue(row: Record<string, any>, candidateKeys: string[]): any {
  const rowKeys = Object.keys(row);
  if (rowKeys.length === 0) return undefined;

  const normalizedCandidates = candidateKeys.map((c) =>
    c.toLowerCase().trim().replace(/[-_\s]/g, '')
  );

  // 1. Exact normalized match
  for (const rawKey of rowKeys) {
    const normKey = rawKey.toLowerCase().trim().replace(/[-_\s]/g, '');
    const idx = normalizedCandidates.indexOf(normKey);
    if (idx !== -1 && row[rawKey] !== undefined && row[rawKey] !== null && String(row[rawKey]).trim() !== '') {
      return row[rawKey];
    }
  }

  // 2. Partial/fuzzy match fallback
  for (const rawKey of rowKeys) {
    const normKey = rawKey.toLowerCase().trim().replace(/[-_\s]/g, '');
    for (const cand of normalizedCandidates) {
      if (
        (normKey.includes(cand) || cand.includes(normKey)) &&
        row[rawKey] !== undefined &&
        row[rawKey] !== null &&
        String(row[rawKey]).trim() !== ''
      ) {
        return row[rawKey];
      }
    }
  }

  return undefined;
}

export function normalizeStatus(statusRaw: any): TrackingStatus {
  if (!statusRaw) return 'completed';
  const str = String(statusRaw).toLowerCase().trim();
  if (str.includes('plan') || str.includes('queue') || str.includes('want') || str === '6') {
    return 'planned';
  }
  if (str.includes('pause') || str.includes('hold') || str === '3') {
    return 'paused';
  }
  if (str.includes('drop') || str.includes('abandon') || str.includes('quit') || str === '4') {
    return 'dropped';
  }
  if (str.includes('rewatch') || str.includes('reread')) {
    return 'reconsuming';
  }
  if (
    str.includes('watch') ||
    str.includes('read') ||
    str.includes('active') ||
    str.includes('binging') ||
    str.includes('progress') ||
    str === '1'
  ) {
    return 'active';
  }
  return 'completed';
}

export function normalizeMediaType(typeRaw: any, isReadingHint = false): MediaType {
  if (!typeRaw) {
    return isReadingHint ? 'manga' : 'tv';
  }
  const str = String(typeRaw).toLowerCase().trim();
  if (str.includes('manhwa')) return 'manhwa';
  if (str.includes('manga') || str.includes('comic') || str.includes('novel')) return 'manga';
  if (str.includes('anime_film') || str.includes('anime movie')) return 'anime_film';
  if (str.includes('anime')) return 'anime_series';
  if (str.includes('movie') || str.includes('film')) return 'movie';
  if (str.includes('tv') || str.includes('show') || str.includes('series')) return 'tv';
  return isReadingHint ? 'manga' : 'tv';
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

  if (
    normalized.some(
      (h) =>
        h.includes('binger') ||
        h === 'bingestatus' ||
        h === 'episodesseen' ||
        (h.includes('episodeswatched') && normalized.some((k) => k.includes('show') || k.includes('series')))
    )
  ) {
    return 'binger';
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

export function parseBingerRow(raw: Record<string, any>, index: number): ParsedImportRow | null {
  const title = findColumnValue(raw, [
    'title',
    'show',
    'series',
    'name',
    'show name',
    'series title',
    'series name',
    'item',
  ]);
  if (!title) return null;

  const yearRaw = findColumnValue(raw, ['year', 'release year', 'air year', 'date', 'premiered']);
  const year = yearRaw ? parseInt(String(yearRaw).slice(0, 4), 10) : undefined;

  const typeRaw = findColumnValue(raw, ['media type', 'type', 'format', 'category', 'kind']);
  const mediaType = normalizeMediaType(typeRaw, false);

  const statusRaw = findColumnValue(raw, ['binge status', 'status', 'state', 'progress status', 'condition']);
  const status = normalizeStatus(statusRaw);

  const ratingRaw = findColumnValue(raw, ['rating', 'score', 'user rating', 'my score', 'stars', 'grade']);
  let rating: number | undefined;
  if (ratingRaw !== undefined && ratingRaw !== '') {
    const num = parseFloat(String(ratingRaw));
    if (!isNaN(num)) {
      rating = num <= 5 && num > 0 ? Math.min(10, Math.round(num * 2)) : Math.min(10, Math.max(1, Math.round(num)));
    }
  }

  const epRaw = findColumnValue(raw, [
    'episodes seen',
    'watched episodes',
    'episodes watched',
    'episodes',
    'watched eps',
    'seen eps',
    'progress',
    'current episode',
  ]);
  const episodesWatched = epRaw !== undefined ? parseInt(String(epRaw), 10) : undefined;

  const completedAt = findColumnValue(raw, [
    'completed at',
    'date finished',
    'watched date',
    'date',
    'finished at',
    'last watched',
  ]);

  const notes = findColumnValue(raw, ['notes', 'comments', 'review', 'tags']);

  const fingerprint = generateRowFingerprint(String(title), year, mediaType);

  return {
    index,
    rawTitle: String(title),
    normalizedTitle: normalizeTitleString(String(title)),
    year: isNaN(year!) ? undefined : year,
    mediaType,
    status,
    rating,
    episodesWatched: isNaN(episodesWatched!) ? undefined : episodesWatched,
    completedAt: completedAt ? String(completedAt) : undefined,
    notes: notes ? String(notes) : undefined,
    fingerprint,
  };
}

export function parseGenericRow(raw: Record<string, any>, index: number): ParsedImportRow | null {
  const title = findColumnValue(raw, [
    'title',
    'name',
    'show',
    'series',
    'title name',
    'film',
    'movie',
    'item',
  ]);
  if (!title) return null;

  const yearRaw = findColumnValue(raw, ['year', 'release year', 'premiered', 'air date', 'date']);
  const year = yearRaw ? parseInt(String(yearRaw).slice(0, 4), 10) : undefined;

  const typeRaw = findColumnValue(raw, ['media type', 'mediatype', 'type', 'format', 'category']);
  const isReadingHint = Boolean(
    findColumnValue(raw, ['chapters', 'chapters read', 'volumes', 'volumes read'])
  );
  const mediaType = normalizeMediaType(typeRaw, isReadingHint);

  const statusRaw = findColumnValue(raw, ['status', 'state', 'watch status', 'progress status', 'condition']);
  const status = normalizeStatus(statusRaw);

  const ratingRaw = findColumnValue(raw, ['rating', 'score', 'user rating', 'my rating', 'stars']);
  let rating: number | undefined;
  if (ratingRaw !== undefined && ratingRaw !== '') {
    const num = parseFloat(String(ratingRaw));
    if (!isNaN(num)) {
      rating = num <= 5 && num > 0 ? Math.min(10, Math.round(num * 2)) : Math.min(10, Math.max(1, Math.round(num)));
    }
  }

  const epRaw = findColumnValue(raw, [
    'episodes',
    'episodes watched',
    'episodes seen',
    'watched episodes',
    'seen eps',
    'progress',
  ]);
  const episodesWatched = epRaw !== undefined ? parseInt(String(epRaw), 10) : undefined;

  const chRaw = findColumnValue(raw, [
    'chapters',
    'chapters read',
    'read chapters',
    'chapter progress',
    'current chapter',
  ]);
  const chaptersRead = chRaw !== undefined ? parseFloat(String(chRaw)) : undefined;

  const volRaw = findColumnValue(raw, [
    'volumes',
    'volumes read',
    'read volumes',
    'volume progress',
  ]);
  const volumesRead = volRaw !== undefined ? parseInt(String(volRaw), 10) : undefined;

  const completedAt = findColumnValue(raw, [
    'completed at',
    'completed date',
    'date finished',
    'watched date',
    'date',
  ]);

  const notes = findColumnValue(raw, ['notes', 'comments', 'tags']);

  const fingerprint = generateRowFingerprint(String(title), year, mediaType);

  return {
    index,
    rawTitle: String(title),
    normalizedTitle: normalizeTitleString(String(title)),
    year: isNaN(year!) ? undefined : year,
    mediaType,
    status,
    rating,
    episodesWatched: isNaN(episodesWatched!) ? undefined : episodesWatched,
    chaptersRead: isNaN(chaptersRead!) ? undefined : chaptersRead,
    volumesRead: isNaN(volumesRead!) ? undefined : volumesRead,
    completedAt: completedAt ? String(completedAt) : undefined,
    notes: notes ? String(notes) : undefined,
    fingerprint,
  };
}
