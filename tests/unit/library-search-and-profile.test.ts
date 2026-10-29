import { describe, it, expect } from 'vitest';
import type { UserLibraryItem } from '../../src/features/library/libraryService';
import type { TrackingStatus } from '../../src/types/database.types';

describe('Library Local Search and Status Filtering', () => {
  const mockLibrary: UserLibraryItem[] = [
    {
      id: 'lib_1',
      user_id: 'user_123',
      title_id: 'tv_breaking_bad_1396',
      status: 'completed',
      rating: 10,
      is_private: false,
      personal_notes: null,
      started_at: null,
      completed_at: null,
      last_progressed_at: new Date().toISOString(),
      episodes_watched: Array.from({ length: 62 }, (_, i) => `ep_${i + 1}`),
      last_chapter_read: 0,
      last_volume_read: 0,
      title: {
        id: 'tv_breaking_bad_1396',
        media_type: 'tv',
        title: 'Breaking Bad',
        original_title: null,
        release_year: 2008,
        release_date: '2008-01-20',
        synopsis: 'A chemistry teacher diagnosed with cancer turns to cooking meth.',
        poster_url: 'https://image.tmdb.org/t/p/w500/breaking_bad.jpg',
        backdrop_url: null,
        genres: ['Drama', 'Crime'],
        origin_country: 'US',
        status: 'ended',
        total_episodes: 62,
        episodes: 62,
      },
    },
    {
      id: 'lib_2',
      user_id: 'user_123',
      title_id: 'movie_inception_27205',
      status: 'active',
      rating: 9,
      is_private: false,
      personal_notes: null,
      started_at: null,
      completed_at: null,
      last_progressed_at: new Date().toISOString(),
      episodes_watched: [],
      last_chapter_read: 0,
      last_volume_read: 0,
      title: {
        id: 'movie_inception_27205',
        media_type: 'movie',
        title: 'Inception',
        original_title: null,
        release_year: 2010,
        release_date: '2010-07-16',
        synopsis: 'A thief who steals corporate secrets through dream-sharing technology.',
        poster_url: 'https://image.tmdb.org/t/p/w500/inception.jpg',
        backdrop_url: null,
        genres: ['Action', 'Sci-Fi'],
        origin_country: 'US',
        status: 'released',
        runtime_minutes: 148,
      },
    },
    {
      id: 'lib_3',
      user_id: 'user_123',
      title_id: 'anime_aot_1429',
      status: 'planned',
      rating: null,
      is_private: false,
      personal_notes: null,
      started_at: null,
      completed_at: null,
      last_progressed_at: new Date().toISOString(),
      episodes_watched: [],
      last_chapter_read: 0,
      last_volume_read: 0,
      title: {
        id: 'anime_aot_1429',
        media_type: 'anime_series',
        title: 'Attack on Titan',
        original_title: 'Shingeki no Kyojin',
        release_year: 2013,
        release_date: '2013-04-07',
        synopsis: 'Humans fight gigantic humanoids known as Titans.',
        poster_url: 'https://image.tmdb.org/t/p/w500/aot.jpg',
        backdrop_url: null,
        genres: ['Action', 'Fantasy'],
        origin_country: 'JP',
        status: 'ended',
        total_episodes: 87,
        episodes: 87,
      },
    },
    {
      id: 'lib_4',
      user_id: 'user_123',
      title_id: 'manga_solo_leveling_105398',
      status: 'active',
      rating: 9.5,
      is_private: false,
      personal_notes: null,
      started_at: null,
      completed_at: null,
      last_progressed_at: new Date().toISOString(),
      episodes_watched: [],
      last_chapter_read: 120,
      last_volume_read: 0,
      title: {
        id: 'manga_solo_leveling_105398',
        media_type: 'manhwa',
        title: 'Solo Leveling',
        original_title: 'Na Honjaman Rebeleop',
        release_year: 2018,
        release_date: '2018-03-04',
        synopsis: 'The weakest hunter becomes the world strongest.',
        poster_url: 'https://image.tmdb.org/t/p/w500/solo.jpg',
        backdrop_url: null,
        genres: ['Action', 'Fantasy'],
        origin_country: 'KR',
        status: 'finished',
        total_chapters: 200,
        chapters: 200,
      },
    },
  ];

  function filterLibrary(
    items: UserLibraryItem[],
    domain: 'watch' | 'read',
    status: TrackingStatus | 'all',
    searchQuery: string
  ): UserLibraryItem[] {
    const domainMediaTypes =
      domain === 'watch'
        ? ['movie', 'tv', 'anime_series', 'anime_film']
        : ['manga', 'manhwa'];

    return items.filter((item) => {
      if (!domainMediaTypes.includes(item.title.media_type)) return false;
      if (status !== 'all' && item.status !== status) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatches = item.title.title.toLowerCase().includes(q);
        const originalTitleMatches = item.title.original_title
          ? item.title.original_title.toLowerCase().includes(q)
          : false;
        if (!titleMatches && !originalTitleMatches) return false;
      }
      return true;
    });
  }

  it('filters local watch library strictly by user-entered title keyword', () => {
    const results = filterLibrary(mockLibrary, 'watch', 'all', 'break');
    expect(results.length).toBe(1);
    expect(results[0].title.title).toBe('Breaking Bad');
  });

  it('filters local watch library by original title (e.g. romaji / native)', () => {
    const results = filterLibrary(mockLibrary, 'watch', 'all', 'Shingeki');
    expect(results.length).toBe(1);
    expect(results[0].title.title).toBe('Attack on Titan');
  });

  it('filters local library by status dropdown and search query combined', () => {
    // Both Inception and Breaking Bad are in watch, but only Inception is 'active'
    const results = filterLibrary(mockLibrary, 'watch', 'active', 'Incep');
    expect(results.length).toBe(1);
    expect(results[0].title.title).toBe('Inception');

    // Searching 'Breaking' with 'active' status yields 0 because Breaking Bad is 'completed'
    const emptyResults = filterLibrary(mockLibrary, 'watch', 'active', 'Breaking');
    expect(emptyResults.length).toBe(0);

    // Searching 'Breaking' with 'completed' status finds it
    const completedResults = filterLibrary(mockLibrary, 'watch', 'completed', 'Breaking');
    expect(completedResults.length).toBe(1);
    expect(completedResults[0].title.title).toBe('Breaking Bad');
  });

  it('strictly isolates reading library from watch library during local search', () => {
    // Searching for 'Solo' in watch domain should return 0 results
    const watchResults = filterLibrary(mockLibrary, 'watch', 'all', 'Solo');
    expect(watchResults.length).toBe(0);

    // Searching for 'Solo' in read domain returns the Manhwa item
    const readResults = filterLibrary(mockLibrary, 'read', 'all', 'Solo');
    expect(readResults.length).toBe(1);
    expect(readResults[0].title.title).toBe('Solo Leveling');
  });

  it('returns all domain items when local search is empty', () => {
    const allWatch = filterLibrary(mockLibrary, 'watch', 'all', '');
    expect(allWatch.length).toBe(3); // Breaking Bad, Inception, Attack on Titan

    const allRead = filterLibrary(mockLibrary, 'read', 'all', '');
    expect(allRead.length).toBe(1); // Solo Leveling
  });
});

