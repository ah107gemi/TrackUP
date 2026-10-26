import { describe, it, expect, beforeEach } from 'vitest';
import { searchCatalog, getCatalogTitleById } from '../../src/features/catalog/catalogService';
import {
  upsertLibraryItem,
  fetchUserLibrary,
} from '../../src/features/library/libraryService';

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

describe('Live Catalog & API Integration Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retrieves live AniList results for anime series search', async () => {
    const results = await searchCatalog('Frieren', 'anime_series');
    expect(results.length).toBeGreaterThan(0);
    const hasFrieren = results.some((item) =>
      item.title.toLowerCase().includes('frieren')
    );
    expect(hasFrieren).toBe(true);
    expect(results[0].media_type).toBe('anime_series');
    expect(results[0].poster_url).toBeTruthy();
  }, 20000);

  it('retrieves live AniList results for manhwa search', async () => {
    const results = await searchCatalog('Solo Leveling', 'manhwa');
    expect(results.length).toBeGreaterThan(0);
    const solo = results.find((item) => item.id.includes('105398'));
    expect(solo).toBeDefined();
    expect(solo?.origin_country).toBe('KR');
  }, 20000);

  it('hydrates full title detail and cast for an AniList title by ID', async () => {
    const detail = await getCatalogTitleById('anilist_16498');
    expect(detail).not.toBeNull();
    expect(detail?.title).toContain('Attack on Titan');
    expect(detail?.cast).toBeDefined();
    expect(detail?.cast?.length).toBeGreaterThan(0);
    expect(detail?.related_title_ids).toBeDefined();
  }, 20000);

  it('falls back seamlessly to curated fixtures for movies without breaking', async () => {
    const results = await searchCatalog('Inception', 'movie');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Inception');
    expect(results[0].media_type).toBe('movie');
  }, 10000);

  it('persists live catalog items to user library without losing metadata', async () => {
    // 1. Search live anime
    const searchResults = await searchCatalog('Frieren', 'anime_series');
    expect(searchResults.length).toBeGreaterThan(0);
    const frieren = searchResults[0];

    // 2. Track in user library
    const tracked = await upsertLibraryItem({
      userId: 'user_live_test',
      titleId: frieren.id,
      status: 'active',
      titleData: frieren,
    });

    expect(tracked.title.title).toBe(frieren.title);
    expect(tracked.title.poster_url).toBe(frieren.poster_url);
    expect(tracked.title.media_type).toBe('anime_series');

    // 3. Re-fetch library from storage
    const userLib = await fetchUserLibrary('user_live_test');
    expect(userLib.length).toBe(1);
    expect(userLib[0].title.title).toBe(frieren.title);
    expect(userLib[0].title.title).not.toBe('Unknown Title');

    // 4. Verify user isolation (other user cannot see this item)
    const otherLib = await fetchUserLibrary('user_stranger');
    expect(otherLib.length).toBe(0);
  }, 20000);
});
