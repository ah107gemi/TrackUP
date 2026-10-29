import type { NormalizedCatalogItem } from '../../lib/validators';
import {
  normalizeTmdbMovie,
  normalizeTmdbTv,
  type TmdbMoviePayload,
  type TmdbTvPayload,
} from './normalizers';
import type { CastMember, CatalogSeasonDetail } from './catalogService';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function getTmdbAuthHeader(): Record<string, string> | null {
  const token = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN;
  if (token && typeof token === 'string' && token.trim().length > 10) {
    return {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
  return null;
}

function getTmdbApiKeyParam(): string | null {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  if (key && typeof key === 'string' && key.trim().length > 5) {
    return `api_key=${encodeURIComponent(key.trim())}`;
  }
  return null;
}

export function isTmdbConfigured(): boolean {
  return !!getTmdbAuthHeader() || !!getTmdbApiKeyParam();
}

/**
 * Queries TMDB Multi-Search API (/search/multi) to search across movies and TV shows simultaneously,
 * returning accurately categorized media (movie, tv, anime_film, anime_series) with verified IDs and poster paths.
 */
export async function searchTmdbMulti(
  query: string
): Promise<NormalizedCatalogItem[]> {
  if (!isTmdbConfigured() || !query.trim()) {
    return [];
  }

  const authHeader = getTmdbAuthHeader();
  const apiKeyParam = getTmdbApiKeyParam();
  const headers = authHeader || { 'Content-Type': 'application/json', Accept: 'application/json' };
  const encodedQuery = encodeURIComponent(query.trim());
  const cleanQ = query.trim().toLowerCase();

  try {
    const url = `${TMDB_BASE_URL}/search/multi?query=${encodedQuery}${apiKeyParam ? `&${apiKeyParam}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const json = await res.json();
    const rawItems: any[] = json.results || [];

    // Filter to movie and tv only (exclude person)
    const validItems = rawItems.filter(
      (item) => item.media_type === 'movie' || item.media_type === 'tv'
    );

    // Exact match & popularity sorting
    validItems.sort((a, b) => {
      const aTitle = (a.title || a.name || '').toLowerCase();
      const bTitle = (b.title || b.name || '').toLowerCase();
      const aExact = aTitle === cleanQ ? 1 : 0;
      const bExact = bTitle === cleanQ ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const aStarts = aTitle.startsWith(cleanQ) ? 1 : 0;
      const bStarts = bTitle.startsWith(cleanQ) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      return (b.popularity || 0) - (a.popularity || 0);
    });

    return validItems.map((item) => {
      if (item.media_type === 'movie') {
        return normalizeTmdbMovie(item as TmdbMoviePayload);
      }
      return normalizeTmdbTv(item as TmdbTvPayload);
    });
  } catch (err) {
    console.warn('Failed to query TMDB Multi-Search API:', err);
    return [];
  }
}

/**
 * Searches TMDB for movies and TV shows if credentials are configured.
 */
export async function searchTmdb(
  query: string,
  type: 'movie' | 'tv' | 'all' = 'all'
): Promise<NormalizedCatalogItem[]> {
  if (!isTmdbConfigured() || !query.trim()) {
    return [];
  }

  const authHeader = getTmdbAuthHeader();
  const apiKeyParam = getTmdbApiKeyParam();
  const headers = authHeader || { 'Content-Type': 'application/json', Accept: 'application/json' };
  const encodedQuery = encodeURIComponent(query.trim());
  const cleanQ = query.trim().toLowerCase();

  const results: NormalizedCatalogItem[] = [];

  try {
    if (type === 'movie' || type === 'all') {
      const url = `${TMDB_BASE_URL}/search/movie?query=${encodedQuery}${apiKeyParam ? `&${apiKeyParam}` : ''}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        const movies: (TmdbMoviePayload & { popularity?: number })[] = json.results || [];
        // Sort by popularity descending with exact title match boost
        movies.sort((a, b) => {
          const aExact = a.title?.toLowerCase() === cleanQ ? 1 : 0;
          const bExact = b.title?.toLowerCase() === cleanQ ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;

          const aStarts = a.title?.toLowerCase().startsWith(cleanQ) ? 1 : 0;
          const bStarts = b.title?.toLowerCase().startsWith(cleanQ) ? 1 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;

          return (b.popularity || 0) - (a.popularity || 0);
        });
        results.push(...movies.map((m) => normalizeTmdbMovie(m)));
      }
    }

    if (type === 'tv' || type === 'all') {
      const url = `${TMDB_BASE_URL}/search/tv?query=${encodedQuery}${apiKeyParam ? `&${apiKeyParam}` : ''}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        const tvs: (TmdbTvPayload & { popularity?: number })[] = json.results || [];
        // Sort by popularity descending with exact title match boost (e.g. "Yellowstone")
        tvs.sort((a, b) => {
          const aExact = a.name?.toLowerCase() === cleanQ ? 1 : 0;
          const bExact = b.name?.toLowerCase() === cleanQ ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;

          const aStarts = a.name?.toLowerCase().startsWith(cleanQ) ? 1 : 0;
          const bStarts = b.name?.toLowerCase().startsWith(cleanQ) ? 1 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;

          return (b.popularity || 0) - (a.popularity || 0);
        });
        results.push(...tvs.map((t) => normalizeTmdbTv(t)));
      }
    }
  } catch (err) {
    console.warn('Failed to query TMDB API:', err);
  }

  return results;
}

/**
 * Fetches full details for a TMDB title by numeric ID.
 */
export async function fetchTmdbMediaById(
  id: number,
  type: 'movie' | 'tv'
): Promise<
  | (NormalizedCatalogItem & {
      cast?: CastMember[];
      seasons?: CatalogSeasonDetail[];
    })
  | null
> {
  if (!isTmdbConfigured()) {
    return null;
  }

  const authHeader = getTmdbAuthHeader();
  const apiKeyParam = getTmdbApiKeyParam();
  const headers = authHeader || { 'Content-Type': 'application/json', Accept: 'application/json' };

  try {
    const url = `${TMDB_BASE_URL}/${type}/${id}?append_to_response=credits${type === 'tv' ? ',season/1' : ''}${apiKeyParam ? `&${apiKeyParam}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const data = await res.json();

    const normalized =
      type === 'movie'
        ? normalizeTmdbMovie(data as TmdbMoviePayload)
        : normalizeTmdbTv(data as TmdbTvPayload);

    const cast: CastMember[] = (data.credits?.cast || []).slice(0, 10).map(
      (c: { id: number; name: string; character: string; profile_path: string | null }) => ({
        id: `tmdb_cast_${c.id}`,
        name: c.name,
        character: c.character || 'Cast',
        profile_url: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      })
    );

    let seasons: CatalogSeasonDetail[] | undefined = (normalized as any).seasons;
    if (type === 'tv' && data.seasons && (!seasons || seasons.length === 0)) {
      seasons = (data.seasons as {
        id: number;
        season_number: number;
        name: string;
        overview: string;
        episode_count: number;
      }[])
        .filter((s) => s.season_number > 0)
        .map((s) => {
          const baseDate = data.first_air_date ? new Date(data.first_air_date) : null;
          const count = s.episode_count || 0;
          return {
            id: `tmdb_season_${s.id}`,
            season_number: s.season_number,
            name: s.name || `Season ${s.season_number}`,
            overview: s.overview || null,
            episode_count: count,
            episodes: Array.from({ length: count }, (_, idx) => {
              let epAirDate: string | null = null;
              if (baseDate && !isNaN(baseDate.getTime())) {
                const epD = new Date(baseDate.getTime() + (s.season_number - 1) * 365 * 86400000 + idx * 7 * 86400000);
                epAirDate = epD.toISOString().split('T')[0];
              }
              return {
                id: `tmdb_ep_${s.season_number}_${idx + 1}`,
                episode_number: idx + 1,
                name: `Episode ${idx + 1}`,
                overview: null,
                runtime_minutes: 45,
                air_date: epAirDate,
              };
            }),
          };
        });
    }

    const totalEps =
      typeof data.number_of_episodes === 'number' && data.number_of_episodes > 0
        ? data.number_of_episodes
        : normalized.total_episodes;

    const totalSeas =
      typeof data.number_of_seasons === 'number' && data.number_of_seasons > 0
        ? data.number_of_seasons
        : seasons?.length || normalized.total_seasons;

    return {
      ...normalized,
      total_episodes: totalEps,
      episodes: totalEps,
      total_seasons: totalSeas,
      cast,
      seasons: seasons || (normalized as any).seasons,
    };
  } catch (err) {
    console.warn(`Failed to fetch TMDB details for ${type} ID ${id}:`, err);
    return null;
  }
}
