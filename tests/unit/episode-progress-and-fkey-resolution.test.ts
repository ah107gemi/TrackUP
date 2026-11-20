import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ensureAuthoritativeLibraryId,
  logEpisodeProgress,
  logBatchEpisodeProgress,
  upsertLibraryItem,
  fetchUserLibrary,
  getStoredLibraries,
  saveStoredLibraries,
  resolveNextEpisodeToWatch,
  type UserLibraryItem,
} from '../../src/features/library/libraryService';
import { supabase } from '../../src/lib/supabase';

// Mock localStorage for test environment
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

const TEST_USER_ID = '11111111-1111-4111-a111-111111111111';
const DB_AUTHORITATIVE_LIB_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const CLIENT_STALE_LIB_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const TEST_TITLE_ID = 'tmdb_tv_73586';

const createTestTitle = (overrides: Record<string, any> = {}) => ({
  id: TEST_TITLE_ID,
  title: 'Yellowstone',
  media_type: 'tv' as const,
  genres: [] as string[],
  ...overrides,
});

const createTestLibraryItem = (overrides: Partial<UserLibraryItem> = {}): UserLibraryItem => ({
  id: CLIENT_STALE_LIB_ID,
  user_id: TEST_USER_ID,
  title_id: TEST_TITLE_ID,
  status: 'active',
  rating: null,
  is_private: false,
  personal_notes: null,
  started_at: null,
  completed_at: null,
  last_progressed_at: '2026-11-20T12:00:00Z',
  episodes_watched: [],
  last_chapter_read: 0,
  last_volume_read: 0,
  title: createTestTitle(),
  ...overrides,
});

