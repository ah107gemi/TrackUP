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
  countryOfOrigin?: string | null; // 'JP', 'KR', 'CN'
  description?: string | null;
  startDate?: { year?: number | null };
  coverImage?: { large?: string | null; extraLarge?: string | null };
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
    ? sanitizeUrl(`https://image.tmdb.org/t/p/w500${payload.poster_path}`)
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
    ? sanitizeUrl(`https://image.tmdb.org/t/p/w500${payload.poster_path}`)
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

export function normalizeAniListMedia(payload: AniListMediaPayload): NormalizedCatalogItem {
  let mediaType: MediaType;

  if (payload.type === 'MANGA') {
    // STRICT BLUEPRINT RULE:
    // countryOfOrigin: "KR" maps to manhwa, "JP" maps to manga
    if (payload.countryOfOrigin === 'KR') {
      mediaType = 'manhwa';
    } else {
      mediaType = 'manga';
    }
  } else {
    // ANIME
    if (payload.format === 'MOVIE') {
      mediaType = 'anime_film';
    } else {
      mediaType = 'anime_series';
    }
  }

  const title = payload.title.english || payload.title.romaji || 'Untitled';
  const originalTitle = payload.title.native || payload.title.romaji || null;

  const poster = sanitizeUrl(payload.coverImage?.extraLarge || payload.coverImage?.large);
  const backdrop = sanitizeUrl(payload.bannerImage);

  // Clean HTML tags from AniList synopsis if present
  const cleanDescription = payload.description
    ? payload.description.replace(/<[^>]*>/g, '').trim()
    : null;

  return {
    id: `anilist_${payload.id}`,
    media_type: mediaType,
    title,
    original_title: originalTitle,
    release_year: payload.startDate?.year || null,
    synopsis: cleanDescription,
    poster_url: poster,
    backdrop_url: backdrop,
    genres: payload.genres || [],
    origin_country: payload.countryOfOrigin || (mediaType === 'manhwa' ? 'KR' : 'JP'),
    status: payload.status || 'released',
    total_episodes: payload.episodes || null,
    total_chapters: payload.chapters || null,
    total_volumes: payload.volumes || null,
    anilist_id: payload.id,
    mal_id: payload.idMal || null,
    tmdb_id: null,
    imdb_id: null,
  };
}
