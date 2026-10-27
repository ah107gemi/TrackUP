import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCsvFile,
  stageAndResolveRows,
  commitImportBatch,
} from '../../src/features/import-export/importService';
import {
  detectPlatformPreset,
  findColumnValue,
  normalizeStatus,
  normalizeMediaType,
  parseBingerRow,
  parseGenericRow,
} from '../../src/features/import-export/parsers';
import type { UserLibraryItem } from '../../src/features/library/libraryService';

// Node.js mock localStorage for unit tests
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

describe('Binger App & Universal Dynamic CSV Import', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('detectPlatformPreset & Column Fuzzy Matching', () => {
    it('detects Binger preset from typical Binger CSV headers', () => {
      expect(
        detectPlatformPreset(['Show', 'Year', 'Binge Status', 'Episodes Seen', 'Rating'])
      ).toBe('binger');

      expect(
        detectPlatformPreset(['Show', 'Episodes Watched', 'Rating', 'Date'])
      ).toBe('binger');
    });

    it('findColumnValue matches exact, case-insensitive, and punctuated headers', () => {
      const row = {
        'Show Name': 'Breaking Bad',
        'Episodes_Seen': '62',
        'BINGE-STATUS': 'Completed',
        'My Rating': '10',
      };

      expect(findColumnValue(row, ['show', 'show name', 'title'])).toBe('Breaking Bad');
      expect(findColumnValue(row, ['episodes seen', 'episodes watched'])).toBe('62');
      expect(findColumnValue(row, ['binge status', 'status'])).toBe('Completed');
      expect(findColumnValue(row, ['rating', 'my rating', 'score'])).toBe('10');
    });

    it('normalizes various status phrases to TrackUp TrackingStatus', () => {
      expect(normalizeStatus('Binging')).toBe('active');
      expect(normalizeStatus('Watching')).toBe('active');
      expect(normalizeStatus('In Progress')).toBe('active');
      expect(normalizeStatus('Completed')).toBe('completed');
      expect(normalizeStatus('Finished')).toBe('completed');
      expect(normalizeStatus('On Hold')).toBe('paused');
      expect(normalizeStatus('Paused')).toBe('paused');
      expect(normalizeStatus('Dropped')).toBe('dropped');
      expect(normalizeStatus('Plan to Watch')).toBe('planned');
    });

    it('normalizes media type correctly', () => {
      expect(normalizeMediaType('TV Series')).toBe('tv');
      expect(normalizeMediaType('Show')).toBe('tv');
      expect(normalizeMediaType('Movie')).toBe('movie');
      expect(normalizeMediaType('Anime')).toBe('anime_series');
      expect(normalizeMediaType('Manga')).toBe('manga');
      expect(normalizeMediaType('Manhwa')).toBe('manhwa');
    });
  });

  describe('Binger & Generic CSV Row Parsing', () => {
    it('parses Binger CSV row with show name, episodes seen, and binge status', () => {
      const bingerRow = {
        'Show': 'Breaking Bad',
        'Year': '2008',
        'Type': 'TV',
        'Binge Status': 'Completed',
        'Episodes Seen': '62',
        'Rating': '10',
      };

      const parsed = parseBingerRow(bingerRow, 0);
      expect(parsed).not.toBeNull();
      expect(parsed?.rawTitle).toBe('Breaking Bad');
      expect(parsed?.year).toBe(2008);
      expect(parsed?.mediaType).toBe('tv');
      expect(parsed?.status).toBe('completed');
      expect(parsed?.episodesWatched).toBe(62);
      expect(parsed?.rating).toBe(10);
    });

    it('parses generic row with unconventional column headers', () => {
      const oddRow = {
        'Item': 'Yellowstone',
        'Premiered': '2018',
        'Watch Status': 'Watching',
        'Seen Eps': '25',
        'Score': '9',
      };

      const parsed = parseGenericRow(oddRow, 0);
      expect(parsed).not.toBeNull();
      expect(parsed?.rawTitle).toBe('Yellowstone');
      expect(parsed?.year).toBe(2018);
      expect(parsed?.status).toBe('active');
      expect(parsed?.episodesWatched).toBe(25);
      expect(parsed?.rating).toBe(9);
    });

    it('parses full Binger CSV file content end-to-end', async () => {
      const bingerCsv = `Show,Year,Type,Binge Status,Episodes Seen,Rating
Breaking Bad,2008,TV,Completed,62,10
Yellowstone,2018,TV,Watching,25,9
Succession,2018,TV,Completed,39,10`;

      const { preset, rows } = await parseCsvFile(bingerCsv);
      expect(preset).toBe('binger');
      expect(rows.length).toBe(3);

      expect(rows[0].rawTitle).toBe('Breaking Bad');
      expect(rows[0].episodesWatched).toBe(62);
      expect(rows[0].status).toBe('completed');

      expect(rows[1].rawTitle).toBe('Yellowstone');
      expect(rows[1].episodesWatched).toBe(25);
      expect(rows[1].status).toBe('active');
    });
  });

  describe('Episode Progress & Watched Series Merging', () => {
    it('merges episode watch progress seamlessly when duplicatePolicy is "merge" or "fill"', async () => {
      const userId = 'user_binger_merge_test';

      // 1. Existing library item: Yellowstone with 10 episodes watched
      const initialEntry: UserLibraryItem = {
        id: 'lib_existing_1',
        user_id: userId,
        title_id: 'tmdb_tv_73586',
        status: 'active',
        rating: 8,
        is_private: false,
        personal_notes: null,
        started_at: '2026-01-01',
        completed_at: null,
        last_progressed_at: '2026-01-01',
        episodes_watched: ['ep_1', 'ep_2', 'ep_3', 'ep_4', 'ep_5', 'ep_6', 'ep_7', 'ep_8', 'ep_9', 'ep_10'],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: {
          id: 'tmdb_tv_73586',
          media_type: 'tv',
          title: 'Yellowstone',
          genres: ['Drama', 'Western'],
        },
      };

      localStorage.setItem('trackup_user_libraries', JSON.stringify([initialEntry]));

      // 2. Incoming CSV has 25 episodes watched and updated rating 9
      const csvData = `Show,Year,Type,Binge Status,Episodes Seen,Rating
Yellowstone,2018,TV,Watching,25,9`;

      const { rows } = await parseCsvFile(csvData);
      const staged = stageAndResolveRows(rows, [initialEntry]);

      expect(staged[0].status).toBe('duplicate_in_library');

      // 3. Commit batch with 'merge' policy
      const result = await commitImportBatch({
        userId,
        items: staged,
        duplicatePolicy: 'merge',
      });

      expect(result.committed).toBe(1);

      // Verify merged data in storage
      const saved = JSON.parse(localStorage.getItem('trackup_user_libraries') || '[]');
      expect(saved.length).toBe(1);
      const updated = saved[0];

      // Episodes should now contain 25 episodes
      expect(updated.episodes_watched.length).toBe(25);
      expect(updated.episodes_watched).toContain('ep_1');
      expect(updated.episodes_watched).toContain('ep_25');
      // Rating updated to 9
      expect(updated.rating).toBe(9);
    });
  });
});