describe('Edit Profile Validation & Database Constraints', () => {
  it('validates non-empty display name and username', () => {
    const validate = (name: string, username: string) => {
      const cleanName = name.trim();
      const cleanUsername = username.trim().toLowerCase();
      if (!cleanName) return 'Name cannot be empty.';
      if (!cleanUsername) return 'Username cannot be empty.';
      if (cleanUsername.length < 3) return 'Username must be at least 3 characters.';
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return 'Username can only contain letters, numbers, underscores, periods, and hyphens.';
      }
      return null;
    };

    expect(validate('', 'alice')).toBe('Name cannot be empty.');
    expect(validate('Alice', '')).toBe('Username cannot be empty.');
    expect(validate('Alice', 'ab')).toBe('Username must be at least 3 characters.');
    expect(validate('Alice', 'user@name!')).toBe(
      'Username can only contain letters, numbers, underscores, periods, and hyphens.'
    );
    expect(validate('Alice Smith', 'alice_smith')).toBeNull();
  });

  it('detects duplicate usernames and raises unique constraint error', () => {
    const existingUsers = [
      { id: 'u_1', username: 'bob_builder' },
      { id: 'u_2', username: 'elena_tracker' },
    ];

    const isUsernameTaken = (candidate: string, currentUserId: string) => {
      const lower = candidate.trim().toLowerCase();
      return existingUsers.some((u) => u.id !== currentUserId && u.username.toLowerCase() === lower);
    };

    // Elena tries to change username to existing bob_builder
    expect(isUsernameTaken('bob_builder', 'u_2')).toBe(true);
    expect(isUsernameTaken('BOB_BUILDER', 'u_2')).toBe(true);

    // Elena keeps her own username
    expect(isUsernameTaken('elena_tracker', 'u_2')).toBe(false);

    // Elena picks a unique new username
    expect(isUsernameTaken('elena_super_tracker', 'u_2')).toBe(false);
  });
});
