import { describe, it, expect, beforeEach } from 'vitest';
import {
  upsertLibraryItem,
  logBatchEpisodeProgress,
  getStoredLibraries,
  calculateTotalEpisodes,
  calculateWatchedEpisodesCount,
} from '../../src/features/library/libraryService';
import { useUIStore } from '../../src/stores/uiStore';
import type { NormalizedCatalogItem } from '../../src/lib/validators';

const mockStore: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, val: string) => {
    mockStore[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockStore[key];
  },
  clear: () => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  },
  key: (i: number) => Object.keys(mockStore)[i] || null,
  length: 0,
} as Storage;

const mockMovie: NormalizedCatalogItem = {
  id: 'movie_quick_add_inception',
  media_type: 'movie',
  title: 'Inception',
  original_title: 'Inception',
  release_year: 2010,
  release_date: '2010-07-16',
  synopsis: 'A thief who steals corporate secrets through the use of dream-sharing technology.',
  poster_url: 'https://image.tmdb.org/t/p/w500/test.jpg',
  backdrop_url: null,
  genres: ['Action', 'Sci-Fi'],
  origin_country: 'US',
  status: 'released',
  runtime_minutes: 148,
};

const mockTvShow: NormalizedCatalogItem & { seasons: any[] } = {
  id: 'tv_quick_add_breaking_bad',
  media_type: 'tv',
  title: 'Breaking Bad',
  original_title: 'Breaking Bad',
  release_year: 2008,
  release_date: '2008-01-20',
  synopsis: 'A high school chemistry teacher diagnosed with inoperable lung cancer.',
  poster_url: 'https://image.tmdb.org/t/p/w500/bb.jpg',
  backdrop_url: null,
  genres: ['Drama', 'Crime'],
  origin_country: 'US',
  status: 'ended',
  total_episodes: 7,
  seasons: [
    {
      id: 'season_1',
      season_number: 1,
      name: 'Season 1',
      episode_count: 7,
      episodes: [
        { id: 'ep_bb_s1_e1', episode_number: 1, name: 'Pilot', air_date: '2008-01-20' },
        { id: 'ep_bb_s1_e2', episode_number: 2, name: 'Cat\'s in the Bag...', air_date: '2008-01-27' },
        { id: 'ep_bb_s1_e3', episode_number: 3, name: '...And the Bag\'s in the River', air_date: '2008-02-10' },
        { id: 'ep_bb_s1_e4', episode_number: 4, name: 'Cancer Man', air_date: '2008-02-17' },
        { id: 'ep_bb_s1_e5', episode_number: 5, name: 'Gray Matter', air_date: '2008-02-24' },
        { id: 'ep_bb_s1_e6', episode_number: 6, name: 'Crazy Handful of Nothin\'', air_date: '2008-03-02' },
        { id: 'ep_bb_s1_e7', episode_number: 7, name: 'A No-Rough-Stuff-Type Deal', air_date: '2008-03-09' },
      ],
    },
  ],
};

