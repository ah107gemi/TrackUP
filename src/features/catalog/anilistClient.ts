import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType, RelationshipType } from '../../types/database.types';
import { normalizeAniListMedia, type AniListMediaPayload } from './normalizers';
import type { CastMember, CatalogSeasonDetail } from './catalogService';

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

const SEARCH_MEDIA_QUERY = `
query ($search: String, $type: MediaType, $format_in: [MediaFormat], $format: MediaFormat, $countryOfOrigin: CountryCode, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      hasNextPage
    }
    media(search: $search, type: $type, format_in: $format_in, format: $format, countryOfOrigin: $countryOfOrigin, sort: [POPULARITY_DESC]) {
      id
      idMal
      type
      format
      countryOfOrigin
      title {
        romaji
        english
        native
      }
      synonyms
      startDate {
        year
        month
        day
      }
      description(asHtml: false)
      coverImage {
        extraLarge
        large
        medium
      }
      bannerImage
      genres
      episodes
      chapters
      volumes
      status
      relations {
        edges {
          relationType
          node {
            id
            type
            format
            title {
              english
              romaji
            }
          }
        }
      }
    }
  }
}
`;

/**
 * Broadest possible search query for Manga & Manhwa without any countryOfOrigin,
 * format_in, or status restrictions.
 */
const SEARCH_MANGA_QUERY = `
query ($search: String, $type: MediaType, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      hasNextPage
    }
    media(search: $search, type: $type, sort: [POPULARITY_DESC]) {
      id
      idMal
      type
      format
      countryOfOrigin
      title {
        romaji
        english
        native
      }
      synonyms
      startDate {
        year
        month
        day
      }
      description(asHtml: false)
      coverImage {
        extraLarge
        large
        medium
      }
      bannerImage
      genres
      episodes
      chapters
      volumes
      status
      relations {
        edges {
          relationType
          node {
            id
            type
            format
            title {
              english
              romaji
            }
          }
        }
      }
    }
  }
}
`;

