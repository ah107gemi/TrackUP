import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorBoundary } from '../../src/components/shared/ErrorBoundary';
import {
  toggleEpisode,
  logBatchEpisodeProgress,
  calculateTotalEpisodes,
  calculateWatchedEpisodesCount,
  saveStoredLibraries,
  type UserLibraryItem,
} from '../../src/features/library/libraryService';

// Mock localStorage for Node environment
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

describe('ErrorBoundary & Strict Null-Safety Audit', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. ErrorBoundary Component Logic', () => {
    it('initializes with hasError: false and error: null', () => {
      const boundary = new ErrorBoundary({ children: 'Test Child' });
      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBeNull();
    });

    it('updates state via getDerivedStateFromError when an error occurs', () => {
      const simulatedError = new TypeError("Cannot read properties of null (reading 'episodes_watched')");
      const newState = ErrorBoundary.getDerivedStateFromError(simulatedError);

      expect(newState.hasError).toBe(true);
      expect(newState.error).toBe(simulatedError);
      expect(newState.error?.message).toContain('episodes_watched');
    });

    it('logs error info gracefully in componentDidCatch without re-throwing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const boundary = new ErrorBoundary({ children: null });
      const testError = new Error('Fatal render failure');

      boundary.componentDidCatch(testError, { componentStack: 'in TitleDetailPage' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ErrorBoundary caught an unhandled rendering error]:',
        testError,
        { componentStack: 'in TitleDetailPage' }
      );
    });

    it('invokes onReset handler when reset is triggered', () => {
      const onResetMock = vi.fn();
      const boundary = new ErrorBoundary({ children: null, onReset: onResetMock });

      boundary.state = { hasError: true, error: new Error('Render crash') };
      boundary.handleReset();

      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBeNull();
      expect(onResetMock).toHaveBeenCalledTimes(1);
    });

    it('invokes onReset handler when handleReturnToLibrary is clicked', () => {
      const onResetMock = vi.fn();
      const boundary = new ErrorBoundary({ children: null, onReset: onResetMock });

      boundary.state = { hasError: true, error: new Error('Render crash') };
      boundary.handleReturnToLibrary();

      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBeNull();
      expect(onResetMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. libraryService Strict Null Safety on episodes_watched', () => {
    it('toggleEpisode safely handles a library item where episodes_watched is null or undefined', async () => {
      const userId = 'user_null_safety_1';
      const libraryId = 'lib_corrupted_1';

      // Corrupted library entry where episodes_watched is undefined/null
      const corruptedItem = {
        id: libraryId,
        user_id: userId,
        title_id: 'tv_test_title',
        status: 'active',
        rating: null,
        is_private: false,
        personal_notes: null,
        started_at: '2026-01-01',
        completed_at: null,
        last_progressed_at: '2026-01-01',
        episodes_watched: null as any, // Corrupted state from invalid database payload
        last_chapter_read: 0,
        last_volume_read: 0,
        title: {
          id: 'tv_test_title',
          media_type: 'tv',
          title: 'Test TV Show',
          total_episodes: 10,
          genres: ['Drama'],
        },
      } as unknown as UserLibraryItem;

      saveStoredLibraries([corruptedItem]);

      // Should not throw TypeError: Cannot read properties of null (reading 'includes')
      const result = await toggleEpisode({
        userId,
        episodeId: 'ep_1',
        libraryId,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.episodes_watched)).toBe(true);
      expect(result.episodes_watched).toContain('ep_1');
    });

    it('logBatchEpisodeProgress safely handles corrupted null episodes_watched', async () => {
      const userId = 'user_null_safety_2';
      const libraryId = 'lib_corrupted_2';

      const corruptedItem = {
        id: libraryId,
        user_id: userId,
        title_id: 'tv_test_batch',
        status: 'planned',
        rating: null,
        is_private: false,
        personal_notes: null,
        started_at: null,
        completed_at: null,
        last_progressed_at: '2026-01-01',
        episodes_watched: undefined as any, // Undefined episodes_watched
        last_chapter_read: 0,
        last_volume_read: 0,
        title: {
          id: 'tv_test_batch',
          media_type: 'tv',
          title: 'Batch Test',
          total_episodes: 5,
          genres: ['Comedy'],
        },
      } as unknown as UserLibraryItem;

      saveStoredLibraries([corruptedItem]);

      const result = await logBatchEpisodeProgress({
        libraryId,
        userId,
        episodeIds: ['ep_1', 'ep_2', 'ep_3'],
        watched: true,
      });

      expect(Array.isArray(result.episodes_watched)).toBe(true);
      expect(result.episodes_watched.length).toBe(3);
    });

    it('calculateWatchedEpisodesCount safely handles null, undefined, or missing title seasons', () => {
      // 1. null watchedEpisodes
      expect(calculateWatchedEpisodesCount(null as any, null)).toBe(0);

      // 2. undefined watchedEpisodes
      expect(calculateWatchedEpisodesCount(undefined as any, null)).toBe(0);

      // 3. title with null seasons or corrupted seasons array
      const titleWithCorruptedSeasons = {
        id: 't1',
        media_type: 'tv',
        title: 'Corrupted Seasons Title',
        genres: ['Action'],
        seasons: null as any,
      } as any;

      expect(calculateWatchedEpisodesCount(['ep_1', 'ep_2'], titleWithCorruptedSeasons)).toBe(2);

      // 4. season with undefined episodes
      const titleWithMissingEpisodes = {
        id: 't2',
        media_type: 'tv',
        title: 'Missing Episodes Title',
        genres: ['Action'],
        seasons: [
          {
            id: 's1',
            season_number: 1,
            name: 'Season 1',
            overview: null,
            episode_count: 5,
            episodes: undefined as any,
          },
        ],
      } as any;

      expect(calculateWatchedEpisodesCount(['ep_1'], titleWithMissingEpisodes)).toBe(1);
    });

    it('calculateTotalEpisodes safely handles titles with null or missing metadata', () => {
      expect(calculateTotalEpisodes(null)).toBe(0);
      expect(calculateTotalEpisodes(undefined)).toBe(0);
      expect(calculateTotalEpisodes({} as any)).toBe(0);

      const titleWithSeasons = {
        id: 'tv_show',
        media_type: 'tv',
        title: 'Show',
        genres: ['Drama'],
        seasons: [
          {
            id: 's1',
            season_number: 1,
            name: 'Season 1',
            episode_count: 10,
            overview: null,
            episodes: [],
          },
          {
            id: 's2',
            season_number: 2,
            name: 'Season 2',
            episode_count: 8,
            overview: null,
            episodes: [],
          },
        ],
      } as any;

      expect(calculateTotalEpisodes(titleWithSeasons)).toBe(18);
    });
  });
});
