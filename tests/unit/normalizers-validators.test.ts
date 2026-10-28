import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from '../../src/lib/validators';
import {
  normalizeTmdbMovie,
  normalizeTmdbTv,
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
      expect(result.poster_url).toContain('https://image.tmdb.org/t/p/w342/');
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
  });
});