const MEDIA_DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    idMal
    type
    format
    countryOfOrigin
    title {
      romaji
      english
      native
    }
    synonyms
    startDate {
      year
      month
      day
    }
    description(asHtml: false)
    coverImage {
      extraLarge
      large
      medium
    }
    bannerImage
    genres
    episodes
    chapters
    volumes
    status
    nextAiringEpisode {
      episode
      airingAt
      timeUntilAiring
    }
    airingSchedule(notYetAired: true, perPage: 25) {
      nodes {
        episode
        airingAt
        timeUntilAiring
      }
    }
    characters(perPage: 8, sort: [ROLE, RELEVANCE]) {
      nodes {
        id
        name {
          full
        }
        image {
          medium
        }
      }
    }
    relations {
      edges {
        relationType
        node {
          id
          type
          format
          countryOfOrigin
          title {
            english
            romaji
          }
          episodes
          description(asHtml: false)
          startDate {
            year
            month
            day
          }
          nextAiringEpisode {
            episode
            airingAt
            timeUntilAiring
          }
          airingSchedule(notYetAired: true, perPage: 25) {
            nodes {
              episode
              airingAt
              timeUntilAiring
            }
          }
        }
      }
    }
  }
}
`;

/**
 * Searches AniList for anime, anime films, manga, and manhwa.
 */
export async function searchAniList(
  query: string,
  mediaType: MediaType | 'all' = 'all',
  page: number = 1,
  perPage: number = 20
): Promise<NormalizedCatalogItem[]> {
  const isReading = mediaType === 'manga' || mediaType === 'manhwa';

  // For Manga & Manhwa: use SEARCH_MANGA_QUERY with stripped filters (no countryOfOrigin, no format_in, no status).
  // The ONLY variables passed are search: "user_query" and type: MANGA.
  const selectedQuery = isReading ? SEARCH_MANGA_QUERY : SEARCH_MEDIA_QUERY;

  let variables: Record<string, unknown>;

  if (isReading) {
    variables = {
      search: query.trim() || undefined,
      type: 'MANGA',
      page,
      perPage,
    };
  } else {
    variables = {
      search: query.trim() || undefined,
      type: 'ANIME',
      page,
      perPage,
    };

    if (mediaType === 'anime_series') {
      variables.type = 'ANIME';
      variables.format_in = ['TV', 'TV_SHORT', 'OVA', 'ONA'];
    } else if (mediaType === 'anime_film') {
      variables.type = 'ANIME';
      variables.format = 'MOVIE';
    }
  }

  try {
    console.log('[AniList GraphQL Request]', {
      endpoint: ANILIST_GRAPHQL_ENDPOINT,
      mediaType,
      isReading,
      variables,
    });

    const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        query: selectedQuery,
        variables,
      }),
    });

    if (!response.ok) {
      console.warn('[AniList GraphQL HTTP Error]', response.status, response.statusText);
      return [];
    }

    const json = await response.json();
    const mediaList: AniListMediaPayload[] = json?.data?.Page?.media || [];

    console.log('[AniList GraphQL Response]', {
      status: response.status,
      count: mediaList.length,
      payload: mediaList.map((m) => ({
        id: m.id,
        type: m.type,
        format: m.format,
        countryOfOrigin: m.countryOfOrigin,
        title: m.title,
        status: m.status,
        chapters: m.chapters,
      })),
    });

    // Franchise Grouping & Promo Filtering:
    // Filter out music videos, promo clips, and redundant sequels from primary search grid for ANIME only.
    // For Manga & Manhwa (isReading), do NOT drop any items!
    let filtered = mediaList;
    if (!isReading) {
      filtered = mediaList.filter((m) => {
        if (m.format === 'MUSIC') return false;
        const allTitles = [
          m.title?.english,
          m.title?.romaji,
          m.title?.native,
          ...(Array.isArray(m.synonyms) ? m.synonyms : []),
        ]
          .filter((t): t is string => typeof t === 'string' && Boolean(t))
          .map((t) => t.toLowerCase());

        const isPromoOrMv = allTitles.some(
          (t) =>
            t.includes('(music video)') ||
            t.includes('[music video]') ||
            t.includes('(mv)') ||
            t.includes('[mv]') ||
            t.includes('promo video') ||
            t.includes('promo clip') ||
            t.includes('teaser') ||
            t.includes('let you down')
        );
        if (isPromoOrMv && m.format !== 'TV' && m.format !== 'MOVIE') return false;
        return true;
      });

      const searchIds = new Set(filtered.map((m) => m.id));
      const sequelIds = new Set<number>();

      for (const m of filtered) {
        for (const edge of (m as any).relations?.edges || []) {
          if (!edge.node?.id || !searchIds.has(edge.node.id)) continue;

          if (edge.relationType === 'SEQUEL') {
            const target = filtered.find((x) => x.id === edge.node.id);
            if (target) {
              const targetTitle = (target.title?.english || target.title?.romaji || '').toLowerCase();
              const isExplicitSequel = /season|part\s*\d|final|2nd|3rd|4th|cour/i.test(targetTitle);
              if (isExplicitSequel || (m.format === 'TV' && target.format === 'TV')) {
                sequelIds.add(target.id);
              }
            }
          }
        }
      }
      filtered = filtered.filter((m) => !sequelIds.has(m.id));
    }

    // Sort by exact title match boost across romaji, english, native, and synonyms
    const cleanQ = query.trim().toLowerCase();
    if (cleanQ) {
      filtered.sort((a, b) => {
        const aTitles = [
          a.title?.english,
          a.title?.romaji,
          a.title?.native,
          ...(Array.isArray(a.synonyms) ? a.synonyms : []),
        ]
          .filter((t): t is string => typeof t === 'string' && Boolean(t))
          .map((t) => t.toLowerCase());

        const bTitles = [
          b.title?.english,
          b.title?.romaji,
          b.title?.native,
          ...(Array.isArray(b.synonyms) ? b.synonyms : []),
        ]
          .filter((t): t is string => typeof t === 'string' && Boolean(t))
          .map((t) => t.toLowerCase());

        const aExact = aTitles.some((t) => t === cleanQ) ? 1 : 0;
        const bExact = bTitles.some((t) => t === cleanQ) ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        const aStarts = aTitles.some((t) => t.startsWith(cleanQ)) ? 1 : 0;
        const bStarts = bTitles.some((t) => t.startsWith(cleanQ)) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;

        return 0;
      });
    }

    const preferredMediaType: MediaType | undefined =
      mediaType === 'manhwa'
        ? 'manhwa'
        : mediaType === 'manga'
        ? 'manga'
        : mediaType === 'anime_series'
        ? 'anime_series'
        : mediaType === 'anime_film'
        ? 'anime_film'
        : undefined;

    return filtered
      .map((item) => normalizeAniListMedia(item, preferredMediaType))
      .filter((item): item is NormalizedCatalogItem => item !== null && item !== undefined);
  } catch (err) {
    console.warn('Failed to query AniList API:', err);
    return [];
  }
}

/**
 * Fetches full details for an AniList title by numeric ID.
 */
export async function fetchAniListMediaById(
  id: number
): Promise<
  | (NormalizedCatalogItem & {
      cast?: CastMember[];
      seasons?: CatalogSeasonDetail[];
      related_title_ids?: { targetId: string; type: RelationshipType }[];
    })
  | null
> {
  try {
    const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        query: MEDIA_DETAIL_QUERY,
        variables: { id },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const media = json?.data?.Media;
    if (!media) return null;

    const normalized = normalizeAniListMedia(media);

    // Cast members
    const cast: CastMember[] = (media.characters?.nodes || []).map(
      (c: { id: number; name: { full: string }; image?: { medium?: string } }) => ({
        id: `char_${c.id}`,
        name: c.name?.full || 'Unknown',
        character: 'Cast',
        profile_url: c.image?.medium || null,
      })
    );

    // Relations (adaptations, sequels)
    const relatedTitleIds: { targetId: string; type: RelationshipType }[] = [];
    if (media.relations?.edges) {
      for (const edge of media.relations.edges) {
        if (!edge?.node?.id) continue;
        let relType: RelationshipType = 'other';
        const rawType = edge.relationType;
        if (rawType === 'ADAPTATION') relType = 'adaptation';
        else if (rawType === 'SEQUEL') relType = 'sequel';
        else if (rawType === 'PREQUEL') relType = 'prequel';
        else if (rawType === 'SIDE_STORY') relType = 'side_story';
        else if (rawType === 'SPIN_OFF') relType = 'spin_off';

        relatedTitleIds.push({
          targetId: `anilist_${edge.node.id}`,
          type: relType,
        });
      }
    }

    // Synthesize full multi-season details for anime series
    let seasons: CatalogSeasonDetail[] | undefined = undefined;
    if (normalized.media_type === 'anime_series') {
      const seasonList: CatalogSeasonDetail[] = [];
      const mainEpisodes =
        typeof media.episodes === 'number' && media.episodes > 0
          ? media.episodes
          : normalized.total_episodes || null;

      const s1EpCount = mainEpisodes || 12;

      // Primary Series / Season 1
      seasonList.push({
        id: `anilist_${id}_s1`,
        season_number: 1,
        name: 'Season 1',
        overview: normalized.synopsis ?? null,
        episode_count: s1EpCount,
        episodes: Array.from({ length: s1EpCount }, (_, i) => {
          const epNum = i + 1;
          const scheduleNode =
            media.airingSchedule?.nodes?.find((n: { episode: number; airingAt: number }) => n.episode === epNum) ||
            (media.nextAiringEpisode?.episode === epNum ? media.nextAiringEpisode : null);

          let epAirDate: string | null = null;
          if (scheduleNode?.airingAt) {
            epAirDate = new Date(scheduleNode.airingAt * 1000).toISOString().split('T')[0];
          } else if (media.startDate?.year) {
            const baseYear = media.startDate.year;
            const baseMonth = (media.startDate.month || 1) - 1;
            const baseDay = media.startDate.day || 1;
            const d = new Date(baseYear, baseMonth, baseDay + i * 7);
            epAirDate = d.toISOString().split('T')[0];
          }

          return {
            id: `anilist_${id}_e${epNum}`,
            episode_number: epNum,
            name: `Episode ${epNum}`,
            overview: null,
            runtime_minutes: 24,
            air_date: epAirDate,
          };
        }),
      });

      // Subsequent franchise seasons from SEQUEL relations
      if (media.relations?.edges) {
        let seasonNum = 2;
        for (const edge of media.relations.edges) {
          if (
            edge.relationType === 'SEQUEL' &&
            edge.node?.type === 'ANIME' &&
            edge.node?.id
          ) {
            const seq = edge.node;
            // Filter out MUSIC, SPECIAL, and promo clips so they never overwrite or pollute main series metadata
            if (seq.format === 'MUSIC' || seq.format === 'SPECIAL') continue;

            const seqTitle = seq.title?.english || seq.title?.romaji || '';
            const lowerTitle = seqTitle.toLowerCase();
            const isPromoOrMv =
              lowerTitle.includes('(music video)') ||
              lowerTitle.includes('[music video]') ||
              lowerTitle.includes('(mv)') ||
              lowerTitle.includes('[mv]') ||
              lowerTitle.includes('promo video') ||
              lowerTitle.includes('promo clip') ||
              lowerTitle.includes('teaser') ||
              lowerTitle.includes('commercial');
            if (isPromoOrMv) continue;

            const seqEpisodes =
              typeof seq.episodes === 'number' && seq.episodes > 0
                ? seq.episodes
                : 12;

            seasonList.push({
              id: `anilist_${seq.id}_s${seasonNum}`,
              season_number: seasonNum,
              name: `Season ${seasonNum}: ${seqTitle || `Season ${seasonNum}`}`,
              overview: seq.description || null,
              episode_count: seqEpisodes,
              episodes: Array.from({ length: seqEpisodes }, (_, i) => {
                const epNum = i + 1;
                const scheduleNode =
                  seq.airingSchedule?.nodes?.find((n: { episode: number; airingAt: number }) => n.episode === epNum) ||
                  (seq.nextAiringEpisode?.episode === epNum ? seq.nextAiringEpisode : null);

                let epAirDate: string | null = null;
                if (scheduleNode?.airingAt) {
                  epAirDate = new Date(scheduleNode.airingAt * 1000).toISOString().split('T')[0];
                } else if (seq.startDate?.year) {
                  const baseYear = seq.startDate.year;
                  const baseMonth = (seq.startDate.month || 1) - 1;
                  const baseDay = seq.startDate.day || 1;
                  const d = new Date(Date.UTC(baseYear, baseMonth, baseDay + i * 7));
                  epAirDate = d.toISOString().split('T')[0];
                }

                return {
                  id: `anilist_${seq.id}_e${epNum}`,
                  episode_number: epNum,
                  name: `Episode ${epNum}`,
                  overview: null,
                  runtime_minutes: 24,
                  air_date: epAirDate,
                };
              }),
            });
            seasonNum++;
          }
        }
      }

      seasons = seasonList;
      normalized.total_seasons = seasonList.length;

      // Preserve main series episode count without promo overwrite
      if (mainEpisodes) {
        if (seasonList.length === 1) {
          normalized.total_episodes = mainEpisodes;
          normalized.episodes = mainEpisodes;
        } else {
          const totalFranchiseEps = seasonList.reduce((acc, s) => acc + s.episode_count, 0);
          normalized.total_episodes = totalFranchiseEps;
          normalized.episodes = totalFranchiseEps;
        }
      }
    }

    return {
      ...normalized,
      cast,
      seasons,
      related_title_ids: relatedTitleIds,
    };
  } catch (err) {
    console.warn(`Failed to fetch AniList title details for ID ${id}:`, err);
    return null;
  }
}
