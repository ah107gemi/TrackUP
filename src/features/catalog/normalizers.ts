import { sanitizeUrl, type NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';

export interface TmdbMoviePayload {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  original_language?: string;
  runtime?: number | null;
  origin_country?: string[];
}

export interface TmdbTvPayload {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  original_language?: string;
  origin_country?: string[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  status?: string;
}

export interface AniListMediaPayload {
  id: number;
  idMal?: number | null;
  type: 'ANIME' | 'MANGA';
  format?: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MANGA' | 'ONE_SHOT';
  title: {
    romaji?: string;
    english?: string | null;
    native?: string | null;
  };
  synonyms?: string[];
  countryOfOrigin?: string | null; // 'JP', 'KR', 'CN'
  description?: string | null;
  startDate?: { year?: number | null; month?: number | null; day?: number | null };
  coverImage?: { large?: string | null; medium?: string | null; extraLarge?: string | null };
  bannerImage?: string | null;
  genres?: string[];
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  status?: string;
}

export function normalizeTmdbMovie(payload: TmdbMoviePayload): NormalizedCatalogItem {
  const isAnimation =
    payload.genre_ids?.includes(16) ||
    payload.genres?.some((g) => g.id === 16 || g.name.toLowerCase() === 'animation');
  const isJapanese =
    payload.original_language === 'ja' ||
    payload.origin_country?.includes('JP');

  const mediaType: MediaType = isAnimation && isJapanese ? 'anime_film' : 'movie';
  const releaseYear = payload.release_date
    ? parseInt(payload.release_date.split('-')[0], 10)
    : null;

  const poster = payload.poster_path
    ? sanitizeUrl(`https://image.tmdb.org/t/p/w342${payload.poster_path}`)
    : null;
  const backdrop = payload.backdrop_path
    ? sanitizeUrl(`https://image.tmdb.org/t/p/w1280${payload.backdrop_path}`)
    : null;

  const genres = payload.genres?.map((g) => g.name) || [];

  return {
    id: `tmdb_movie_${payload.id}`,
    media_type: mediaType,
    title: payload.title,
    original_title: payload.original_title || null,
    release_year: releaseYear && !isNaN(releaseYear) ? releaseYear : null,
    release_date: payload.release_date || null,
    synopsis: payload.overview || null,
    poster_url: poster,
    backdrop_url: backdrop,
    genres,
    origin_country: payload.origin_country?.[0] || (isJapanese ? 'JP' : 'US'),
    status: 'released',
    runtime_minutes: payload.runtime || null,
    tmdb_id: payload.id,
    imdb_id: null,
    anilist_id: null,
    mal_id: null,
  };
}

export function normalizeTmdbTv(payload: TmdbTvPayload): NormalizedCatalogItem {
  const isAnimation =
    payload.genre_ids?.includes(16) ||
    payload.genres?.some((g) => g.id === 16 || g.name.toLowerCase() === 'animation');
  const isJapanese =
    payload.original_language === 'ja' ||
    payload.origin_country?.includes('JP');

  const mediaType: MediaType = isAnimation && isJapanese ? 'anime_series' : 'tv';
  const releaseYear = payload.first_air_date
    ? parseInt(payload.first_air_date.split('-')[0], 10)
    : null;

  const poster = payload.poster_path
    ? sanitizeUrl(`https://image.tmdb.org/t/p/w342${payload.poster_path}`)
    : null;
  const backdrop = payload.backdrop_path
    ? sanitizeUrl(`https://image.tmdb.org/t/p/w1280${payload.backdrop_path}`)
    : null;

  const genres = payload.genres?.map((g) => g.name) || [];

  return {
    id: `tmdb_tv_${payload.id}`,
    media_type: mediaType,
    title: payload.name,
    original_title: payload.original_name || null,
    release_year: releaseYear && !isNaN(releaseYear) ? releaseYear : null,
    release_date: payload.first_air_date || null,
    synopsis: payload.overview || null,
    poster_url: poster,
    backdrop_url: backdrop,
    genres,
    origin_country: payload.origin_country?.[0] || (isJapanese ? 'JP' : 'US'),
    status: payload.status || 'released',
    total_episodes: payload.number_of_episodes || null,
    total_seasons: payload.number_of_seasons || null,
    tmdb_id: payload.id,
    imdb_id: null,
    anilist_id: null,
    mal_id: null,
  };
}

export function normalizeAniListMedia(
  payload: AniListMediaPayload | any,
  preferredType?: MediaType
): NormalizedCatalogItem {
  if (!payload || typeof payload !== 'object') {
    return {
      id: `anilist_fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      media_type: preferredType || 'manga',
      title: 'Untitled',
      original_title: null,
      release_year: null,
      release_date: null,
      synopsis: null,
      poster_url: '/assets/trackup-logo.jpg',
      backdrop_url: null,
      genres: [],
      origin_country: preferredType === 'manhwa' ? 'KR' : 'JP',
      status: 'released',
      anilist_id: null,
      mal_id: null,
      tmdb_id: null,
      imdb_id: null,
    };
  }

  let mediaType: MediaType;

  // If caller specifically requested manhwa, manga, anime_series, anime_film
  if (preferredType === 'manhwa') {
    mediaType = 'manhwa';
  } else if (preferredType === 'manga') {
    mediaType = 'manga';
  } else if (preferredType === 'anime_series') {
    mediaType = 'anime_series';
  } else if (preferredType === 'anime_film') {
    mediaType = 'anime_film';
  } else if (payload.type === 'MANGA') {
    // STRICT BLUEPRINT RULE:
    // countryOfOrigin: "KR" maps to manhwa, "JP" maps to manga.
    // Also detect Korean Hangul in titles as manhwa if countryOfOrigin is missing
    const rawTitle = payload.title || {};
    const titleStrings = [
      rawTitle.native,
      rawTitle.romaji,
      rawTitle.english,
      ...(Array.isArray(payload.synonyms) ? payload.synonyms : []),
    ]
      .filter(Boolean)
      .join(' ');

    const hasKoreanTitle = /[\uac00-\ud7af\u1100-\u11ff]/.test(titleStrings);
    if (payload.countryOfOrigin === 'KR' || hasKoreanTitle) {
      mediaType = 'manhwa';
    } else {
      mediaType = 'manga';
    }
  } else if (payload.type === 'ANIME') {
    if (payload.format === 'MOVIE') {
      mediaType = 'anime_film';
    } else {
      mediaType = 'anime_series';
    }
  } else {
    // Fallback if payload.type is indeterminate: default to preferredType or manhwa/manga
    if (preferredType) {
      mediaType = preferredType;
    } else if (payload.countryOfOrigin === 'KR') {
      mediaType = 'manhwa';
    } else {
      mediaType = 'manga';
    }
  }

  const rawTitle = payload.title || {};
  const title =
    (typeof rawTitle.english === 'string' && rawTitle.english.trim()) ||
    (typeof rawTitle.romaji === 'string' && rawTitle.romaji.trim()) ||
    (typeof rawTitle.native === 'string' && rawTitle.native.trim()) ||
    (Array.isArray(payload.synonyms) && payload.synonyms[0]) ||
    'Untitled';

  const originalTitle =
    (typeof rawTitle.native === 'string' && rawTitle.native.trim()) ||
    (typeof rawTitle.romaji === 'string' && rawTitle.romaji.trim()) ||
    null;

  const rawCover =
    payload.coverImage?.extraLarge ||
    payload.coverImage?.large ||
    payload.coverImage?.medium ||
    null;
  const poster = sanitizeUrl(rawCover) || '/assets/trackup-logo.jpg';
  const backdrop = sanitizeUrl(payload.bannerImage);

  // Clean HTML tags from AniList synopsis if present
  const cleanDescription = payload.description
    ? String(payload.description).replace(/<[^>]*>/g, '').trim()
    : null;

  const releaseDateStr = payload.startDate?.year
    ? `${payload.startDate.year}-${String(payload.startDate.month || 1).padStart(2, '0')}-${String(payload.startDate.day || 1).padStart(2, '0')}`
    : null;

  let normalizedStatus = 'released';
  if (payload.status) {
    const s = String(payload.status).toUpperCase();
    if (s === 'FINISHED') normalizedStatus = 'completed';
    else if (s === 'RELEASING') normalizedStatus = 'releasing';
    else if (s === 'NOT_YET_RELEASED') normalizedStatus = 'planned';
    else if (s === 'CANCELLED') normalizedStatus = 'dropped';
    else if (s === 'HIATUS') normalizedStatus = 'paused';
    else normalizedStatus = String(payload.status).toLowerCase();
  }

  const numericId = Number(payload.id) || Date.now();

  return {
    id: `anilist_${numericId}`,
    media_type: mediaType,
    title,
    original_title: originalTitle,
    release_year: payload.startDate?.year || null,
    release_date: releaseDateStr,
    synopsis: cleanDescription,
    poster_url: poster,
    backdrop_url: backdrop,
    genres: Array.isArray(payload.genres) ? payload.genres : [],
    origin_country: payload.countryOfOrigin || (mediaType === 'manhwa' ? 'KR' : 'JP'),
    status: normalizedStatus,
    total_episodes: typeof payload.episodes === 'number' ? payload.episodes : null,
    total_chapters: typeof payload.chapters === 'number' ? payload.chapters : null,
    total_volumes: typeof payload.volumes === 'number' ? payload.volumes : null,
    anilist_id: numericId,
    mal_id: payload.idMal || null,
    tmdb_id: null,
    imdb_id: null,
  };
}
