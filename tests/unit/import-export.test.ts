import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCsvFile,
  stageAndResolveRows,
  commitImportBatch,
  exportUserLibraryToCsv,
} from '../../src/features/import-export/importService';
import { detectPlatformPreset } from '../../src/features/import-export/parsers';
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

describe('Phase 5: Platform Parsers & Preset Detection', () => {
  it('detects platform presets correctly from CSV headers', () => {
    expect(detectPlatformPreset(['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating'])).toBe('letterboxd');
    expect(detectPlatformPreset(['Const', 'Your Rating', 'Date Rated', 'Title', 'Title Type'])).toBe('imdb');
    expect(detectPlatformPreset(['trakt_id', 'title', 'year', 'type', 'watched_at'])).toBe('trakt');
    expect(detectPlatformPreset(['series_title', 'series_type', 'my_watched_episodes', 'my_score', 'my_status'])).toBe('mal');
    expect(detectPlatformPreset(['title', 'year', 'status'])).toBe('generic');
  });

  it('parses Letterboxd CSV with star-to-point rating conversion (0.5-5.0 -> 1-10)', async () => {
    const letterboxdCsv = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-03-01,Inception,2010,https://boxd.it/1s2k,4.5,No,Sci-Fi,2024-03-01
2024-03-05,Interstellar,2014,https://boxd.it/3Wk,5.0,No,Space,2024-03-05
2024-03-10,The Dark Knight,2008,https://boxd.it/29x,3.5,Yes,Action,2024-03-10`;

    const { preset, rows } = await parseCsvFile(letterboxdCsv);
    expect(preset).toBe('letterboxd');
    expect(rows.length).toBe(3);

    // Inception: 4.5 stars -> 9 points
    expect(rows[0].rawTitle).toBe('Inception');
    expect(rows[0].year).toBe(2010);
    expect(rows[0].mediaType).toBe('movie');
    expect(rows[0].rating).toBe(9);
    expect(rows[0].status).toBe('completed');

    // Interstellar: 5.0 stars -> 10 points
    expect(rows[1].rating).toBe(10);

    // Dark Knight: Rewatch = Yes -> reconsuming
    expect(rows[2].status).toBe('reconsuming');
    expect(rows[2].rating).toBe(7);
  });

  it('parses MyAnimeList (MAL) CSV with episodes, chapters, and score mapping', async () => {
    const malCsv = `series_title,series_type,series_episodes,my_watched_episodes,my_score,my_status
Frieren: Beyond Journey's End,TV,28,28,10,2
Solo Leveling,Manhwa,179,120,9,1
Attack on Titan,TV,25,25,8,2`;

    const { preset, rows } = await parseCsvFile(malCsv);
    expect(preset).toBe('mal');
    expect(rows.length).toBe(3);

    // Anime: Frieren
    expect(rows[0].rawTitle).toContain('Frieren');
    expect(rows[0].mediaType).toBe('anime_series');
    expect(rows[0].status).toBe('completed');
    expect(rows[0].rating).toBe(10);
    expect(rows[0].episodesWatched).toBe(28);

    // Manhwa: Solo Leveling
    expect(rows[1].rawTitle).toBe('Solo Leveling');
    expect(rows[1].mediaType).toBe('manhwa');
    expect(rows[1].status).toBe('active'); // status code 1 = Watching/Reading
    expect(rows[1].rating).toBe(9);
    expect(rows[1].chaptersRead).toBe(120);
  });
});

describe('Phase 5: Resilient 7-Step Import Pipeline & Idempotency', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enforces idempotency: importing the exact same CSV twice does not create duplicate entries', async () => {
    const csvData = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-03-01,Inception,2010,https://boxd.it/1s2k,4.5,No,Sci-Fi,2024-03-01
2024-03-05,Interstellar,2014,https://boxd.it/3Wk,5.0,No,Space,2024-03-05`;

    const userId = 'user_idempotent_test';

    // 1st Run
    const { rows: firstRows } = await parseCsvFile(csvData);
    const firstStaged = await stageAndResolveRows(firstRows, []);
    expect(firstStaged.filter((s) => s.status === 'exact_match').length).toBe(2);

    const firstCommit = await commitImportBatch({
      userId,
      items: firstStaged,
      duplicatePolicy: 'skip',
    });
    expect(firstCommit.committed).toBe(2);
    expect(firstCommit.skipped).toBe(0);

    // Check stored libraries
    const storedAfterFirst = JSON.parse(localStorage.getItem('trackup_user_libraries') || '[]');
    expect(storedAfterFirst.length).toBe(2);

    // 2nd Run with exact same CSV
    const { rows: secondRows } = await parseCsvFile(csvData);
    const secondStaged = await stageAndResolveRows(secondRows, storedAfterFirst);

    // Both should now be detected as duplicates
    const duplicates = secondStaged.filter((s) => s.status === 'duplicate_in_library');
    expect(duplicates.length).toBe(2);

    // Committing with skip policy
    const secondCommit = await commitImportBatch({
      userId,
      items: secondStaged,
      duplicatePolicy: 'skip',
    });
    expect(secondCommit.committed).toBe(0);
    expect(secondCommit.skipped).toBe(2);

    // Stored items must remain exactly 2, zero duplicates!
    const storedAfterSecond = JSON.parse(localStorage.getItem('trackup_user_libraries') || '[]');
    expect(storedAfterSecond.length).toBe(2);
  });

  it('exports user library to a clean normalized CSV', () => {
    const mockLibrary: UserLibraryItem[] = [
      {
        id: 'lib_1',
        user_id: 'user_1',
        title_id: 'movie_inception_27205',
        status: 'completed',
        rating: 9,
        is_private: false,
        personal_notes: 'Must watch in IMAX',
        started_at: '2024-01-01T00:00:00Z',
        completed_at: '2024-01-02T00:00:00Z',
        last_progressed_at: '2024-01-02T00:00:00Z',
        episodes_watched: [],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: {
          id: 'movie_inception_27205',
          media_type: 'movie',
          title: 'Inception',
          release_year: 2010,
          genres: ['Action'],
          tmdb_id: 27205,
          imdb_id: 'tt1375666',
        },
      },
    ];

    const csvOutput = exportUserLibraryToCsv(mockLibrary);
    expect(csvOutput).toContain('Title');
    expect(csvOutput).toContain('Inception');
    expect(csvOutput).toContain('movie');
    expect(csvOutput).toContain('completed');
    expect(csvOutput).toContain('4.5'); // 9 pts -> 4.5 stars
    expect(csvOutput).toContain('tt1375666');
    expect(csvOutput).toContain('27205');
  });
});
