import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateWatchedEpisodesCount,
  logEpisodeProgress,
  logBatchEpisodeProgress,
  saveStoredLibraries,
} from '../../src/features/library/libraryService';
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

const mockMultiSeasonShow: NormalizedCatalogItem & { seasons: any[] } = {
  id: 'tv_test_seasons',
  media_type: 'tv',
  title: 'Multi Season Testing Show',
  original_title: null,
  release_year: 2024,
  release_date: '2024-01-01',
  synopsis: 'A test show with two seasons.',
  poster_url: null,
  backdrop_url: null,
  genres: ['Drama'],
  origin_country: 'US',
  status: 'released',
  total_episodes: 6,
  seasons: [
    {
      id: 'season_1',
      season_number: 1,
      name: 'Season 1',
      episode_count: 3,
      episodes: [
        { id: 'ep_s1_e1', episode_number: 1, name: 'S1 E1', runtime_minutes: 45, air_date: '2024-01-01' },
        { id: 'ep_s1_e2', episode_number: 2, name: 'S1 E2', runtime_minutes: 45, air_date: '2024-01-08' },
        { id: 'ep_s1_e3', episode_number: 3, name: 'S1 E3', runtime_minutes: 45, air_date: '2024-01-15' },
      ],
    },
    {
      id: 'season_2',
      season_number: 2,
      name: 'Season 2',
      episode_count: 3,
      episodes: [
        { id: 'ep_s2_e1', episode_number: 1, name: 'S2 E1', runtime_minutes: 45, air_date: '2024-02-01' },
        { id: 'ep_s2_e2', episode_number: 2, name: 'S2 E2', runtime_minutes: 45, air_date: '2024-02-08' },
        { id: 'ep_s2_e3', episode_number: 3, name: 'S2 E3', runtime_minutes: 45, air_date: '2024-02-15' },
      ],
    },
  ],
};

