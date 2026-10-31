import { sanitizeUrl, type NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType, RelationshipType } from '../../types/database.types';
import { searchAniList, fetchAniListMediaById } from './anilistClient';
import { searchTmdb, fetchTmdbMediaById, isTmdbConfigured } from './tmdbClient';
import { buildTmdbImageUrl } from './normalizers';

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
    release_date: '2010-07-16',
    synopsis:
      'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible: "inception", the implantation of another person\'s idea into a target\'s subconscious.',
    poster_url: 'https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
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

  // 1b. MOVIE (Interstellar)
  {
    id: 'tmdb_movie_157336',
    media_type: 'movie',
    title: 'Interstellar',
    original_title: 'Interstellar',
    release_year: 2014,
    release_date: '2014-11-05',
    synopsis:
      'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    poster_url: 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    genres: ['Adventure', 'Drama', 'Science Fiction'],
    origin_country: 'US',
    status: 'released',
    runtime_minutes: 169,
    tmdb_id: 157336,
    imdb_id: 'tt0816692',
    cast: [
      { id: 'c_int_1', name: 'Matthew McConaughey', character: 'Cooper', profile_url: null },
      { id: 'c_int_2', name: 'Anne Hathaway', character: 'Brand', profile_url: null },
    ],
  },

  // 2. TV SHOW
  {
    id: 'tv_breaking_bad_1396',
    media_type: 'tv',
    title: 'Breaking Bad',
    original_title: 'Breaking Bad',
    release_year: 2008,
    release_date: '2008-01-20',
    synopsis:
      'Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of two years left to live. He chooses to enter the dangerous world of drugs and crime in order to secure his family\'s financial future.',
    poster_url: 'https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    genres: ['Drama', 'Crime'],
    origin_country: 'US',
    status: 'ended',
    total_seasons: 5,
    total_episodes: 62,
    episodes: 62,
    tmdb_id: 1396,
    imdb_id: 'tt0903747',
    cast: [
      { id: 'c4', name: 'Bryan Cranston', character: 'Walter White', profile_url: null },
      { id: 'c5', name: 'Aaron Paul', character: 'Jesse Pinkman', profile_url: null },
    ],
    seasons: [
      {
        id: 'bb_s1',
        season_number: 1,
        name: 'Season 1',
        overview: 'Walter White begins cooking methamphetamine.',
        episode_count: 7,
        episodes: [
          { id: 'bb_e1_1', episode_number: 1, name: 'Pilot', overview: 'Walter decides to cook meth.', runtime_minutes: 58, air_date: '2008-01-20' },
          { id: 'bb_e1_2', episode_number: 2, name: 'Cat\'s in the Bag...', overview: 'Walt and Jesse clean up a mess.', runtime_minutes: 48, air_date: '2008-01-27' },
          { id: 'bb_e1_3', episode_number: 3, name: '...And the Bag\'s in the River', overview: 'Walt faces a moral dilemma.', runtime_minutes: 48, air_date: '2008-02-10' },
          { id: 'bb_e1_4', episode_number: 4, name: 'Cancer Man', overview: 'Walt tells his family about cancer.', runtime_minutes: 48, air_date: '2008-02-17' },
          { id: 'bb_e1_5', episode_number: 5, name: 'Gray Matter', overview: 'Walt rejects Elliott and Gretchen\'s offer.', runtime_minutes: 48, air_date: '2008-02-24' },
          { id: 'bb_e1_6', episode_number: 6, name: 'Crazy Handful of Nothin\'', overview: 'Walt adopts the persona Heisenberg.', runtime_minutes: 48, air_date: '2008-03-02' },
          { id: 'bb_e1_7', episode_number: 7, name: 'A No-Rough-Stuff-Type Deal', overview: 'Walt and Jesse do business with Tuco.', runtime_minutes: 48, air_date: '2008-03-09' },
        ],
      },
      {
        id: 'bb_s2',
        season_number: 2,
        name: 'Season 2',
        overview: 'Walt and Jesse expand their distribution operation.',
        episode_count: 13,
        episodes: Array.from({ length: 13 }, (_, i) => ({
          id: `bb_e2_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'Seven Thirty-Seven' : `Episode ${i + 1}`,
          overview: 'Walt and Jesse navigate dangerous drug kingpins.',
          runtime_minutes: 47,
          air_date: new Date(Date.UTC(2009, 2, 8 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'bb_s3',
        season_number: 3,
        name: 'Season 3',
        overview: 'Walt enters an uneasy partnership with Gus Fring.',
        episode_count: 13,
        episodes: Array.from({ length: 13 }, (_, i) => ({
          id: `bb_e3_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'No Más' : `Episode ${i + 1}`,
          overview: 'The Cousins seek vengeance as Walt works the superlab.',
          runtime_minutes: 47,
          air_date: new Date(Date.UTC(2010, 2, 21 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'bb_s4',
        season_number: 4,
        name: 'Season 4',
        overview: 'Walt and Gus engage in a deadly chess match.',
        episode_count: 13,
        episodes: Array.from({ length: 13 }, (_, i) => ({
          id: `bb_e4_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'Box Cutter' : `Episode ${i + 1}`,
          overview: 'Tensions between Walt and Gus reach a boiling point.',
          runtime_minutes: 47,
          air_date: new Date(Date.UTC(2011, 6, 17 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'bb_s5',
        season_number: 5,
        name: 'Season 5',
        overview: 'Heisenberg ascends to total power before the empire collapses.',
        episode_count: 16,
        episodes: Array.from({ length: 16 }, (_, i) => ({
          id: `bb_e5_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'Live Free or Die' : i === 13 ? 'Ozymandias' : i === 15 ? 'Felina' : `Episode ${i + 1}`,
          overview: 'The final chapter of Walter White\'s rise and fall.',
          runtime_minutes: 48,
          air_date: new Date(Date.UTC(2012, 6, 15 + i * 7)).toISOString().split('T')[0],
        })),
      },
    ],
  },

  // 2b. TV SHOW (Yellowstone)
  {
    id: 'tmdb_tv_73586',
    media_type: 'tv',
    title: 'Yellowstone',
    original_title: 'Yellowstone',
    release_year: 2018,
    release_date: '2018-06-20',
    synopsis:
      'Follow the violent world of the Dutton family, who controls the largest contiguous ranch in the United States. Led by their patriarch John Dutton, the family defends their land against constant attack by land developers, an Indian reservation, and America\'s first National Park.',
    poster_url: 'https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg',
    poster_path: 'https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg',
    backdrop_path: 'https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg',
    genres: ['Western', 'Drama'],
    origin_country: 'US',
    status: 'returning series',
    total_seasons: 5,
    total_episodes: 53,
    episodes: 53,
    tmdb_id: 73586,
    imdb_id: 'tt4236770',
    cast: [
      { id: 'c_y1', name: 'Kevin Costner', character: 'John Dutton', profile_url: null },
      { id: 'c_y2', name: 'Kelly Reilly', character: 'Beth Dutton', profile_url: null },
      { id: 'c_y3', name: 'Cole Hauser', character: 'Rip Wheeler', profile_url: null },
    ],
    seasons: [
      {
        id: 'ys_s1',
        season_number: 1,
        name: 'Season 1',
        overview: 'The Dutton family battles to protect the Yellowstone ranch.',
        episode_count: 9,
        episodes: Array.from({ length: 9 }, (_, i) => ({
          id: `ys_e1_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'Daybreak' : `Episode ${i + 1}`,
          overview: 'John Dutton defends his land from land developers and the Broken Rock Reservation.',
          runtime_minutes: 50,
          air_date: new Date(Date.UTC(2018, 5, 20 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'ys_s2',
        season_number: 2,
        name: 'Season 2',
        overview: 'The Duttons face enemies from all sides with alliances challenged.',
        episode_count: 10,
        episodes: Array.from({ length: 10 }, (_, i) => ({
          id: `ys_e2_${i + 1}`,
          episode_number: i + 1,
          name: `Episode ${i + 1}`,
          overview: 'The battle for the Dutton land intensifies.',
          runtime_minutes: 50,
          air_date: new Date(Date.UTC(2019, 5, 19 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'ys_s3',
        season_number: 3,
        name: 'Season 3',
        overview: 'Market Equities seeks to buy the Dutton ranch for an airport.',
        episode_count: 10,
        episodes: Array.from({ length: 10 }, (_, i) => ({
          id: `ys_e3_${i + 1}`,
          episode_number: i + 1,
          name: `Episode ${i + 1}`,
          overview: 'New adversaries push the family to the brink of survival.',
          runtime_minutes: 50,
          air_date: new Date(Date.UTC(2020, 5, 21 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'ys_s4',
        season_number: 4,
        name: 'Season 4',
        overview: 'The Duttons coordinate retribution against those responsible for coordinated attacks.',
        episode_count: 10,
        episodes: Array.from({ length: 10 }, (_, i) => ({
          id: `ys_e4_${i + 1}`,
          episode_number: i + 1,
          name: `Episode ${i + 1}`,
          overview: 'Vengeance and family loyalty dominate Montana.',
          runtime_minutes: 50,
          air_date: new Date(Date.UTC(2021, 10, 7 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'ys_s5',
        season_number: 5,
        name: 'Season 5',
        overview: 'John Dutton takes office as Governor of Montana to defend the ranch.',
        episode_count: 14,
        episodes: Array.from({ length: 14 }, (_, i) => ({
          id: `ys_e5_${i + 1}`,
          episode_number: i + 1,
          name: `Episode ${i + 1}`,
          overview: 'The political and ranch battles reach their climax.',
          runtime_minutes: 50,
          air_date: new Date(Date.UTC(2022, 10, 13 + i * 7)).toISOString().split('T')[0],
        })),
      },
    ],
  },

  // 3. ANIME SERIES
  {
    id: 'anilist_anime_154587',
    media_type: 'anime_series',
    title: "Frieren: Beyond Journey's End",
    original_title: '葬送のフリーレン',
    release_year: 2023,
    release_date: '2023-09-29',
    synopsis: 'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about.',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg',
    backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-eJv5WJ8y.jpg',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    origin_country: 'JP',
    status: 'completed',
    total_seasons: 1,
    total_episodes: 28,
    episodes: 28,
    anilist_id: 154587,
    mal_id: 52991,
    seasons: [
      {
        id: 'frieren_s1',
        season_number: 1,
        name: 'Season 1',
        overview: 'Frieren begins her journey toward Ende.',
        episode_count: 28,
        episodes: Array.from({ length: 28 }, (_, i) => ({
          id: `frieren_e1_${i + 1}`,
          episode_number: i + 1,
          name: `Episode ${i + 1}`,
          overview: null,
          runtime_minutes: 24,
          air_date: '2023-09-29',
        })),
      },
    ],
  },

  {
    id: 'anime_aot_1429',
    media_type: 'anime_series',
    title: 'Attack on Titan',
    original_title: '進撃の巨人',
    release_year: 2013,
    release_date: '2013-04-07',
    synopsis:
      'Several hundred years ago, humans were nearly exterminated by titans. A small percentage of humanity survived by barricading themselves in a city protected by extremely high walls. Today, a young boy named Eren and his sister Mikasa witness the destruction of that peace.',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg',
    backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg',
    genres: ['Animation', 'Action', 'Dark Fantasy'],
    origin_country: 'JP',
    status: 'completed',
    total_seasons: 4,
    total_episodes: 89,
    episodes: 89,
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
        episodes: Array.from({ length: 25 }, (_, i) => ({
          id: `aot_e1_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'To You, in 2000 Years' : i === 1 ? 'That Day' : `Episode ${i + 1}`,
          overview: 'Eren, Mikasa, and Armin join the 104th Training Corps.',
          runtime_minutes: 24,
          air_date: new Date(Date.UTC(2013, 3, 7 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'aot_s2',
        season_number: 2,
        name: 'Season 2: Clash of the Titans',
        overview: 'Beast Titan emerges as Wall Rose is suspected breached.',
        episode_count: 12,
        episodes: Array.from({ length: 12 }, (_, i) => ({
          id: `aot_e2_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'Beast Titan' : i === 5 ? 'Warrior' : `Episode ${i + 1}`,
          overview: 'The Scout Regiment uncovers betrayal from within.',
          runtime_minutes: 24,
          air_date: new Date(Date.UTC(2017, 3, 1 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'aot_s3',
        season_number: 3,
        name: 'Season 3: Return to Shiganshina',
        overview: 'The battle to retake Wall Maria and reach the basement.',
        episode_count: 22,
        episodes: Array.from({ length: 22 }, (_, i) => ({
          id: `aot_e3_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'Smoke Signal' : i === 15 ? 'Hero' : i === 19 ? 'The Basement' : `Episode ${i + 1}`,
          overview: 'The Scouts reach the basement and discover the truth of the world.',
          runtime_minutes: 24,
          air_date: new Date(Date.UTC(2018, 6, 23 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'aot_s4',
        season_number: 4,
        name: 'The Final Season',
        overview: 'War with Marley begins across the sea.',
        episode_count: 30,
        episodes: Array.from({ length: 30 }, (_, i) => {
          let airDate = '2020-12-07';
          if (i < 16) {
            airDate = new Date(Date.UTC(2020, 11, 7 + i * 7)).toISOString().split('T')[0];
          } else if (i < 26) {
            airDate = new Date(Date.UTC(2022, 0, 9 + (i - 16) * 7)).toISOString().split('T')[0];
          } else if (i === 26) {
            airDate = '2026-10-31'; // in 5 days
          } else if (i === 27) {
            airDate = '2026-11-07'; // in 12 days
          } else if (i === 28) {
            airDate = '2026-11-14'; // in 19 days
          } else {
            airDate = '2026-11-21'; // in 26 days
          }
          return {
            id: `aot_e4_${i + 1}`,
            episode_number: i + 1,
            name:
              i === 0
                ? 'The Other Side of the Sea'
                : i === 4
                ? 'Declaration of War'
                : i === 26
                ? 'The Final Chapters: Special 1'
                : i === 29
                ? 'The Final Chapter: Climax Special'
                : `Episode ${i + 1}`,
            overview: 'The Rumbling begins as the fate of humanity hangs in the balance.',
            runtime_minutes: 24,
            air_date: airDate,
          };
        }),
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
    release_date: '2001-07-20',
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
    release_date: '2009-09-09',
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
    release_date: '2018-03-04',
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
    related_title_ids: [
      { targetId: 'anime_solo_leveling_151807', type: 'adaptation' },
    ],
  },

  // 7. POPULAR ANIME SERIES (Solo Leveling Anime)
  {
    id: 'anime_solo_leveling_151807',
    media_type: 'anime_series',
    title: 'Solo Leveling (Anime)',
    original_title: '俺だけレベルアップな件',
    release_year: 2024,
    release_date: '2024-01-07',
    synopsis:
      'In a world where hunters battle deadly monsters, Sung Jinwoo ascends through mysterious dungeons with an unprecedented power to level up infinitely.',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-33ppw6iGsN8C.jpg',
    backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-qUaUfV43l0mG.jpg',
    genres: ['Action', 'Adventure', 'Fantasy'],
    origin_country: 'JP',
    status: 'releasing',
    total_seasons: 2,
    total_episodes: 24,
    episodes: 24,
    anilist_id: 151807,
    related_title_ids: [
      { targetId: 'manhwa_solo_leveling_105398', type: 'adaptation' },
    ],
    seasons: [
      {
        id: 'sl_s1',
        season_number: 1,
        name: 'Season 1',
        overview: 'Jinwoo gains the System and begins his secret leveling up.',
        episode_count: 12,
        episodes: Array.from({ length: 12 }, (_, i) => ({
          id: `sl_e1_${i + 1}`,
          episode_number: i + 1,
          name: i === 0 ? 'I\'m Used to It' : i === 1 ? 'If I Had One More Chance' : `Episode ${i + 1}`,
          overview: 'Jinwoo survives the Cartenon Temple and wakes up in the hospital.',
          runtime_minutes: 24,
          air_date: new Date(Date.UTC(2024, 0, 7 + i * 7)).toISOString().split('T')[0],
        })),
      },
      {
        id: 'sl_s2',
        season_number: 2,
        name: 'Season 2: Arise from the Shadow',
        overview: 'Shadow Monarch Jinwoo commands his undead army against new S-rank gates.',
        episode_count: 12,
        episodes: Array.from({ length: 12 }, (_, i) => {
          const futureDates = [
            '2026-10-31', // in 5 days
            '2026-11-07', // in 12 days
            '2026-11-14', // in 19 days
            '2026-11-21', // in 26 days
            '2026-11-28', // in 33 days
            '2026-12-05',
            '2026-12-12',
            '2026-12-19',
            '2026-12-26',
            '2027-01-02',
            '2027-01-09',
            '2027-01-16',
          ];
          return {
            id: `sl_e2_${i + 1}`,
            episode_number: i + 1,
            name: i === 0 ? 'You Aren\'t E-Rank, Are You?' : `Episode ${i + 1}`,
            overview: 'The Shadow Army marches as Red Gate crises erupt across the world.',
            runtime_minutes: 24,
            air_date: futureDates[i] || '2026-11-07',
          };
        }),
      },
    ],
  },
];

export type SearchDomain = 'watch' | 'read';

/**
 * Standardizes title string for robust grouping & deduplication across providers.
 * Strips bracketed/parenthetical format tags (e.g., "(Anime)", "[TV]") and season/cour markers,
 * then strips punctuation and whitespace to allow fuzzy key matching.
 */
export function standardizeTitleKey(title: string): string {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    // Strip parenthetical/bracketed tags: (Anime), [Anime], (TV), (Series), (Movie), (Film), (Manga), (Manhwa), etc.
    .replace(
      /\s*[\(\[]\s*(anime\s*series|anime\s*film|anime|tv\s*show|tv\s*series|tv|series|movie|film|manga|manhwa|official|dub|sub)\s*[\)\]]/gi,
      ''
    )
    // Strip season, part, cour, release markers
    .replace(
      /\b(season\s*\d+|part\s*\d+|cour\s*\d+|final season|2nd season|3rd season|4th season|music video|mv|special|teaser)\b/gi,
      ''
    )
    // Strip non-alphanumeric characters
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks whether an item represents an anime (series or film).
 */
export function isAnimeItem(item: NormalizedCatalogItem): boolean {
  if (item.media_type === 'anime_series' || item.media_type === 'anime_film') {
    return true;
  }
  if (item.id.startsWith('anilist_') || item.id.startsWith('anime_') || !!item.anilist_id) {
    return true;
  }
  const isAnimation = item.genres.some((g) => {
    const lower = g.toLowerCase();
    return lower === 'animation' || lower === 'anime';
  });
  const isEastAsianOrigin =
    item.origin_country === 'JP' || item.origin_country === 'KR' || item.origin_country === 'CN';
  if (isAnimation && isEastAsianOrigin) {
    return true;
  }
  if (item.original_title && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(item.original_title)) {
    return true;
  }
  return false;
}

/**
 * Checks if a catalog item has a valid, non-empty, non-placeholder poster URL or path.
 */
export function hasValidPoster(item: NormalizedCatalogItem | null | undefined): boolean {
  if (!item) return false;
  const rawPoster = item.poster_url || (item as any).poster_path;
  if (!rawPoster || typeof rawPoster !== 'string') return false;
  const trimmed = rawPoster.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '/assets/trackup-logo.jpg'
  ) {
    return false;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('/assets/')) {
    return trimmed.length > 3 && !trimmed.endsWith('/');
  }
  return false;
}

/**
 * Resolves poster paths to fully qualified URLs by ensuring TMDB relative paths have the base image URL prepended.
 */
export function resolvePosterUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '/assets/trackup-logo.jpg'
  ) {
    return null;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return sanitizeUrl(trimmed);
  }
  if (trimmed.startsWith('/assets/')) {
    return trimmed;
  }
  return buildTmdbImageUrl(trimmed, 'w500');
}

/**
 * Calculates priority score for duplicate entries sharing the same title key:
 * - Prioritizes valid poster
 * - Prioritizes AniList for anime, TMDB for live-action
 * - Prioritizes curated fixtures with rich episodes list
 * - Prioritizes entries with total episodes/chapters count
 */
export function getItemPriorityScore(item: NormalizedCatalogItem, effectiveDomain: SearchDomain): number {
  let score = 0;

  if (hasValidPoster(item)) {
    score += 1000;
  }

  const isAnime = isAnimeItem(item);
  const isAniList = item.id.startsWith('anilist_') || item.id.startsWith('anime_') || !!item.anilist_id;
  const isTmdb = item.id.startsWith('tmdb_') || !!item.tmdb_id;

  if (effectiveDomain === 'watch') {
    if (isAnime) {
      if (isAniList) score += 500;
      else if (isTmdb) score += 100;
    } else {
      // Live-action (movie or tv show)
      if (isTmdb) score += 500;
      else if (isAniList) score += 100;
    }
  } else {
    // Reading domain (Manga / Manhwa)
    if (isAniList) score += 500;
  }

  if (MOCK_CATALOG_FIXTURES.some((f) => f.id === item.id)) {
    score += 250;
  }

  if (typeof item.total_episodes === 'number' && item.total_episodes > 0) {
    score += 50;
  }
  if (typeof item.total_chapters === 'number' && item.total_chapters > 0) {
    score += 50;
  }
  if (item.backdrop_url && item.backdrop_url !== '/assets/trackup-logo.jpg') {
    score += 25;
  }

  return score;
}

/**
 * Post-fetch quality check and deduplication:
 * 1. Quality Check: Discard results with null, undefined, empty, or placeholder poster paths.
 * 2. Ensure base image URL is correctly prepended.
 * 3. Deduplication: Group results by standardized title string and keep the highest priority entry.
 */
export function deduplicateAndFilterCatalogResults(
  items: NormalizedCatalogItem[],
  effectiveDomain: SearchDomain
): NormalizedCatalogItem[] {
  // 1. Quality Check: discard any results missing a valid poster path
  const qualityItems = items.filter((item) => {
    if (!item || !item.id || !item.title) return false;
    return hasValidPoster(item);
  });

  // 2. Prepend base image URL to any relative poster or backdrop paths
  for (const item of qualityItems) {
    const resolvedPoster = resolvePosterUrl(item.poster_url || (item as any).poster_path);
    if (resolvedPoster) {
      item.poster_url = resolvedPoster;
      item.poster_path = resolvedPoster;
    }
    if (item.backdrop_path && (!item.backdrop_url || !item.backdrop_url.startsWith('http'))) {
      const resolvedBackdrop = buildTmdbImageUrl(item.backdrop_path, 'w1280');
      if (resolvedBackdrop) {
        item.backdrop_url = resolvedBackdrop;
        item.backdrop_path = resolvedBackdrop;
      }
    }
  }

  // 3. Group by standardized title
  const groups = new Map<string, NormalizedCatalogItem[]>();
  for (const item of qualityItems) {
    const key = standardizeTitleKey(item.title) || item.id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  // 4. Select top-scoring item per group
  const deduplicated: NormalizedCatalogItem[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      group.sort(
        (a, b) =>
          getItemPriorityScore(b, effectiveDomain) - getItemPriorityScore(a, effectiveDomain)
      );
      deduplicated.push(group[0]);
    }
  }

  return deduplicated;
}

export async function searchCatalog(
  query: string,
  mediaType: MediaType | 'all' = 'all',
  domain?: SearchDomain
): Promise<NormalizedCatalogItem[]> {
  const normalizedQuery = query.trim().toLowerCase();

  const effectiveDomain: SearchDomain =
    domain ||
    (mediaType === 'manga' || mediaType === 'manhwa' ? 'read' : 'watch');

  // 1. Local curated fixtures matching domain, category & query
  const localMatches = MOCK_CATALOG_FIXTURES.filter((item) => {
    const isReadingItem = item.media_type === 'manga' || item.media_type === 'manhwa';

    if (effectiveDomain === 'watch' && isReadingItem) return false;
    if (effectiveDomain === 'read' && !isReadingItem) return false;

    const matchesType = mediaType === 'all' || item.media_type === mediaType;
    if (!matchesType) return false;

    if (!normalizedQuery) return true;

    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      (item.original_title && item.original_title.toLowerCase().includes(normalizedQuery)) ||
      item.genres.some((g) => g.toLowerCase().includes(normalizedQuery))
    );
  });

  const rawCandidates: NormalizedCatalogItem[] = [...localMatches];

  // 2. Query live providers if query is at least 2 characters
  if (normalizedQuery.length >= 2) {
    const promises: Promise<NormalizedCatalogItem[]>[] = [];

    if (effectiveDomain === 'read') {
      const readingType: MediaType = mediaType === 'manhwa' ? 'manhwa' : 'manga';
      promises.push(searchAniList(query, readingType));
    } else {
      const isAnime =
        mediaType === 'all' ||
        mediaType === 'anime_series' ||
        mediaType === 'anime_film';

      if (isAnime) {
        const animeType = mediaType === 'anime_film' ? 'anime_film' : 'anime_series';
        promises.push(searchAniList(query, animeType));
      }

      const isMovieOrTv = mediaType === 'all' || mediaType === 'movie' || mediaType === 'tv';
      if (isMovieOrTv && isTmdbConfigured()) {
        const tmdbType = mediaType === 'all' ? 'all' : mediaType;
        promises.push(searchTmdb(query, tmdbType));
      }
    }

    if (promises.length > 0) {
      try {
        const settled = await Promise.allSettled(promises);
        for (const res of settled) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            for (const item of res.value) {
              if (!item || !item.id) continue;
              const isReadingItem = item.media_type === 'manga' || item.media_type === 'manhwa';
              if (effectiveDomain === 'watch' && isReadingItem) continue;
              if (effectiveDomain === 'read' && !isReadingItem) continue;

              if (effectiveDomain === 'read') {
                if (mediaType === 'manhwa') {
                  item.media_type = 'manhwa';
                } else if (mediaType === 'manga') {
                  item.media_type = 'manga';
                } else if (item.origin_country === 'KR') {
                  item.media_type = 'manhwa';
                } else {
                  item.media_type = 'manga';
                }
              }

              // Preserve episodic total episode counts
              if (item.media_type === 'tv' || item.media_type === 'anime_series') {
                const epCount =
                  typeof item.total_episodes === 'number' && item.total_episodes > 0
                    ? item.total_episodes
                    : typeof (item as any).episodes === 'number' && (item as any).episodes > 0
                    ? (item as any).episodes
                    : null;
                if (epCount) {
                  item.total_episodes = epCount;
                  item.episodes = epCount;
                }
              }

              rawCandidates.push(item);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching live catalog results:', err);
      }
    }
  }

  // 3. Strict Post-Fetch Quality Filtering & Deduplication
  const deduplicated = deduplicateAndFilterCatalogResults(rawCandidates, effectiveDomain);

  // 4. Popularity & Relevance sorting: exact matches and prefix matches rank first
  if (normalizedQuery.length >= 2) {
    deduplicated.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();

      const aExact = aTitle === normalizedQuery ? 1 : 0;
      const bExact = bTitle === normalizedQuery ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const aStarts = aTitle.startsWith(normalizedQuery) ? 1 : 0;
      const bStarts = bTitle.startsWith(normalizedQuery) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      return 0;
    });
  }

  return deduplicated;
}

export async function searchWatchCatalog(
  query: string,
  category: 'all' | 'movie' | 'tv' | 'anime_series' | 'anime_film' = 'all'
): Promise<NormalizedCatalogItem[]> {
  return searchCatalog(query, category, 'watch');
}

export async function searchReadingCatalog(
  query: string,
  category: 'all' | 'manga' | 'manhwa' = 'all'
): Promise<NormalizedCatalogItem[]> {
  return searchCatalog(query, category, 'read');
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
  // 1. Live TMDB TV hydration: Always call full detail endpoint (/tv/{id}) for full seasons & episodes when configured
  if (id.startsWith('tmdb_tv_') || id.startsWith('tv_')) {
    const numId = parseInt(id.replace(/^(tmdb_tv_|tv_)/, ''), 10);
    if (!isNaN(numId) && isTmdbConfigured()) {
      const liveTv = await fetchTmdbMediaById(numId, 'tv');
      if (liveTv) return liveTv;
    }
  }

  // 2. Live TMDB Movie hydration
  if (id.startsWith('tmdb_movie_') || id.startsWith('movie_')) {
    const numId = parseInt(id.replace(/^(tmdb_movie_|movie_)/, ''), 10);
    if (!isNaN(numId) && isTmdbConfigured()) {
      const liveMovie = await fetchTmdbMediaById(numId, 'movie');
      if (liveMovie) return liveMovie;
    }
  }

  // 3. Live AniList hydration
  if (id.startsWith('anilist_')) {
    const numId = parseInt(id.replace('anilist_', ''), 10);
    if (!isNaN(numId)) {
      const liveAniList = await fetchAniListMediaById(numId);
      if (liveAniList) return liveAniList;
    }
  }

  // 4. Check curated fixtures fallback
  const localMatch = MOCK_CATALOG_FIXTURES.find((f) => f.id === id);
  if (localMatch) {
    return localMatch;
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