describe('Quick Add Search & Inline Tracking Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ quickAddOpen: false });
  });

  describe('1. Quick Add UI Store Modal Trigger', () => {
    it('initializes with quickAddOpen false and allows toggling via setQuickAddOpen', () => {
      expect(useUIStore.getState().quickAddOpen).toBe(false);
      useUIStore.getState().setQuickAddOpen(true);
      expect(useUIStore.getState().quickAddOpen).toBe(true);
      useUIStore.getState().setQuickAddOpen(false);
      expect(useUIStore.getState().quickAddOpen).toBe(false);
    });
  });

  describe('2. Movie Quick Add Actions', () => {
    it('executes "Mark Watched" by upserting library item with completed status', async () => {
      const userId = 'user_qa_movie_1';
      const item = await upsertLibraryItem({
        userId,
        titleId: mockMovie.id,
        status: 'completed',
        titleData: mockMovie,
      });

      expect(item.status).toBe('completed');
      expect(item.title_id).toBe(mockMovie.id);
      expect(item.completed_at).toBeTruthy();

      const stored = getStoredLibraries();
      expect(stored.some((i) => i.title_id === mockMovie.id && i.status === 'completed')).toBe(true);
    });

    it('executes "Plan to Watch" by upserting library item with planned status', async () => {
      const userId = 'user_qa_movie_2';
      const item = await upsertLibraryItem({
        userId,
        titleId: mockMovie.id,
        status: 'planned',
        titleData: mockMovie,
      });

      expect(item.status).toBe('planned');
      expect(item.title_id).toBe(mockMovie.id);
      expect(item.episodes_watched).toEqual([]);
    });

    it('executes "Currently Watching" by normalizing watching status to active', async () => {
      const userId = 'user_qa_movie_3';
      const item = await upsertLibraryItem({
        userId,
        titleId: mockMovie.id,
        status: 'watching' as any,
        titleData: mockMovie,
      });

      expect(item.status).toBe('active');
      expect(item.started_at).toBeTruthy();
    });
  });

  describe('3. TV Show & Anime Quick Add Actions', () => {
    it('executes "Mark Completed" by setting completed status AND batch marking all episodes across all seasons', async () => {
      const userId = 'user_qa_tv_1';

      // 1. Initial upsert to create library entry
      const libraryEntry = await upsertLibraryItem({
        userId,
        titleId: mockTvShow.id,
        status: 'completed',
        titleData: mockTvShow,
      });

      expect(libraryEntry.status).toBe('completed');

      // 2. Collect all episodes across seasons
      const allShowEpIds: string[] = [];
      for (const season of mockTvShow.seasons) {
        for (const ep of season.episodes) {
          allShowEpIds.push(ep.id);
        }
      }

      expect(allShowEpIds.length).toBe(7);

      // 3. Batch mark all episodes as watched
      const batchResult = await logBatchEpisodeProgress({
        libraryId: libraryEntry.id,
        userId,
        episodeIds: allShowEpIds,
        watched: true,
      });

      expect(batchResult.status).toBe('completed');
      for (const id of allShowEpIds) {
        expect(batchResult.episodes_watched).toContain(id);
      }
      expect(calculateWatchedEpisodesCount(batchResult.episodes_watched, mockTvShow)).toBe(7);
      expect(calculateTotalEpisodes(mockTvShow)).toBe(7);
    });

    it('executes "Currently Watching" on TV show setting status to active', async () => {
      const userId = 'user_qa_tv_2';
      const item = await upsertLibraryItem({
        userId,
        titleId: mockTvShow.id,
        status: 'watching' as any,
        titleData: mockTvShow,
      });

      expect(item.status).toBe('active');
      expect(item.started_at).toBeTruthy();
    });

    it('executes "Plan to Watch" on TV show setting status to planned', async () => {
      const userId = 'user_qa_tv_3';
      const item = await upsertLibraryItem({
        userId,
        titleId: mockTvShow.id,
        status: 'planned',
        titleData: mockTvShow,
      });

      expect(item.status).toBe('planned');
      expect(item.episodes_watched).toEqual([]);
    });
  });

  describe('4. Strict Error Throwing & Auth Guards', () => {
    it('throws an explicit error when attempting to upsert without user session or user ID', async () => {
      await expect(
        upsertLibraryItem({
          userId: '',
          titleId: mockMovie.id,
          status: 'completed',
        })
      ).rejects.toThrow('User session not found. Please log in to manage your library.');
    });

    it('throws an explicit error when attempting to log batch episodes without user ID', async () => {
      await expect(
        logBatchEpisodeProgress({
          libraryId: 'some_lib_id',
          userId: '',
          episodeIds: ['ep_1'],
          watched: true,
        })
      ).rejects.toThrow('User session not found. Please log in to batch update episode progress.');
    });
  });
});