describe('Cross-Season State Isolation and Season Unmark Bulk Action', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. calculateWatchedEpisodesCount Season Isolation', () => {
    it('does not cross-count episodes with matching episode_number in different seasons', () => {
      // Watching S1E1 ('ep_s1_e1') should count as exactly 1 watched episode, not 2
      expect(calculateWatchedEpisodesCount(['ep_s1_e1'], mockMultiSeasonShow)).toBe(1);

      // Watching S1E1 and S2E1 should count as 2 distinct episodes
      expect(calculateWatchedEpisodesCount(['ep_s1_e1', 'ep_s2_e1'], mockMultiSeasonShow)).toBe(2);

      // Watching S1E1, S1E2, and S2E1
      expect(calculateWatchedEpisodesCount(['ep_s1_e1', 'ep_s1_e2', 'ep_s2_e1'], mockMultiSeasonShow)).toBe(3);
    });

    it('correctly maps global episode indexes (e.g. ep_4 for Season 2 Episode 1) without polluting Season 1', () => {
      // Season 1 has 3 episodes (1, 2, 3). Season 2 Episode 1 is global episode 4.
      expect(calculateWatchedEpisodesCount(['ep_4'], mockMultiSeasonShow)).toBe(1);
      // Watching both ep_1 (S1E1) and ep_4 (S2E1)
      expect(calculateWatchedEpisodesCount(['ep_1', 'ep_4'], mockMultiSeasonShow)).toBe(2);
    });
  });

  describe('2. logEpisodeProgress & logBatchEpisodeProgress Strict Season Boundary', () => {
    it('unmarking S2E1 does NOT remove S1E1 or any other season episode', async () => {
      const userId = 'user_cross_season_test';
      const libraryEntry = {
        id: 'lib_multi_1',
        user_id: userId,
        title_id: mockMultiSeasonShow.id,
        status: 'active' as const,
        rating: null,
        is_private: false,
        personal_notes: null,
        started_at: '2024-01-01',
        completed_at: null,
        last_progressed_at: '2024-01-01',
        episodes_watched: ['ep_s1_e1', 'ep_s2_e1'],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: mockMultiSeasonShow,
      };

      saveStoredLibraries([libraryEntry]);

      // Unmark S2E1
      const updated = await logEpisodeProgress({
        libraryId: 'lib_multi_1',
        userId,
        episodeId: 'ep_s2_e1',
        watched: false,
      });

      expect(updated.episodes_watched).toContain('ep_s1_e1');
      expect(updated.episodes_watched).not.toContain('ep_s2_e1');
      expect(updated.episodes_watched.length).toBe(1);
    });

    it('batch unmarking Season 2 preserves all Season 1 progress', async () => {
      const userId = 'user_unmark_season_test';
      const libraryEntry = {
        id: 'lib_multi_2',
        user_id: userId,
        title_id: mockMultiSeasonShow.id,
        status: 'active' as const,
        rating: null,
        is_private: false,
        personal_notes: null,
        started_at: '2024-01-01',
        completed_at: null,
        last_progressed_at: '2024-01-01',
        episodes_watched: ['ep_s1_e1', 'ep_s1_e2', 'ep_s1_e3', 'ep_s2_e1', 'ep_s2_e2'],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: mockMultiSeasonShow,
      };

      saveStoredLibraries([libraryEntry]);

      // Batch unmark Season 2 episodes
      const season2EpIds = ['ep_s2_e1', 'ep_s2_e2', 'ep_s2_e3'];
      const updated = await logBatchEpisodeProgress({
        libraryId: 'lib_multi_2',
        userId,
        episodeIds: season2EpIds,
        watched: false,
      });

      expect(updated.episodes_watched).toEqual(['ep_s1_e1', 'ep_s1_e2', 'ep_s1_e3']);
      expect(updated.status).toBe('active');
    });

    it('batch unmarking the only remaining watched season demotes status to planned', async () => {
      const userId = 'user_unmark_all_seasons_test';
      const libraryEntry = {
        id: 'lib_multi_3',
        user_id: userId,
        title_id: mockMultiSeasonShow.id,
        status: 'active' as const,
        rating: null,
        is_private: false,
        personal_notes: null,
        started_at: '2024-01-01',
        completed_at: null,
        last_progressed_at: '2024-01-01',
        episodes_watched: ['ep_s1_e1', 'ep_s1_e2'],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: mockMultiSeasonShow,
      };

      saveStoredLibraries([libraryEntry]);

      const updated = await logBatchEpisodeProgress({
        libraryId: 'lib_multi_3',
        userId,
        episodeIds: ['ep_s1_e1', 'ep_s1_e2'],
        watched: false,
      });

      expect(updated.episodes_watched).toEqual([]);
      expect(updated.status).toBe('planned');
    });

    it('batch marking the Full Show marks all episodes across all seasons and sets status to completed', async () => {
      const userId = 'user_full_show_mark_test';
      const libraryEntry = {
        id: 'lib_multi_full_show',
        user_id: userId,
        title_id: mockMultiSeasonShow.id,
        status: 'planned' as const,
        rating: null,
        is_private: false,
        personal_notes: null,
        started_at: null,
        completed_at: null,
        last_progressed_at: '2024-01-01',
        episodes_watched: ['ep_s1_e1'],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: mockMultiSeasonShow,
      };

      saveStoredLibraries([libraryEntry]);

      // All show episodes across both Season 1 and Season 2
      const allShowEpIds = [
        'ep_s1_e1', 'ep_s1_e2', 'ep_s1_e3',
        'ep_s2_e1', 'ep_s2_e2', 'ep_s2_e3'
      ];

      const updated = await logBatchEpisodeProgress({
        libraryId: 'lib_multi_full_show',
        userId,
        episodeIds: allShowEpIds,
        watched: true,
      });

      expect(updated.episodes_watched).toEqual(allShowEpIds);
      expect(updated.status).toBe('completed');
    });

    it('batch unmarking the Full Show unmarks all episodes across all seasons and demotes status to planned', async () => {
      const userId = 'user_full_show_unmark_test';
      const libraryEntry = {
        id: 'lib_multi_full_show_unmark',
        user_id: userId,
        title_id: mockMultiSeasonShow.id,
        status: 'completed' as const,
        rating: null,
        is_private: false,
        personal_notes: null,
        started_at: '2024-01-01',
        completed_at: '2024-02-15',
        last_progressed_at: '2024-02-15',
        episodes_watched: [
          'ep_s1_e1', 'ep_s1_e2', 'ep_s1_e3',
          'ep_s2_e1', 'ep_s2_e2', 'ep_s2_e3'
        ],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: mockMultiSeasonShow,
      };

      saveStoredLibraries([libraryEntry]);

      const allShowEpIds = [
        'ep_s1_e1', 'ep_s1_e2', 'ep_s1_e3',
        'ep_s2_e1', 'ep_s2_e2', 'ep_s2_e3'
      ];

      const updated = await logBatchEpisodeProgress({
        libraryId: 'lib_multi_full_show_unmark',
        userId,
        episodeIds: allShowEpIds,
        watched: false,
      });

      expect(updated.episodes_watched).toEqual([]);
      expect(updated.status).toBe('planned');
    });
  });

  describe('3. Catch Up / Mark Previous Episodes Prompt Condition Logic', () => {
    it('evaluates catch-up eligibility strictly between episode 2 and the penultimate episode', () => {
      // Helper replicating TitleDetailPage catch-up evaluation
      const shouldPromptCatchUp = (
        epNum: number,
        totalEpisodesInSeason: number,
        unmarkedPreviousCount: number
      ) => {
        const isBetweenTwoAndPenultimate =
          epNum >= 2 && (totalEpisodesInSeason > 0 ? epNum < totalEpisodesInSeason : false);
        return isBetweenTwoAndPenultimate && unmarkedPreviousCount > 0;
      };

      const seasonTotal = 10;

      // Episode 1 (first episode): never prompts catch-up
      expect(shouldPromptCatchUp(1, seasonTotal, 0)).toBe(false);

      // Episode 2: prompts catch-up if episode 1 is unmarked
      expect(shouldPromptCatchUp(2, seasonTotal, 1)).toBe(true);
      // Episode 2: does not prompt if previous is already marked
      expect(shouldPromptCatchUp(2, seasonTotal, 0)).toBe(false);

      // Middle episodes (3 through 9): prompt catch-up if earlier episodes unmarked
      expect(shouldPromptCatchUp(5, seasonTotal, 3)).toBe(true);
      expect(shouldPromptCatchUp(9, seasonTotal, 4)).toBe(true); // Penultimate episode 9

      // Episode 10 (finale / last episode): does not prompt catch-up (standard mark/complete)
      expect(shouldPromptCatchUp(10, seasonTotal, 5)).toBe(false);

      // In a 3-episode season (like Season 1 in mockMultiSeasonShow):
      // Ep 1 = first, Ep 2 = penultimate, Ep 3 = finale
      expect(shouldPromptCatchUp(1, 3, 0)).toBe(false);
      expect(shouldPromptCatchUp(2, 3, 1)).toBe(true);
      expect(shouldPromptCatchUp(3, 3, 2)).toBe(false);
    });
  });
});
