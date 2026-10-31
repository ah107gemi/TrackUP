import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isMetadataMissingImages,
  canHealTitle,
  healTitleMetadata,
} from '../../src/features/catalog/metadataHealer';
import {
  fetchUserLibrary,
  updateLibraryItem,
  saveStoredLibraries,
  type UserLibraryItem,
} from '../../src/features/library/libraryService';
import fs from 'fs';
import path from 'path';

// Mock localStorage for Node test runner
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  length: 0,
} as Storage;

describe('Active Metadata Healer & Public Library RLS Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Active Metadata Healer Detection (isMetadataMissingImages & canHealTitle)', () => {
    it('detects missing images when poster_url is null or empty', () => {
      const titleWithoutPoster = {
        id: 'tmdb_tv_73586',
        title: 'Yellowstone',
        poster_url: null,
        backdrop_url: 'https://image.tmdb.org/t/p/w1280/xyz.jpg',
      };
      expect(isMetadataMissingImages(titleWithoutPoster)).toBe(true);
    });

    it('detects missing images when poster is the default placeholder logo', () => {
      const titleWithFallbackLogo = {
        id: 'tmdb_movie_550',
        title: 'Fight Club',
        poster_url: '/assets/trackup-logo.jpg',
        backdrop_url: 'https://image.tmdb.org/t/p/w1280/xyz.jpg',
      };
      expect(isMetadataMissingImages(titleWithFallbackLogo)).toBe(true);
    });

    it('detects missing images when backdrop_url is null or empty', () => {
      const titleWithoutBackdrop = {
        id: 'anilist_154587',
        title: 'Frieren',
        poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg',
        backdrop_url: null,
      };
      expect(isMetadataMissingImages(titleWithoutBackdrop)).toBe(true);
    });

    it('returns false when both poster and backdrop are valid URLs', () => {
      const completeTitle = {
        id: 'tv_1396',
        title: 'Breaking Bad',
        poster_url: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        backdrop_url: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
      };
      expect(isMetadataMissingImages(completeTitle)).toBe(false);
    });

    it('canHealTitle returns true if title has missing images AND valid tmdb_id', () => {
      const csvImportItem = {
        id: 'imported_123',
        title: 'Yellowstone',
        tmdb_id: 73586,
        poster_url: null,
        backdrop_url: null,
      };
      expect(canHealTitle(csvImportItem)).toBe(true);
    });

    it('canHealTitle returns true if title has missing images AND valid anilist_id', () => {
      const csvImportItem = {
        id: 'imported_456',
        title: 'Solo Leveling',
        anilist_id: 151807,
        poster_url: '',
        backdrop_url: '',
      };
      expect(canHealTitle(csvImportItem)).toBe(true);
    });

    it('canHealTitle returns true if titleId has a tmdb or anilist prefix', () => {
      const itemWithPrefixedId = {
        id: 'tmdb_movie_27205',
        title: 'Inception',
        poster_url: null,
      };
      expect(canHealTitle(itemWithPrefixedId, 'tmdb_movie_27205')).toBe(true);
    });

    it('canHealTitle returns false if title has no external provider IDs to fetch from', () => {
      const unlinkedItem = {
        id: 'custom_uuid_999',
        title: 'Unknown Homemade Video',
        poster_url: null,
      };
      expect(canHealTitle(unlinkedItem, 'custom_uuid_999')).toBe(false);
    });
  });

  describe('2. Active Metadata Healer Execution (healTitleMetadata & updateLibraryItem)', () => {
    it('heals missing poster and backdrop for a title using getCatalogTitleById fixture fallback', async () => {
      const missingTitle = {
        id: 'tmdb_tv_73586',
        title: 'Yellowstone',
        tmdb_id: 73586,
        poster_url: null,
        backdrop_url: null,
      };

      const healed = await healTitleMetadata(missingTitle, 'tmdb_tv_73586');
      expect(healed).not.toBeNull();
      expect(healed?.poster_url).toContain('https://image.tmdb.org/t/p/w500');
      expect(healed?.backdrop_url).toContain('https://image.tmdb.org/t/p/w1280');
    });

    it('updateLibraryItem saves healed poster and backdrop permanently into local storage', async () => {
      const userId = 'user_test_healer';
      const titleId = 'tmdb_tv_73586';

      const initialItem: UserLibraryItem = {
        id: 'lib_healer_1',
        user_id: userId,
        title_id: titleId,
        status: 'active',
        rating: 9,
        is_private: false,
        personal_notes: null,
        started_at: '2026-01-01',
        completed_at: null,
        last_progressed_at: '2026-01-01',
        episodes_watched: ['ep_1'],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: {
          id: titleId,
          media_type: 'tv',
          title: 'Yellowstone',
          genres: ['Drama', 'Western'],
          poster_url: null,
          backdrop_url: null,
        },
      };

      saveStoredLibraries([initialItem]);

      const healedPoster = 'https://image.tmdb.org/t/p/w500/healed_poster.jpg';
      const healedBackdrop = 'https://image.tmdb.org/t/p/w1280/healed_backdrop.jpg';

      const updated = await updateLibraryItem({
        userId,
        titleId,
        poster_url: healedPoster,
        backdrop_url: healedBackdrop,
      });

      expect(updated).not.toBeNull();
      expect(updated?.title.poster_url).toBe(healedPoster);
      expect(updated?.title.backdrop_url).toBe(healedBackdrop);

      // Verify persistence via fetchUserLibrary
      const retrieved = await fetchUserLibrary(userId);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].title.poster_url).toBe(healedPoster);
      expect(retrieved[0].title.backdrop_url).toBe(healedBackdrop);
    });
  });

  describe('3. Public Library RLS Migration Integrity Check', () => {
    it('verifies 20261031000003_unlock_user_libraries_rls.sql includes public read policies for user_libraries and progress tables', () => {
      const migrationPath = path.resolve(
        __dirname,
        '../../supabase/migrations/20261031000003_unlock_user_libraries_rls.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf8');

      // 1. user_libraries public policy
      expect(sql).toContain('CREATE POLICY "Allow public read on libraries"');
      expect(sql).toContain('ON public.user_libraries FOR SELECT');
      expect(sql).toContain('USING (is_private = false);');

      // 2. user_episode_progress public read policy
      expect(sql).toContain('CREATE POLICY "Allow public read on episode progress"');
      expect(sql).toContain('ON public.user_episode_progress FOR SELECT');

      // 3. user_reading_progress public read policy
      expect(sql).toContain('CREATE POLICY "Allow public read on reading progress"');
      expect(sql).toContain('ON public.user_reading_progress FOR SELECT');

      // 4. catalog tables read policies
      expect(sql).toContain('CREATE POLICY "Catalog titles are publicly readable"');
      expect(sql).toContain('CREATE POLICY "Catalog seasons are publicly readable"');
      expect(sql).toContain('CREATE POLICY "Catalog episodes are publicly readable"');
    });
  });
});
