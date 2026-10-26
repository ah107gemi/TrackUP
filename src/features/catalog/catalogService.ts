import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType, RelationshipType } from '../../types/database.types';
import { searchAniList, fetchAniListMediaById } from './anilistClient';
import { searchTmdb, fetchTmdbMediaById, isTmdbConfigured } from './tmdbClient';

export interface CatalogSeasonDetail {
  id: string;
  season_number: number;
  name: string;
  overview: string | null;
  episode_count: number;
  episodes: {
    id: string;
    episode_number: number;
    name: string;
    overview: string | null;
    runtime_minutes: number | null;
    air_date: string | null;
  }[];
}

export interface RelatedWorkItem {
  id: string;
  target_title: NormalizedCatalogItem;
  relationship_type: RelationshipType;
}

export interface CastMember {
  id: string;
  name: string;
  character: string;
  profile_url: string | null;
}

// Curated development fixtures representing all 6 categories
export const MOCK_CATALOG_FIXTURES: (NormalizedCatalogItem & {
  cast?: CastMember[];
  seasons?: CatalogSeasonDetail[];
  related_title_ids?: { targetId: string; type: RelationshipType }[];
})[] = [
  // 1. MOVIE
  {
    id: 'movie_inception_27205',
    media_type: 'movie',
    title: 'Inception',
    original_title: 'Inception',
    release_year: 2010,
    synopsis:
      'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible: "inception", the implantation of another person\'s idea into a target\'s subconscious.',
    poster_url: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/w1280/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    genres: ['Action', 'Science Fiction', 'Adventure'],
    origin_country: 'US',
    status: 'released',
    runtime_minutes: 148,
    tmdb_id: 27205,
    imdb_id: 'tt1375666',
    cast: [
      { id: 'c1', name: 'Leonardo DiCaprio', character: 'Dom Cobb', profile_url: null },
      { id: 'c2', name: 'Joseph Gordon-Levitt', character: 'Arthur', profile_url: null },
      { id: 'c3', name: 'Elliot Page', character: 'Ariadne', profile_url: null },
    ],
  },

  // 2. TV SHOW
  {
    id: 'tv_breaking_bad_1396',
    media_type: 'tv',
    title: 'Breaking Bad',
    original_title: 'Breaking Bad',
    release_year: 2008,
    synopsis:
      'Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of two years left to live. He chooses to enter the dangerous world of drugs and crime in order to secure his family\'s financial future.',
    poster_url: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    genres: ['Drama', 'Crime'],
    origin_country: 'US',
    status: 'ended',
    total_seasons: 5,
    total_episodes: 62,
    tmdb_id: 1396,
    imdb_id: 'tt0903747',
    cast: [
      { id: 'c4', name: 'Bryan Cranston', character: 'Walter White', profile_url: null },
      { id: 'c5', name: 'Aaron Paul', character: 'Jesse Pinkman', profile_url: null },
    ],
    seasons: [
      {
        id: 's1',
        season_number: 1,
        name: 'Season 1',
        overview: 'Walter White begins cooking methamphetamine.',
        episode_count: 7,
        episodes: [
          { id: 'e1', episode_number: 1, name: 'Pilot', overview: 'Walter decides to cook meth.', runtime_minutes: 58, air_date: '2008-01-20' },
          { id: 'e2', episode_number: 2, name: 'Cat\'s in the Bag...', overview: 'Walt and Jesse clean up a mess.', runtime_minutes: 48, air_date: '2008-01-27' },
          { id: 'e3', episode_number: 3, name: '...And the Bag\'s in the River', overview: 'Walt faces a moral dilemma.', runtime_minutes: 48, air_date: '2008-02-10' },
        ],
      },
      {
        id: 's2',
        season_number: 2,
        name: 'Season 2',
        overview: 'Walt and Jesse expand their distribution operation.',
        episode_count: 13,
        episodes: [
          { id: 'e4', episode_number: 1, name: 'Seven Thirty-Seven', overview: 'Walt calculates how much money he needs.', runtime_minutes: 47, air_date: '2009-03-08' },
        ],
      },
    ],
  },

  // 3. ANIME SERIES
  {
    id: 'anime_aot_1429',
    media_type: 'anime_series',
    title: 'Attack on Titan',
    original_title: '進撃の巨人',
    release_year: 2013,
    synopsis:
      'Several hundred years ago, humans were nearly exterminated by titans. A small percentage of humanity survived by barricading themselves in a city protected by extremely high walls. Today, a young boy named Eren and his sister Mikasa witness the destruction of that peace.',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg',
    backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg',
    genres: ['Animation', 'Action', 'Dark Fantasy'],
    origin_country: 'JP',
    status: 'completed',
    total_seasons: 4,
    total_episodes: 89,
    tmdb_id: 1429,
    anilist_id: 16498,
    mal_id: 16498,
    related_title_ids: [
      { targetId: 'manga_aot_30013', type: 'adaptation' },
    ],
    seasons: [
      {
        id: 'aot_s1',
        season_number: 1,
        name: 'Season 1: Fall of Shiganshina',
        overview: 'The Colossal Titan breaches Wall Maria.',
        episode_count: 25,
        episodes: [
          { id: 'aot_e1', episode_number: 1, name: 'To You, in 2000 Years', overview: 'The fall of Shiganshina district.', runtime_minutes: 24, air_date: '2013-04-07' },
          { id: 'aot_e2', episode_number: 2, name: 'That Day', overview: 'Eren, Mikasa, and Armin flee.', runtime_minutes: 24, air_date: '2013-04-14' },
        ],
      },
    ],
  },

  // 4. ANIME FILM
  {
    id: 'film_spirited_away_129',
    media_type: 'anime_film',
    title: 'Spirited Away',
    original_title: '千と千尋の神隠し',
    release_year: 2001,
    synopsis:
      'A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free herself and her family.',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199-sWefXJvXkDOb.jpg',
    backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/199-Sm2RU5PSqw7T.jpg',
    genres: ['Animation', 'Family', 'Fantasy'],
    origin_country: 'JP',
    status: 'released',
    runtime_minutes: 125,
    tmdb_id: 129,
    anilist_id: 199,
  },

  // 5. MANGA
  {
    id: 'manga_aot_30013',
    media_type: 'manga',
    title: 'Attack on Titan (Manga)',
    original_title: '進撃の巨人',
    release_year: 2009,
    synopsis:
      'The original manga masterpiece created by Hajime Isayama. Serialized in Bessatsu Shonen Magazine from 2009 to 2021 spanning 34 volumes and 139 chapters.',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg',
    backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/30013-hbbRZqC5MjYh.jpg',
    genres: ['Action', 'Mystery', 'Supernatural'],
    origin_country: 'JP',
    status: 'completed',
    total_chapters: 139,
    total_volumes: 34,
    anilist_id: 30013,
    mal_id: 23390,
    related_title_ids: [
      { targetId: 'anime_aot_1429', type: 'adaptation' },
    ],
  },

  // 6. MANHWA (South Korea)
  {
    id: 'manhwa_solo_leveling_105398',
    media_type: 'manhwa',
    title: 'Solo Leveling',
    original_title: '나 혼자만 레벨업',
    release_year: 2018,
    synopsis:
      'In a world where hunters must battle deadly monsters to protect humanity, Sung Jinwoo, known as "the weakest hunter of all mankind", finds himself in a fatal dual dungeon. He accepts a mysterious quest that turns him into a "player" with an unprecedented ability to level up infinitely.',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b673Vt5ZSuz3.jpg',
    backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg',
    genres: ['Action', 'Fantasy', 'Adventure'],
    origin_country: 'KR', // MANHWA SPECIFICATION
    status: 'completed',
    total_chapters: 179,
    total_volumes: 8,
    anilist_id: 105398,
    mal_id: 121496,
  },
];

