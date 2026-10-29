import { sanitizeUrl, type NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';

/**
 * Bulletproofs TMDB image URLs by ensuring path is prepended with https://image.tmdb.org/t/p/{size}.
 * If the path is already a full URL, it returns the sanitized URL directly.
 */
export function buildTmdbImageUrl(path: string | null | undefined, size: string = 'w500'): string | null {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return sanitizeUrl(trimmed);
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return sanitizeUrl(`https://image.tmdb.org/t/p/${size}${cleanPath}`);
}

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

export interface TmdbSeasonPayload {
  id?: number | string;
  season_number: number;
  name?: string;
  overview?: string | null;
  episode_count?: number;
  air_date?: string | null;
  poster_path?: string | null;
  episodes?: {
    id?: number | string;
    episode_number?: number;
    name?: string;
    overview?: string | null;
    runtime?: number | null;
    air_date?: string | null;
  }[];
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
  episodes?: number;
  total_episodes?: number;
  seasons?: TmdbSeasonPayload[];
}

export interface AniListMediaPayload {
  id: number;
  idMal?: number | null;
  type: 'ANIME' | 'MANGA';
  format?: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MANGA' | 'ONE_SHOT' | 'MUSIC';
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
  number_of_episodes?: number | null;
  total_episodes?: number | null;
  chapters?: number | null;
  total_chapters?: number | null;
  volumes?: number | null;
  total_volumes?: number | null;
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

  const rawPoster = payload.poster_path || (payload as any).poster_url || (payload as any).poster;
  const rawBackdrop = payload.backdrop_path || (payload as any).backdrop_url || (payload as any).backdrop;

  const poster = buildTmdbImageUrl(rawPoster, 'w500');
  const backdrop = buildTmdbImageUrl(rawBackdrop, 'w1280');

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
    poster_path: poster,
    backdrop_url: backdrop,
    backdrop_path: backdrop,
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

  const rawPoster = payload.poster_path || (payload as any).poster_url || (payload as any).poster;
  const rawBackdrop = payload.backdrop_path || (payload as any).backdrop_url || (payload as any).backdrop;

  const poster = buildTmdbImageUrl(rawPoster, 'w500');
  const backdrop = buildTmdbImageUrl(rawBackdrop, 'w1280');

  const genres = payload.genres?.map((g) => g.name) || [];

  // Map seasons array (filter out season 0 / specials)
  const rawSeasons = Array.isArray(payload.seasons) ? payload.seasons : [];
  const validSeasons = rawSeasons.filter((s) => typeof s.season_number === 'number' && s.season_number > 0);

  const mappedSeasons = validSeasons.map((s) => {
    const epCount =
      typeof s.episode_count === 'number' && s.episode_count > 0
        ? s.episode_count
        : Array.isArray(s.episodes)
        ? s.episodes.length
        : 0;

    return {
      id: `tmdb_season_${payload.id}_${s.season_number}`,
      season_number: s.season_number,
      name: s.name || `Season ${s.season_number}`,
      overview: s.overview || null,
      episode_count: epCount,
      episodes:
        Array.isArray(s.episodes) && s.episodes.length > 0
          ? s.episodes.map((ep, idx) => ({
              id: `tmdb_ep_${payload.id}_${s.season_number}_${ep.episode_number || idx + 1}`,
              episode_number: ep.episode_number || idx + 1,
              name: ep.name || `Episode ${ep.episode_number || idx + 1}`,
              overview: ep.overview || null,
              runtime_minutes: ep.runtime || 45,
              air_date: ep.air_date || null,
            }))
          : Array.from({ length: epCount }, (_, idx) => ({
              id: `tmdb_ep_${payload.id}_${s.season_number}_${idx + 1}`,
              episode_number: idx + 1,
              name: `Episode ${idx + 1}`,
              overview: null,
              runtime_minutes: 45,
              air_date: s.air_date || null,
            })),
    };
  });

  const sumSeasonEpisodes = mappedSeasons.reduce((acc, s) => acc + s.episode_count, 0);

  const episodesCount =
    typeof payload.number_of_episodes === 'number' && payload.number_of_episodes > 0
      ? payload.number_of_episodes
      : sumSeasonEpisodes > 0
      ? sumSeasonEpisodes
      : typeof (payload as any).episodes === 'number' && (payload as any).episodes > 0
      ? (payload as any).episodes
      : typeof (payload as any).total_episodes === 'number' && (payload as any).total_episodes > 0
      ? (payload as any).total_episodes
      : null;

  const totalSeasons =
    typeof payload.number_of_seasons === 'number' && payload.number_of_seasons > 0
      ? payload.number_of_seasons
      : mappedSeasons.length > 0
      ? mappedSeasons.length
      : null;

  return {
    id: `tmdb_tv_${payload.id}`,
    media_type: mediaType,
    title: payload.name,
    original_title: payload.original_name || null,
    release_year: releaseYear && !isNaN(releaseYear) ? releaseYear : null,
    release_date: payload.first_air_date || null,
    synopsis: payload.overview || null,
    poster_url: poster,
    poster_path: poster,
    backdrop_url: backdrop,
    backdrop_path: backdrop,
    genres,
    origin_country: payload.origin_country?.[0] || (isJapanese ? 'JP' : 'US'),
    status: payload.status || 'released',
    total_episodes: episodesCount,
    episodes: episodesCount,
    total_seasons: totalSeasons,
    seasons: mappedSeasons.length > 0 ? mappedSeasons : undefined,
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
    (typeof payload.coverImage === 'string' && payload.coverImage.trim()) ||
    payload.coverImage?.extraLarge ||
    payload.coverImage?.large ||
    payload.coverImage?.medium ||
    (typeof payload.cover_image === 'string' && payload.cover_image.trim()) ||
    payload.cover_image?.extraLarge ||
    payload.cover_image?.large ||
    payload.cover_image?.medium ||
    payload.poster_url ||
    payload.poster ||
    null;

  const sanitizedCover = sanitizeUrl(rawCover);
  const poster =
    sanitizedCover ||
    (typeof rawCover === 'string' && (rawCover.startsWith('http://') || rawCover.startsWith('https://'))
      ? rawCover.trim()
      : '/assets/trackup-logo.jpg');
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

  const episodesCount =
    typeof payload.episodes === 'number' && payload.episodes > 0
      ? payload.episodes
      : typeof (payload as any).total_episodes === 'number' && (payload as any).total_episodes > 0
      ? (payload as any).total_episodes
      : typeof (payload as any).number_of_episodes === 'number' && (payload as any).number_of_episodes > 0
      ? (payload as any).number_of_episodes
      : null;

  const chaptersCount =
    typeof payload.chapters === 'number' && payload.chapters > 0
      ? payload.chapters
      : typeof (payload as any).total_chapters === 'number' && (payload as any).total_chapters > 0
      ? (payload as any).total_chapters
      : null;

  const volumesCount =
    typeof payload.volumes === 'number' && payload.volumes > 0
      ? payload.volumes
      : typeof (payload as any).total_volumes === 'number' && (payload as any).total_volumes > 0
      ? (payload as any).total_volumes
      : null;

  return {
    id: `anilist_${numericId}`,
    media_type: mediaType,
    title,
    original_title: originalTitle,
    release_year: payload.startDate?.year || null,
    release_date: releaseDateStr,
    synopsis: cleanDescription,
    poster_url: poster,
    poster_path: poster,
    backdrop_url: backdrop,
    backdrop_path: backdrop,
    genres: Array.isArray(payload.genres) ? payload.genres : [],
    origin_country: payload.countryOfOrigin || (mediaType === 'manhwa' ? 'KR' : 'JP'),
    status: normalizedStatus,
    total_episodes: episodesCount,
    episodes: episodesCount,
    total_chapters: chaptersCount,
    chapters: chaptersCount,
    total_volumes: volumesCount,
    volumes: volumesCount,
    anilist_id: numericId,
    mal_id: payload.idMal || null,
    tmdb_id: null,
    imdb_id: null,
  };
}

export type MediaItem = NormalizedCatalogItem;

export function normalizeTMDBMedia(payload: TmdbMoviePayload | TmdbTvPayload | any): NormalizedCatalogItem {
  if (!payload || typeof payload !== 'object') {
    return normalizeTmdbMovie(payload);
  }
  if (
    payload.media_type === 'tv' ||
    payload.number_of_episodes !== undefined ||
    payload.number_of_seasons !== undefined ||
    payload.name !== undefined
  ) {
    return normalizeTmdbTv(payload as TmdbTvPayload);
  }
  return normalizeTmdbMovie(payload as TmdbMoviePayload);
}

export const normalizeTmdbMedia = normalizeTMDBMedia;
