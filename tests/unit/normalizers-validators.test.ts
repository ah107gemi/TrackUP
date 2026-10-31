import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from '../../src/lib/validators';
import {
  normalizeTmdbMovie,
  normalizeTmdbTv,
  normalizeTMDBMedia,
  normalizeAniListMedia,
  type TmdbMoviePayload,
  type TmdbTvPayload,
  type AniListMediaPayload,
} from '../../src/features/catalog/normalizers';

describe('Security & Normalization Layer (Phase 2)', () => {
  describe('URL Sanitizer (Strict XSS & Protocol Guard)', () => {
    it('accepts valid https and http URLs', () => {
      expect(sanitizeUrl('https://image.tmdb.org/t/p/w500/test.jpg')).toBe(
        'https://image.tmdb.org/t/p/w500/test.jpg'
      );
      expect(sanitizeUrl('http://s4.anilist.co/file/cover.png')).toBe(
        'http://s4.anilist.co/file/cover.png'
      );
    });

    it('accepts valid relative asset URLs', () => {
      expect(sanitizeUrl('/assets/trackup-logo.jpg')).toBe('/assets/trackup-logo.jpg');
    });

    it('rejects malicious javascript: pseudo-protocol URIs', () => {
      expect(sanitizeUrl("javascript:alert('XSS')")).toBeNull();
      expect(sanitizeUrl("JAVASCRIPT:alert('XSS')")).toBeNull();
      expect(sanitizeUrl("  javascript:alert(1)  ")).toBeNull();
      expect(sanitizeUrl("java\0script:alert(1)")).toBeNull();
    });

    it('rejects data: and vbscript: URIs', () => {
      expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBeNull();
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
    });

    it('handles null, undefined, and empty string safely', () => {
      expect(sanitizeUrl(null)).toBeNull();
      expect(sanitizeUrl(undefined)).toBeNull();
      expect(sanitizeUrl('')).toBeNull();
      expect(sanitizeUrl('   ')).toBeNull();
    });
  });

  describe('TMDB Normalizer', () => {
    it('normalizes standard Hollywood movie payload to media_type: movie', () => {
      const payload: TmdbMoviePayload = {
        id: 27205,
        title: 'Inception',
        overview: 'Dom Cobb steals corporate secrets...',
        release_date: '2010-07-16',
        poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
        backdrop_path: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
        genres: [{ id: 878, name: 'Science Fiction' }],
        original_language: 'en',
        runtime: 148,
        origin_country: ['US'],
      };

      const result = normalizeTmdbMovie(payload);
      expect(result.media_type).toBe('movie');
      expect(result.title).toBe('Inception');
      expect(result.release_year).toBe(2010);
      expect(result.runtime_minutes).toBe(148);
      expect(result.poster_url).toContain('https://image.tmdb.org/t/p/w500/');
    });

    it('classifies Japanese animation film as anime_film', () => {
      const payload: TmdbMoviePayload = {
        id: 129,
        title: 'Spirited Away',
        release_date: '2001-07-20',
        genres: [{ id: 16, name: 'Animation' }],
        original_language: 'ja',
        origin_country: ['JP'],
      };

      const result = normalizeTmdbMovie(payload);
      expect(result.media_type).toBe('anime_film');
      expect(result.release_year).toBe(2001);
    });

    it('normalizes TV show and extracts season/episode counts', () => {
      const payload: TmdbTvPayload = {
        id: 1396,
        name: 'Breaking Bad',
        first_air_date: '2008-01-20',
        number_of_seasons: 5,
        number_of_episodes: 62,
        genres: [{ id: 18, name: 'Drama' }],
        original_language: 'en',
      };

      const result = normalizeTmdbTv(payload);
      expect(result.media_type).toBe('tv');
      expect(result.total_seasons).toBe(5);
      expect(result.total_episodes).toBe(62);
      expect(result.episodes).toBe(62);

      const genericResult = normalizeTMDBMedia(payload);
      expect(genericResult.media_type).toBe('tv');
      expect(genericResult.total_episodes).toBe(62);
      expect(genericResult.episodes).toBe(62);
    });

    it('prepends TMDB poster_path with https://image.tmdb.org/t/p/w500 and handles relative paths for Yellowstone', () => {
      const payload: TmdbTvPayload = {
        id: 73586,
        name: 'Yellowstone',
        poster_path: '/peNC0eyc3TQJa6x4TdKIIIRizUT.jpg',
        backdrop_path: '/7F1s2e5v0QJk5yU7Xw2s2zX.jpg',
        number_of_episodes: 53,
        number_of_seasons: 5,
      };

      const result = normalizeTmdbTv(payload);
      expect(result.poster_url).toBe('https://image.tmdb.org/t/p/w500/peNC0eyc3TQJa6x4TdKIIIRizUT.jpg');
      expect(result.poster_path).toBe('https://image.tmdb.org/t/p/w500/peNC0eyc3TQJa6x4TdKIIIRizUT.jpg');
      expect(result.backdrop_url).toBe('https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg');
    });

    it('safely falls back to backdrop_path when poster_path is missing for TV shows like Yellowstone', () => {
      const payload: TmdbTvPayload = {
        id: 73586,
        name: 'Yellowstone',
        poster_path: null,
        backdrop_path: '/7F1s2e5v0QJk5yU7Xw2s2zX.jpg',
        number_of_episodes: 53,
        number_of_seasons: 5,
      };

      const result = normalizeTmdbTv(payload);
      expect(result.poster_url).toBe('https://image.tmdb.org/t/p/w500/7F1s2e5v0QJk5yU7Xw2s2zX.jpg');
      expect(result.poster_path).toBe('https://image.tmdb.org/t/p/w500/7F1s2e5v0QJk5yU7Xw2s2zX.jpg');
      expect(result.backdrop_url).toBe('https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg');
    });

    it('accurately maps TMDB multi-season array and total episode counts for shows like Yellowstone', () => {
      const payload: TmdbTvPayload = {
        id: 73586,
        name: 'Yellowstone',
        number_of_episodes: 53,
        number_of_seasons: 5,
        seasons: [
          { season_number: 1, episode_count: 9, name: 'Season 1' },
          { season_number: 2, episode_count: 10, name: 'Season 2' },
          { season_number: 3, episode_count: 10, name: 'Season 3' },
          { season_number: 4, episode_count: 10, name: 'Season 4' },
          { season_number: 5, episode_count: 14, name: 'Season 5' },
        ],
      };

      const result = normalizeTmdbTv(payload);
      expect(result.total_episodes).toBe(53);
      expect(result.episodes).toBe(53);
      expect(result.total_seasons).toBe(5);
      expect((result as any).seasons).toBeDefined();
      expect((result as any).seasons.length).toBe(5);
      expect((result as any).seasons[0].episode_count).toBe(9);
      expect((result as any).seasons[4].episode_count).toBe(14);
    });
  });

  describe('AniList GraphQL Normalizer (Strict CountryOfOrigin Mapping)', () => {
    it('maps countryOfOrigin: "KR" directly to manhwa', () => {
      const payload: AniListMediaPayload = {
        id: 105398,
        type: 'MANGA',
        countryOfOrigin: 'KR', // SOUTH KOREA
        title: {
          english: 'Solo Leveling',
          romaji: 'Na Honjaman Level Up',
          native: '나 혼자만 레벨업',
        },
        chapters: 179,
        volumes: 8,
        genres: ['Action', 'Fantasy'],
      };

      const result = normalizeAniListMedia(payload);
      expect(result.media_type).toBe('manhwa');
      expect(result.title).toBe('Solo Leveling');
      expect(result.total_chapters).toBe(179);
      expect(result.chapters).toBe(179);
      expect(result.origin_country).toBe('KR');
    });

    it('maps countryOfOrigin: "JP" to manga', () => {
      const payload: AniListMediaPayload = {
        id: 30013,
        type: 'MANGA',
        countryOfOrigin: 'JP', // JAPAN
        title: {
          english: 'Attack on Titan',
          romaji: 'Shingeki no Kyojin',
        },
        chapters: 139,
        volumes: 34,
      };

      const result = normalizeAniListMedia(payload);
      expect(result.media_type).toBe('manga');
      expect(result.total_chapters).toBe(139);
      expect(result.total_volumes).toBe(34);
      expect(result.origin_country).toBe('JP');
    });

    it('maps AniList anime movie to anime_film and strips HTML from synopsis', () => {
      const payload: AniListMediaPayload = {
        id: 199,
        type: 'ANIME',
        format: 'MOVIE',
        title: {
          english: 'Spirited Away',
        },
        description: 'Chihiro enters a <b>mysterious</b> world.<br><br>She must escape.',
        episodes: 1,
      };

      const result = normalizeAniListMedia(payload);
      expect(result.media_type).toBe('anime_film');
      expect(result.synopsis).toBe('Chihiro enters a mysterious world.She must escape.');
      expect(result.synopsis).not.toContain('<b>');
      expect(result.synopsis).not.toContain('<br>');
    });

    it('maps AniList anime series and maps episode counts correctly', () => {
      const payload: AniListMediaPayload = {
        id: 154587,
        type: 'ANIME',
        format: 'TV',
        title: {
          english: "Frieren: Beyond Journey's End",
        },
        episodes: 28,
      };

      const result = normalizeAniListMedia(payload);
      expect(result.media_type).toBe('anime_series');
      expect(result.total_episodes).toBe(28);
      expect(result.episodes).toBe(28);
    });

    it('forcefully normalizes incomplete AniList payloads and honors preferredType context', () => {
      // Missing title and country with preferredType manhwa
      const partialManhwa = {
        id: 99999,
        type: 'MANGA' as const,
        title: {},
      };
      const resultManhwa = normalizeAniListMedia(partialManhwa as any, 'manhwa');
      expect(resultManhwa).toBeDefined();
      expect(resultManhwa.id).toBe('anilist_99999');
      expect(resultManhwa.media_type).toBe('manhwa');
      expect(resultManhwa.title).toBe('Untitled');
      expect(resultManhwa.poster_url).toBe('/assets/trackup-logo.jpg');

      // Indeterminate media with preferredType manga
      const partialManga = {
        id: 88888,
        title: { romaji: 'Some Unknown Comic' },
      };
      const resultManga = normalizeAniListMedia(partialManga as any, 'manga');
      expect(resultManga.media_type).toBe('manga');
      expect(resultManga.title).toBe('Some Unknown Comic');

      // Null or corrupted payload fallback
      const corruptedResult = normalizeAniListMedia(null as any, 'manhwa');
      expect(corruptedResult).toBeDefined();
      expect(corruptedResult.media_type).toBe('manhwa');
      expect(corruptedResult.title).toBe('Untitled');
    });

    it('drills down into coverImage.extraLarge or coverImage.large returning the raw URL string for Frieren', () => {
      const payload: AniListMediaPayload = {
        id: 154587,
        type: 'ANIME',
        format: 'TV',
        title: {
          english: "Frieren: Beyond Journey's End",
          romaji: 'Sousou no Frieren',
        },
        coverImage: {
          extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg',
          large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587-qQTzQnEJJ3oB.jpg',
          medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx154587-qQTzQnEJJ3oB.jpg',
        },
        episodes: 28,
      };

      const result = normalizeAniListMedia(payload);
      expect(result.poster_url).toBe(
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg'
      );
      expect(result.total_episodes).toBe(28);
      expect(result.episodes).toBe(28);

      // Falls back to coverImage.large if extraLarge is absent
      const payloadLarge: AniListMediaPayload = {
        id: 154587,
        type: 'ANIME',
        format: 'TV',
        title: { english: 'Frieren' },
        coverImage: {
          large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587-qQTzQnEJJ3oB.jpg',
          medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx154587-qQTzQnEJJ3oB.jpg',
        },
      };
      const resultLarge = normalizeAniListMedia(payloadLarge);
      expect(resultLarge.poster_url).toBe(
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587-qQTzQnEJJ3oB.jpg'
      );
    });

    it('correctly maps AniList coverImage.extraLarge or coverImage.large to universal poster_url for Solo Leveling', () => {
      const payload: AniListMediaPayload = {
        id: 151807,
        type: 'ANIME',
        format: 'TV',
        title: {
          english: 'Solo Leveling',
          romaji: 'Ore dake Level Up na Ken',
        },
        coverImage: {
          extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png',
          large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx151807-it355ZgzquUd.png',
          medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx151807-it355ZgzquUd.png',
        },
        bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/151807-37yfQA3ym8PA.jpg',
        episodes: 12,
      };

      const result = normalizeAniListMedia(payload);
      expect(result.id).toBe('anilist_151807');
      expect(result.media_type).toBe('anime_series');
      expect(result.title).toBe('Solo Leveling');
      expect(result.poster_url).toBe('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png');
      expect(result.poster_path).toBe('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png');
      expect(result.total_episodes).toBe(12);
      expect(result.episodes).toBe(12);
    });
  });
});
