import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchUserCustomLists,
  createCustomList,
  updateCustomList,
  deleteCustomList,
  addTitleToList,
  removeTitleFromList,
  generateUUID,
  isValidUUID,
  saveStoredCustomLists,
} from '../../src/features/custom-lists/customListsService';

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

describe('Custom Lists Feature & Universal Media Association Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with a default curated starter list if user has no lists', async () => {
    const lists = await fetchUserCustomLists('user_alice');
    expect(lists).toHaveLength(1);
    expect(lists[0].name).toBe('All-Time Masterpieces');
    expect(lists[0].user_id).toBe('user_alice');
    expect(lists[0].items).toEqual([]);
  });

  it('creates a new custom list with custom name and description', async () => {
    const created = await createCustomList(
      'user_alice',
      'Cyberpunk & Dystopia',
      'Futuristic grit and neon aesthetics',
      false
    );

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Cyberpunk & Dystopia');
    expect(created.description).toBe('Futuristic grit and neon aesthetics');
    expect(created.is_private).toBe(false);

    const allLists = await fetchUserCustomLists('user_alice');
    expect(allLists.some((l) => l.name === 'Cyberpunk & Dystopia')).toBe(true);
  });

  it('updates and renames an existing custom list', async () => {
    const list = await createCustomList('user_alice', 'Original Name');
    const updated = await updateCustomList(list.id, {
      name: 'Renamed Sci-Fi Classics',
      description: 'Updated description',
      is_private: true,
    });

    expect(updated.name).toBe('Renamed Sci-Fi Classics');
    expect(updated.description).toBe('Updated description');
    expect(updated.is_private).toBe(true);
  });

  it('deletes a custom list', async () => {
    const list = await createCustomList('user_alice', 'To Be Deleted');
    const deleted = await deleteCustomList(list.id);
    expect(deleted).toBe(true);

    const allLists = await fetchUserCustomLists('user_alice');
    expect(allLists.some((l) => l.id === list.id)).toBe(false);
  });

  it('adds and removes multiple media types (movie, tv, anime, manga, manhwa)', async () => {
    const list = await createCustomList('user_alice', 'Mixed Media Vault');

    // Add Movie
    const movieItem = await addTitleToList(list.id, 'movie_inception_27205');
    expect(movieItem.title.media_type).toBe('movie');

    // Add TV Show
    const tvItem = await addTitleToList(list.id, 'tv_breaking_bad_1396');
    expect(tvItem.title.media_type).toBe('tv');

    // Add Anime Series
    const animeItem = await addTitleToList(list.id, 'anime_frieren_154587');
    expect(animeItem.title.media_type).toBe('anime_series');

    // Add Manga
    const mangaItem = await addTitleToList(list.id, 'manga_berserk_30002');
    expect(mangaItem.title.media_type).toBe('manga');

    // Add Manhwa
    const manhwaItem = await addTitleToList(list.id, 'manhwa_solo_leveling_105398');
    expect(manhwaItem.title.media_type).toBe('manhwa');

    // Verify 5 distinct media types in list
    const lists = await fetchUserCustomLists('user_alice');
    const currentList = lists.find((l) => l.id === list.id);
    expect(currentList?.items).toHaveLength(5);

    // Re-adding existing title should be idempotent (prevent duplicates)
    await addTitleToList(list.id, 'movie_inception_27205');
    const listsAfterDup = await fetchUserCustomLists('user_alice');
    const currentListAfterDup = listsAfterDup.find((l) => l.id === list.id);
    expect(currentListAfterDup?.items).toHaveLength(5);

    // Remove title from list
    const removed = await removeTitleFromList(list.id, 'movie_inception_27205');
    expect(removed).toBe(true);

    const listsAfterRemove = await fetchUserCustomLists('user_alice');
    const currentListAfterRemove = listsAfterRemove.find((l) => l.id === list.id);
    expect(currentListAfterRemove?.items).toHaveLength(4);
    expect(currentListAfterRemove?.items.some((i) => i.title_id === 'movie_inception_27205')).toBe(false);
  });

  it('enforces RFC 4122 UUID v4 formatting on list IDs and item IDs', async () => {
    // 0. Generator must produce valid UUID
    expect(isValidUUID(generateUUID())).toBe(true);

    // 1. Starter list must have valid UUID
    const starterLists = await fetchUserCustomLists('user_bob');
    expect(starterLists).toHaveLength(1);
    expect(isValidUUID(starterLists[0].id)).toBe(true);

    // 2. Created list must have valid UUID
    const created = await createCustomList('user_bob', 'Sci-Fi Universe');
    expect(isValidUUID(created.id)).toBe(true);

    // 3. Added item must have valid UUID
    const item = await addTitleToList(created.id, 'movie_inception_27205');
    expect(isValidUUID(item.id)).toBe(true);
    expect(isValidUUID(item.list_id)).toBe(true);
  });

  it('auto-heals legacy string IDs (list_... and item_...) into strict UUID v4 strings', async () => {
    // Simulate legacy non-UUID format saved previously in localStorage
    saveStoredCustomLists([
      {
        id: 'list_1731720394857_starter',
        user_id: 'user_carol',
        name: 'Legacy Non-UUID List',
        is_private: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [
          {
            id: 'item_1731720394857_abcd',
            list_id: 'list_1731720394857_starter',
            title_id: 'movie_inception_27205',
            display_order: 0,
            created_at: new Date().toISOString(),
            title: {
              id: 'movie_inception_27205',
              title: 'Inception',
              media_type: 'movie',
              genres: [],
            },
          },
        ],
      },
    ]);

    const healedLists = await fetchUserCustomLists('user_carol');
    expect(healedLists).toHaveLength(1);
    // Verified: list.id must be migrated to a valid UUID v4
    expect(isValidUUID(healedLists[0].id)).toBe(true);
    expect(healedLists[0].id).not.toContain('list_');
    // Verified: item.id and item.list_id must be migrated to valid UUIDs
    expect(isValidUUID(healedLists[0].items[0].id)).toBe(true);
    expect(healedLists[0].items[0].id).not.toContain('item_');
    expect(healedLists[0].items[0].list_id).toBe(healedLists[0].id);
  });
});