describe('Episode Progress & Foreign Key Constraint (user_episode_progress_library_id_fkey) Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Authoritative Library ID Resolution (ensureAuthoritativeLibraryId)', () => {
    it('resolves the authoritative Supabase id when a local item has a mismatched client UUID', async () => {
      // Mock active session
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      // Mock Supabase: user_libraries has DB_AUTHORITATIVE_LIB_ID
      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: DB_AUTHORITATIVE_LIB_ID,
                user_id: TEST_USER_ID,
                title_id: TEST_TITLE_ID,
                status: 'active',
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      // Local storage currently has CLIENT_STALE_LIB_ID
      saveStoredLibraries([
        createTestLibraryItem({
          episodes_watched: ['ep_1'],
        }),
      ]);

      const resolvedId = await ensureAuthoritativeLibraryId({
        userId: TEST_USER_ID,
        titleId: TEST_TITLE_ID,
        libraryId: CLIENT_STALE_LIB_ID,
      });

      // Must strictly return the DB authoritative ID, NOT the stale client ID
      expect(resolvedId).toBe(DB_AUTHORITATIVE_LIB_ID);

      // Local storage must be healed to match the authoritative DB id
      const stored = getStoredLibraries();
      expect(stored[0].id).toBe(DB_AUTHORITATIVE_LIB_ID);
      expect((stored[0] as any).legacy_id).toBe(CLIENT_STALE_LIB_ID);
    });

    it('guarantees parent user_libraries row creation in Supabase when not yet existing before episode writes', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      const NEW_PERSISTED_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // Row does NOT exist yet in Supabase
              error: null,
            }),
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue({
                  throwOnError: vi.fn().mockResolvedValue({
                    data: { id: NEW_PERSISTED_ID, user_id: TEST_USER_ID, title_id: TEST_TITLE_ID },
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const resolvedId = await ensureAuthoritativeLibraryId({
        userId: TEST_USER_ID,
        titleId: TEST_TITLE_ID,
        libraryId: CLIENT_STALE_LIB_ID,
        fallbackItem: { status: 'active' },
      });

      expect(resolvedId).toBe(NEW_PERSISTED_ID);
    });

    it('throws an explicit error and never falls back to unpersisted client UUID when Supabase upsert fails', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockReturnValue({
                  throwOnError: vi.fn().mockRejectedValue(new Error('Insert failed due to constraint violation')),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      await expect(
        ensureAuthoritativeLibraryId({
          userId: TEST_USER_ID,
          titleId: TEST_TITLE_ID,
          libraryId: CLIENT_STALE_LIB_ID,
        })
      ).rejects.toThrow('Insert failed due to constraint violation');
    });
  });

  describe('2. logEpisodeProgress & logBatchEpisodeProgress Strict Foreign Key Safety', () => {
    it('writes to user_episode_progress strictly using the authoritative Supabase library_id', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      let episodeProgressPayload: any = null;

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: DB_AUTHORITATIVE_LIB_ID,
                user_id: TEST_USER_ID,
                title_id: TEST_TITLE_ID,
              },
              error: null,
            }),
            update: vi.fn().mockReturnValue({
              match: vi.fn().mockReturnValue({
                throwOnError: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'user_episode_progress') {
          return {
            upsert: vi.fn().mockImplementation((payload: any) => {
              episodeProgressPayload = payload;
              return {
                throwOnError: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          } as any;
        }
        return {} as any;
      });

      // Seed local storage with a stale client UUID
      saveStoredLibraries([
        createTestLibraryItem({
          title: createTestTitle({ total_episodes: 47 }),
        }),
      ]);

      const updated = await logEpisodeProgress({
        libraryId: CLIENT_STALE_LIB_ID,
        userId: TEST_USER_ID,
        episodeId: 'ep_1',
        watched: true,
        titleId: TEST_TITLE_ID,
      });

      // The payload written to Supabase user_episode_progress MUST use DB_AUTHORITATIVE_LIB_ID
      expect(episodeProgressPayload).not.toBeNull();
      expect(episodeProgressPayload.library_id).toBe(DB_AUTHORITATIVE_LIB_ID);
      expect(episodeProgressPayload.library_id).not.toBe(CLIENT_STALE_LIB_ID);

      // The returned item and local storage must also reflect the authoritative id
      expect(updated.id).toBe(DB_AUTHORITATIVE_LIB_ID);
      const stored = getStoredLibraries();
      expect(stored[0].id).toBe(DB_AUTHORITATIVE_LIB_ID);
    });

    it('batch progress writes to user_episode_progress strictly using authoritative Supabase library_id', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      let batchPayload: any[] = [];

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: DB_AUTHORITATIVE_LIB_ID,
                user_id: TEST_USER_ID,
                title_id: TEST_TITLE_ID,
              },
              error: null,
            }),
            update: vi.fn().mockReturnValue({
              match: vi.fn().mockReturnValue({
                throwOnError: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'user_episode_progress') {
          return {
            upsert: vi.fn().mockImplementation((payload: any[]) => {
              batchPayload = payload;
              return {
                throwOnError: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          } as any;
        }
        return {} as any;
      });

      saveStoredLibraries([
        createTestLibraryItem({
          title: createTestTitle({ total_episodes: 47 }),
        }),
      ]);

      await logBatchEpisodeProgress({
        libraryId: CLIENT_STALE_LIB_ID,
        userId: TEST_USER_ID,
        episodeIds: ['ep_1', 'ep_2', 'ep_3'],
        watched: true,
        titleId: TEST_TITLE_ID,
      });

      expect(batchPayload.length).toBe(3);
      batchPayload.forEach((row) => {
        expect(row.library_id).toBe(DB_AUTHORITATIVE_LIB_ID);
        expect(row.library_id).not.toBe(CLIENT_STALE_LIB_ID);
      });
    });
  });

  describe('3. upsertLibraryItem & fetchUserLibrary Authoritative ID Preservation', () => {
    it('fetchUserLibrary preserves authoritative remoteItem.id when merging with stale local storage', async () => {
      saveStoredLibraries([
        createTestLibraryItem({
          episodes_watched: ['ep_1'],
        }),
      ]);

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: DB_AUTHORITATIVE_LIB_ID,
                    user_id: TEST_USER_ID,
                    title_id: TEST_TITLE_ID,
                    status: 'active',
                    rating: null,
                    is_private: false,
                    personal_notes: null,
                    private_notes: null,
                    started_at: null,
                    completed_at: null,
                    last_progressed_at: '2026-11-20T12:00:00Z',
                    catalog_titles: {
                      id: TEST_TITLE_ID,
                      title: 'Yellowstone',
                      media_type: 'tv',
                      genres: [],
                    },
                  },
                ],
                error: null,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const library = await fetchUserLibrary(TEST_USER_ID);
      expect(library.length).toBe(1);
      // Crucial: The library item must have DB_AUTHORITATIVE_LIB_ID, NOT CLIENT_STALE_LIB_ID
      expect(library[0].id).toBe(DB_AUTHORITATIVE_LIB_ID);

      // Local storage must also be healed
      const stored = getStoredLibraries();
      expect(stored[0].id).toBe(DB_AUTHORITATIVE_LIB_ID);
    });

    it('upsertLibraryItem retrieves and sets authoritative Supabase id when updating existing item', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      saveStoredLibraries([
        createTestLibraryItem({
          status: 'planned',
        }),
      ]);

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            update: vi.fn().mockReturnValue({
              match: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockReturnValue({
                    throwOnError: vi.fn().mockResolvedValue({
                      data: { id: DB_AUTHORITATIVE_LIB_ID },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await upsertLibraryItem({
        userId: TEST_USER_ID,
        titleId: TEST_TITLE_ID,
        status: 'active',
      });

      expect(result.id).toBe(DB_AUTHORITATIVE_LIB_ID);
      expect(result.id).not.toBe(CLIENT_STALE_LIB_ID);
      const stored = getStoredLibraries();
      expect(stored[0].id).toBe(DB_AUTHORITATIVE_LIB_ID);
    });
  });

  describe('4. resolveNextEpisodeToWatch Helper', () => {
    it('returns ep_1 when episodes_watched is empty', () => {
      const nextEp = resolveNextEpisodeToWatch({
        episodes_watched: [],
        title: createTestTitle(),
      });
      expect(nextEp).toBe('ep_1');
    });

    it('returns ep_2 when ep_1 has been watched', () => {
      const nextEp = resolveNextEpisodeToWatch({
        episodes_watched: ['ep_1'],
        title: createTestTitle(),
      });
      expect(nextEp).toBe('ep_2');
    });

    it('advances from the highest watched episode number rather than array length or filling gaps', () => {
      const nextEp = resolveNextEpisodeToWatch({
        episodes_watched: ['ep_1', 'ep_3', 'ep_4'],
        title: createTestTitle(),
      });
      expect(nextEp).toBe('ep_5');
    });

    it('resolves first unwatched episode from catalog season metadata when available', () => {
      const titleWithSeasons: any = createTestTitle({
        seasons: [
          {
            season_number: 1,
            episodes: [
              { id: 'tmdb_ep_101', episode_number: 1 },
              { id: 'tmdb_ep_102', episode_number: 2 },
              { id: 'tmdb_ep_103', episode_number: 3 },
            ],
          },
        ],
      });

      const nextEp = resolveNextEpisodeToWatch({
        episodes_watched: ['tmdb_ep_101'],
        title: titleWithSeasons,
      });
      expect(nextEp).toBe('tmdb_ep_102');
    });

    it('handles non-numeric episode IDs by incrementing past watched count', () => {
      const nextEp = resolveNextEpisodeToWatch({
        episodes_watched: ['custom_pilot', 'custom_second'],
        title: createTestTitle({ title: 'Show' }),
      });
      expect(nextEp).toBe('ep_3');
    });
  });

  describe('5. fetchUserLibrary Remote Hydration from user_episode_progress and user_reading_progress', () => {
    it('hydrates episodes_watched and reading progress from Supabase tables', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: DB_AUTHORITATIVE_LIB_ID,
                    user_id: TEST_USER_ID,
                    title_id: TEST_TITLE_ID,
                    status: 'active',
                    catalog_titles: {
                      id: TEST_TITLE_ID,
                      title: 'Yellowstone',
                      media_type: 'tv',
                      genres: [],
                    },
                  },
                ],
                error: null,
              }),
            }),
          } as any;
        }
        if (table === 'user_episode_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    { library_id: DB_AUTHORITATIVE_LIB_ID, episode_id: 'ep_1', watched: true },
                    { library_id: DB_AUTHORITATIVE_LIB_ID, episode_id: 'ep_2', watched: true },
                  ],
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === 'user_reading_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { library_id: DB_AUTHORITATIVE_LIB_ID, last_chapter_read: 42, last_volume_read: 4 },
                ],
                error: null,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const library = await fetchUserLibrary(TEST_USER_ID);
      expect(library.length).toBe(1);
      expect(library[0].id).toBe(DB_AUTHORITATIVE_LIB_ID);
      expect(library[0].episodes_watched).toEqual(['ep_1', 'ep_2']);
      expect(library[0].last_chapter_read).toBe(42);
      expect(library[0].last_volume_read).toBe(4);

      // Local storage must also be populated with this hydrated remote entry
      const stored = getStoredLibraries();
      expect(stored.length).toBe(1);
      expect(stored[0].episodes_watched).toEqual(['ep_1', 'ep_2']);
      expect(stored[0].last_chapter_read).toBe(42);
    });
  });

  describe('6. logEpisodeProgress Fallback Entry Initialization', () => {
    it('creates a local entry and ensures parent row when item was not yet in localStorage', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: TEST_USER_ID } as any },
        error: null,
      });

      let parentCreated = false;
      let childEpisodePayload: any = null;

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'user_libraries') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            upsert: vi.fn().mockImplementation(() => {
              parentCreated = true;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockReturnValue({
                    throwOnError: vi.fn().mockResolvedValue({
                      data: { id: DB_AUTHORITATIVE_LIB_ID, user_id: TEST_USER_ID, title_id: TEST_TITLE_ID },
                      error: null,
                    }),
                  }),
                }),
              };
            }),
            update: vi.fn().mockReturnValue({
              match: vi.fn().mockReturnValue({
                throwOnError: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'user_episode_progress') {
          return {
            upsert: vi.fn().mockImplementation((payload: any) => {
              childEpisodePayload = payload;
              return {
                throwOnError: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          } as any;
        }
        return {} as any;
      });

      // Storage is initially empty
      expect(getStoredLibraries().length).toBe(0);

      const result = await logEpisodeProgress({
        libraryId: CLIENT_STALE_LIB_ID,
        userId: TEST_USER_ID,
        episodeId: 'ep_1',
        watched: true,
        titleId: TEST_TITLE_ID,
        titleData: createTestTitle({ total_episodes: 47 }),
      });

      expect(parentCreated).toBe(true);
      expect(childEpisodePayload).not.toBeNull();
      expect(childEpisodePayload.library_id).toBe(DB_AUTHORITATIVE_LIB_ID);
      expect(result.id).toBe(DB_AUTHORITATIVE_LIB_ID);
      expect(result.episodes_watched).toContain('ep_1');

      const stored = getStoredLibraries();
      expect(stored.length).toBe(1);
      expect(stored[0].id).toBe(DB_AUTHORITATIVE_LIB_ID);
      expect(stored[0].episodes_watched).toContain('ep_1');
    });
  });
});