export async function searchCatalog(
  query: string,
  mediaType: MediaType | 'all' = 'all'
): Promise<NormalizedCatalogItem[]> {
  const normalizedQuery = query.trim().toLowerCase();

  // 1. Local curated fixtures matching category & query
  const localMatches = MOCK_CATALOG_FIXTURES.filter((item) => {
    const matchesType = mediaType === 'all' || item.media_type === mediaType;
    if (!matchesType) return false;

    if (!normalizedQuery) return true;

    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      (item.original_title && item.original_title.toLowerCase().includes(normalizedQuery)) ||
      item.genres.some((g) => g.toLowerCase().includes(normalizedQuery))
    );
  });

  const seenIds = new Set<string>(localMatches.map((item) => item.id));
  const results: NormalizedCatalogItem[] = [...localMatches];

  // Only perform live external API queries if a search term of at least 2 characters is provided
  if (normalizedQuery.length < 2) {
    return results;
  }

  // 2. Query Live Providers
  const promises: Promise<NormalizedCatalogItem[]>[] = [];

  // A. AniList: covers anime_series, anime_film, manga, manhwa (Free, live, no API key needed)
  const isAnimeOrReading =
    mediaType === 'all' ||
    mediaType === 'anime_series' ||
    mediaType === 'anime_film' ||
    mediaType === 'manga' ||
    mediaType === 'manhwa';

  if (isAnimeOrReading) {
    promises.push(searchAniList(query, mediaType));
  }

  // B. TMDB: covers movie and tv (if API key / token configured)
  const isMovieOrTv = mediaType === 'all' || mediaType === 'movie' || mediaType === 'tv';
  if (isMovieOrTv && isTmdbConfigured()) {
    const tmdbType = mediaType === 'all' ? 'all' : mediaType;
    promises.push(searchTmdb(query, tmdbType));
  }

  if (promises.length > 0) {
    try {
      const settled = await Promise.allSettled(promises);
      for (const res of settled) {
        if (res.status === 'fulfilled') {
          for (const item of res.value) {
            // Deduplicate if already present from local fixtures
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              results.push(item);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching live catalog results:', err);
    }
  }

  return results;
}

export async function getCatalogTitleById(
  id: string
): Promise<
  | (NormalizedCatalogItem & {
      cast?: CastMember[];
      seasons?: CatalogSeasonDetail[];
      related_title_ids?: { targetId: string; type: RelationshipType }[];
    })
  | null
> {
  // 1. Check curated fixtures first
  const localMatch = MOCK_CATALOG_FIXTURES.find((f) => f.id === id);
  if (localMatch) {
    return localMatch;
  }

  // 2. AniList live hydration
  if (id.startsWith('anilist_')) {
    const numId = parseInt(id.replace('anilist_', ''), 10);
    if (!isNaN(numId)) {
      const liveAniList = await fetchAniListMediaById(numId);
      if (liveAniList) return liveAniList;
    }
  }

  // 3. TMDB live hydration
  if (id.startsWith('tmdb_movie_')) {
    const numId = parseInt(id.replace('tmdb_movie_', ''), 10);
    if (!isNaN(numId)) {
      const liveMovie = await fetchTmdbMediaById(numId, 'movie');
      if (liveMovie) return liveMovie;
    }
  }

  if (id.startsWith('tmdb_tv_')) {
    const numId = parseInt(id.replace('tmdb_tv_', ''), 10);
    if (!isNaN(numId)) {
      const liveTv = await fetchTmdbMediaById(numId, 'tv');
      if (liveTv) return liveTv;
    }
  }

  return null;
}

export async function getRelatedWorks(titleId: string): Promise<RelatedWorkItem[]> {
  const source = MOCK_CATALOG_FIXTURES.find((f) => f.id === titleId);
  if (!source || !source.related_title_ids) return [];

  const results: RelatedWorkItem[] = [];
  for (const rel of source.related_title_ids) {
    const target = MOCK_CATALOG_FIXTURES.find((f) => f.id === rel.targetId);
    if (target) {
      results.push({
        id: `${source.id}_${target.id}`,
        target_title: target,
        relationship_type: rel.type,
      });
    }
  }

  return results;
}
