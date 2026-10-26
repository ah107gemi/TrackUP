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
      startDate {
        year
      }
      description(asHtml: false)
      coverImage {
        extraLarge
        large
      }
      bannerImage
      genres
      episodes
      chapters
      volumes
      status
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
    startDate {
      year
    }
    description(asHtml: false)
    coverImage {
      extraLarge
      large
    }
    bannerImage
    genres
    episodes
    chapters
    volumes
    status
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
  const variables: Record<string, unknown> = {
    search: query.trim() || undefined,
    page,
    perPage,
  };

  if (mediaType === 'anime_series') {
    variables.type = 'ANIME';
    variables.format_in = ['TV', 'TV_SHORT', 'OVA', 'ONA'];
  } else if (mediaType === 'anime_film') {
    variables.type = 'ANIME';
    variables.format = 'MOVIE';
  } else if (mediaType === 'manga') {
    variables.type = 'MANGA';
    variables.countryOfOrigin = 'JP';
  } else if (mediaType === 'manhwa') {
    variables.type = 'MANGA';
    variables.countryOfOrigin = 'KR';
  }

  try {
    const response = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_MEDIA_QUERY,
        variables,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    const mediaList: AniListMediaPayload[] = json?.data?.Page?.media || [];

    return mediaList.map((item) => normalizeAniListMedia(item));
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

    // Synthesize season detail for anime series
    let seasons: CatalogSeasonDetail[] | undefined = undefined;
    if (normalized.media_type === 'anime_series' && normalized.total_episodes) {
      const epCount = Math.min(normalized.total_episodes, 24); // generate first season slice
      seasons = [
        {
          id: `anilist_${id}_s1`,
          season_number: 1,
          name: 'Season 1',
          overview: normalized.synopsis ?? null,
          episode_count: epCount,
          episodes: Array.from({ length: epCount }, (_, i) => ({
            id: `anilist_${id}_e${i + 1}`,
            episode_number: i + 1,
            name: `Episode ${i + 1}`,
            overview: null,
            runtime_minutes: 24,
            air_date: null,
          })),
        },
      ];
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
