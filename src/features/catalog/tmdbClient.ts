import type { NormalizedCatalogItem } from '../../lib/validators';
import {
  normalizeTmdbMovie,
  normalizeTmdbTv,
  type TmdbMoviePayload,
  type TmdbTvPayload,
} from './normalizers';
import type { CastMember, CatalogSeasonDetail } from './catalogService';
import { searchAniList, fetchAniListMediaById } from './anilistClient';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function normalizeFuzzyKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function calculateFuzzyMatchScore(candidate: string, query: string): number {
  const c = candidate.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (c === q) return 1000;
  const fC = normalizeFuzzyKey(c);
  const fQ = normalizeFuzzyKey(q);
  if (fC === fQ) return 900;
  if (c.startsWith(q)) return 500;
  if (fC.startsWith(fQ)) return 400;
  if (c.includes(q)) return 300;
  if (fC.includes(fQ)) return 200;
  return 0;
}

async function crossReferenceAnimeWithAniList(
  item: NormalizedCatalogItem,
  currentSeasons?: CatalogSeasonDetail[],
  currentTotalEps?: number | null
): Promise<{
  total_episodes: number | null;
  seasons?: CatalogSeasonDetail[];
  anilist_id?: number | null;
  mal_id?: number | null;
}> {
  const titlesToTry = [item.title, item.original_title].filter(
    (t): t is string => typeof t === 'string' && Boolean(t.trim())
  );

  for (const term of titlesToTry) {
    try {
      const aniMatches = await searchAniList(term, 'anime_series');
      if (aniMatches && aniMatches.length > 0) {
        const top = aniMatches[0];
        if (top.anilist_id) {
          const detail = await fetchAniListMediaById(top.anilist_id);
          if (detail) {
            const detailEps = detail.total_episodes || detail.episodes;
            const finalEps =
              detailEps && currentTotalEps
                ? Math.max(detailEps, currentTotalEps)
                : detailEps || currentTotalEps;
            return {
              total_episodes: finalEps ?? null,
              seasons:
                detail.seasons && detail.seasons.length > (currentSeasons?.length || 0)
                  ? detail.seasons
                  : currentSeasons,
              anilist_id: detail.anilist_id || top.anilist_id,
              mal_id: detail.mal_id || top.mal_id,
            };
          }
        }
      }
    } catch {
      // Continue to next term or Jikan
    }
  }

  // Fallback to Jikan if AniList had no matches or failed
  for (const term of titlesToTry) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(term)}&limit=1`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json();
        const hit = json?.data?.[0];
        if (hit && typeof hit.episodes === 'number' && hit.episodes > 0) {
          return {
            total_episodes: currentTotalEps ? Math.max(hit.episodes, currentTotalEps) : hit.episodes,
            seasons: currentSeasons,
            mal_id: typeof hit.mal_id === 'number' ? hit.mal_id : null,
          };
        }
      }
    } catch {
      // Non-blocking Jikan fallback
    }
  }

  return { total_episodes: currentTotalEps || null, seasons: currentSeasons };
}

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

    // Fuzzy match & popularity sorting
    validItems.sort((a, b) => {
      const aTitle = a.title || a.name || '';
      const bTitle = b.title || b.name || '';
      const scoreA = calculateFuzzyMatchScore(aTitle, query);
      const scoreB = calculateFuzzyMatchScore(bTitle, query);
      if (scoreA !== scoreB) return scoreB - scoreA;

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

  const results: NormalizedCatalogItem[] = [];

  try {
    if (type === 'movie' || type === 'all') {
      const url = `${TMDB_BASE_URL}/search/movie?query=${encodedQuery}${apiKeyParam ? `&${apiKeyParam}` : ''}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        const movies: (TmdbMoviePayload & { popularity?: number })[] = json.results || [];
        // Sort by popularity descending with fuzzy title match boost
        movies.sort((a, b) => {
          const scoreA = calculateFuzzyMatchScore(a.title || '', query);
          const scoreB = calculateFuzzyMatchScore(b.title || '', query);
          if (scoreA !== scoreB) return scoreB - scoreA;

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
        // Sort by popularity descending with fuzzy title match boost (e.g. "Yellowstone", "Dr. STONE")
        tvs.sort((a, b) => {
          const scoreA = calculateFuzzyMatchScore(a.name || '', query);
          const scoreB = calculateFuzzyMatchScore(b.name || '', query);
          if (scoreA !== scoreB) return scoreB - scoreA;

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
      const rawS = Array.isArray(data.seasons) ? data.seasons : [];
      let validS = rawS.filter((s: any) => typeof s.season_number === 'number' && s.season_number > 0);
      if (validS.length === 0 && rawS.length > 0) {
        const s0 = rawS.filter((s: any) => typeof s.episode_count === 'number' && s.episode_count > 0);
        if (s0.length > 0) validS = s0;
      }

      seasons = validS.map((s: any) => {
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

    const sumSeasonEpisodes = (seasons || []).reduce(
      (acc, s) => acc + (s.episode_count || s.episodes?.length || 0),
      0
    );
    const rawDataEpCount =
      typeof data.number_of_episodes === 'number' && data.number_of_episodes > 0
        ? data.number_of_episodes
        : null;

    let totalEps =
      rawDataEpCount && sumSeasonEpisodes > 0
        ? Math.max(rawDataEpCount, sumSeasonEpisodes)
        : rawDataEpCount || (sumSeasonEpisodes > 0 ? sumSeasonEpisodes : normalized.total_episodes);

    // If miniseries has no seasons parsed but totalEps is known (e.g. Dahmer with 10 episodes)
    if ((!seasons || seasons.length === 0) && totalEps && totalEps > 0) {
      seasons = [
        {
          id: `tmdb_season_${id}_1`,
          season_number: 1,
          name: normalized.title ? `${normalized.title} (Miniseries)` : 'Miniseries',
          overview: normalized.synopsis || null,
          episode_count: totalEps,
          episodes: Array.from({ length: totalEps }, (_, idx) => ({
            id: `tmdb_ep_${id}_1_${idx + 1}`,
            episode_number: idx + 1,
            name: `Episode ${idx + 1}`,
            overview: null,
            runtime_minutes: 50,
            air_date: normalized.release_date || null,
          })),
        },
      ];
    }

    let finalAnilistId = normalized.anilist_id;
    let finalMalId = normalized.mal_id;

    // Anime Fallback Cross-reference:
    // If the title is an anime and episode or multi-season data is sparse, cross-reference AniList or Jikan
    const isAnime =
      normalized.media_type === 'anime_series' ||
      (type === 'tv' &&
        (normalized.origin_country === 'JP' ||
          (normalized.genres || []).some(
            (g) => g.toLowerCase() === 'animation' || g.toLowerCase() === 'anime'
          )));

    if (isAnime && (!totalEps || !seasons || seasons.length <= 1)) {
      try {
        const crossRef = await crossReferenceAnimeWithAniList(normalized, seasons, totalEps);
        if (crossRef.total_episodes && (!totalEps || crossRef.total_episodes > totalEps)) {
          totalEps = crossRef.total_episodes;
        }
        if (crossRef.seasons && crossRef.seasons.length > (seasons?.length || 0)) {
          seasons = crossRef.seasons;
        }
        if (crossRef.anilist_id) finalAnilistId = crossRef.anilist_id;
        if (crossRef.mal_id) finalMalId = crossRef.mal_id;
      } catch (err) {
        console.warn(`[TMDB] Anime cross-reference fallback failed for ID ${id}:`, err);
      }
    }

    const totalSeas =
      typeof data.number_of_seasons === 'number' && data.number_of_seasons > 0
        ? Math.max(data.number_of_seasons, seasons?.length || 0)
        : seasons?.length || normalized.total_seasons;

    return {
      ...normalized,
      total_episodes: totalEps,
      episodes: totalEps,
      total_seasons: totalSeas,
      anilist_id: finalAnilistId,
      mal_id: finalMalId,
      cast,
      seasons: seasons || (normalized as any).seasons,
    };
  } catch (err) {
    console.warn(`Failed to fetch TMDB details for ${type} ID ${id}:`, err);
    return null;
  }
}
