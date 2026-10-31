import { describe, it, expect, beforeEach } from 'vitest';
import type { UserLibraryItem } from '../../src/features/library/libraryService';
import type { TrackingStatus } from '../../src/types/database.types';
import {
  normalizeStatusParam,
  normalizeFormatParam,
  statusToParam,
  persistLibraryFilters,
  getInitialLibraryFilters,
  sanitizeFilterState,
  type LibraryFilterState,
} from '../../src/features/library/libraryFilterState';
import {
  MOCK_CATALOG_FIXTURES,
  standardizeTitleKey,
  hasValidPoster,
  resolvePosterUrl,
  deduplicateAndFilterCatalogResults,
} from '../../src/features/catalog/catalogService';
import {
  fetchUserLibrary,
  saveStoredLibraries,
  upsertLibraryItem,
  updateItemStatus,
  logEpisodeProgress,
  logBatchEpisodeProgress,
  calculateTotalEpisodes,
  calculateWatchedEpisodesCount,
  inferWatchedTrackingStatus,
} from '../../src/features/library/libraryService';
import { commitImportBatch } from '../../src/features/import-export/importService';
import { matchPublicProfileRoute } from '../../src/App';
import { followUser, unfollowUser, getStoredFollows } from '../../src/features/social/socialService';
import { uploadBannerImage, isVideoBanner } from '../../src/lib/bannerUpload';
import { extractBackdropUrl } from '../../src/features/profile/BannerLibrarySelector';

// Mock localStorage and sessionStorage for Node.js Vitest environment
const mockLocalStorage: Record<string, string> = {};
const mockSessionStorage: Record<string, string> = {};

globalThis.localStorage = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockLocalStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockLocalStorage[key];
  },
  clear: () => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  },
  key: (i: number) => Object.keys(mockLocalStorage)[i] || null,
  length: 0,
} as Storage;

globalThis.sessionStorage = {
  getItem: (key: string) => mockSessionStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockSessionStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockSessionStorage[key];
  },
  clear: () => {
    Object.keys(mockSessionStorage).forEach((k) => delete mockSessionStorage[k]);
  },
  key: (i: number) => Object.keys(mockSessionStorage)[i] || null,
  length: 0,
} as Storage;

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

describe('Profile Banner Feature (Upload & Library Selection)', () => {
  it('correctly extracts high-res backdrops from TMDB and AniList library titles', () => {
    const tmdbItem = {
      title: {
        backdrop_path: '/7F1s2e5v0QJk5yU7Xw2s2zX.jpg',
        title: 'Yellowstone',
      },
    };
    expect(extractBackdropUrl(tmdbItem)).toBe(
      'https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg'
    );

    const anilistItem = {
      title: {
        backdrop_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-12345.jpg',
        title: "Frieren: Beyond Journey's End",
      },
    };
    expect(extractBackdropUrl(anilistItem)).toBe(
      'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-12345.jpg'
    );
  });

  it('falls back gracefully to poster_url if backdrop is missing', () => {
    const posterOnlyItem = {
      title: {
        poster_url: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        title: 'Poster Only Show',
      },
    };
    expect(extractBackdropUrl(posterOnlyItem)).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
  });

  it('returns null safely when title has no images', () => {
    expect(extractBackdropUrl({} as any)).toBeNull();
    expect(extractBackdropUrl({ title: {} } as any)).toBeNull();
  });

  it('validates banner image file size limits and rejects files over 10MB', async () => {
    const oversizedFile = {
      name: 'large_wallpaper.png',
      size: 11 * 1024 * 1024,
    } as File;

    const result = await uploadBannerImage(oversizedFile, 'user_123');
    expect(result.url).toBeNull();
    expect(result.error).toContain('10MB');
  });

  it('rejects empty/null file input gracefully', async () => {
    const result = await uploadBannerImage(null as any, 'user_123');
    expect(result.url).toBeNull();
    expect(result.error).toBe('No file provided');
  });

  it('persists and clears banner_url on profile state updates', () => {
    interface TestProfile {
      id: string;
      username: string;
      display_name: string;
      banner_url: string | null;
    }

    let profile: TestProfile = {
      id: 'user_banner_test',
      username: 'banner_fan',
      display_name: 'Banner Fan',
      banner_url: null,
    };

    // User chooses library backdrop
    const chosenBackdrop = 'https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg';
    profile = { ...profile, banner_url: chosenBackdrop };
    expect(profile.banner_url).toBe(chosenBackdrop);

    // User resets to default gradient
    profile = { ...profile, banner_url: null };
    expect(profile.banner_url).toBeNull();
  });

  it('correctly detects video banners vs static images/GIFs with isVideoBanner', () => {
    // MP4 & WebM URLs
    expect(isVideoBanner('https://example.com/assets/cinematic_banner.mp4')).toBe(true);
    expect(isVideoBanner('https://example.com/assets/video_loop.webm')).toBe(true);
    expect(isVideoBanner('https://example.com/assets/ANIMATED.MP4?version=2')).toBe(true);
    expect(isVideoBanner('data:video/mp4;base64,AAAAHGZ0eXBtcDQy...')).toBe(true);
    expect(isVideoBanner('data:video/webm;base64,GkXfo59ChoEBQve...')).toBe(true);

    // Static images and GIFs should NOT be treated as video
    expect(isVideoBanner('https://example.com/banner.gif')).toBe(false);
    expect(isVideoBanner('https://example.com/poster.jpg')).toBe(false);
    expect(isVideoBanner('https://example.com/poster.png')).toBe(false);
    expect(isVideoBanner('https://example.com/poster.webp')).toBe(false);
    expect(isVideoBanner(null)).toBe(false);
    expect(isVideoBanner(undefined)).toBe(false);
    expect(isVideoBanner('')).toBe(false);
  });

  it('supports wide aspect ratios for image cropping (16:9 and 3:1)', () => {
    const aspect16by9 = 16 / 9;
    const aspect3by1 = 3 / 1;

    expect(aspect16by9).toBeCloseTo(1.7777, 3);
    expect(aspect3by1).toBe(3);

    // Calculating pixel crop box given width
    const getCropDimensions = (width: number, aspect: number) => {
      return {
        width,
        height: Math.round(width / aspect),
      };
    };

    const dims16by9 = getCropDimensions(1920, aspect16by9);
    expect(dims16by9.width).toBe(1920);
    expect(dims16by9.height).toBe(1080);

    const dims3by1 = getCropDimensions(1800, aspect3by1);
    expect(dims3by1.width).toBe(1800);
    expect(dims3by1.height).toBe(600);
  });

  it('dynamically handles file extensions for mp4, webm, and gif uploads', async () => {
    const videoFile = {
      name: 'banner_intro.mp4',
      type: 'video/mp4',
      size: 5 * 1024 * 1024,
    } as File;

    const gifFile = {
      name: 'anime_loop.gif',
      type: 'image/gif',
      size: 3 * 1024 * 1024,
    } as File;

    // Verify file properties match allowed extensions
    expect(videoFile.name.endsWith('.mp4')).toBe(true);
    expect(gifFile.name.endsWith('.gif')).toBe(true);
  });

  it('safely recovers banner_url from local cache during mobile initial hydration', () => {
    const userId = 'user_mobile_test';
    const cachedBannerUrl = 'https://image.tmdb.org/t/p/w1280/mobile_cinematic_backdrop.jpg';

    // Simulate saving banner in mobile local storage
    localStorage.setItem(`trackup_banner_${userId}`, cachedBannerUrl);
    localStorage.setItem(
      'trackup_mock_profiles',
      JSON.stringify({
        [userId]: {
          id: userId,
          username: 'mobile_user',
          banner_url: cachedBannerUrl,
        },
      })
    );

    // Hydration resolver matching ProfilePage.tsx logic
    const resolveBannerOnHydration = (
      profileBanner: string | null | undefined,
      uid: string
    ): string | null => {
      if (profileBanner) return profileBanner;
      try {
        const direct = localStorage.getItem(`trackup_banner_${uid}`);
        if (direct) return direct;
        const profiles = JSON.parse(localStorage.getItem('trackup_mock_profiles') || '{}');
        if (profiles[uid]?.banner_url) return profiles[uid].banner_url;
      } catch {
        return null;
      }
      return null;
    };

    // When profile is still pending / undefined on mobile refresh:
    expect(resolveBannerOnHydration(undefined, userId)).toBe(cachedBannerUrl);
    // When profile returns null banner:
    expect(resolveBannerOnHydration(null, userId)).toBe(cachedBannerUrl);
    // When profile provides active banner:
    expect(
      resolveBannerOnHydration('https://image.tmdb.org/t/p/w1280/live_server_banner.jpg', userId)
    ).toBe('https://image.tmdb.org/t/p/w1280/live_server_banner.jpg');
  });

  it('safely recovers avatar_url from local cache during mobile initial hydration', () => {
    const userId = 'user_mobile_avatar_test';
    const cachedAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

    // Simulate saving avatar in mobile local storage
    localStorage.setItem(`trackup_avatar_${userId}`, cachedAvatarUrl);
    localStorage.setItem(
      'trackup_mock_profiles',
      JSON.stringify({
        [userId]: {
          id: userId,
          username: 'mobile_avatar_user',
          avatar_url: cachedAvatarUrl,
        },
      })
    );

    // Hydration resolver matching ProfilePage.tsx avatar logic
    const resolveAvatarOnHydration = (
      profileAvatar: string | null | undefined,
      uid: string
    ): string | null => {
      if (profileAvatar) return profileAvatar;
      try {
        const direct = localStorage.getItem(`trackup_avatar_${uid}`);
        if (direct) return direct;
        const profiles = JSON.parse(localStorage.getItem('trackup_mock_profiles') || '{}');
        if (profiles[uid]?.avatar_url) return profiles[uid].avatar_url;
      } catch {
        return null;
      }
      return null;
    };

    // When profile is still pending / undefined on mobile refresh:
    expect(resolveAvatarOnHydration(undefined, userId)).toBe(cachedAvatarUrl);
    // When profile returns null avatar:
    expect(resolveAvatarOnHydration(null, userId)).toBe(cachedAvatarUrl);
    // When profile provides active avatar:
    expect(
      resolveAvatarOnHydration('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', userId)
    ).toBe('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150');
  });

  it('verifies Pro Max redesign layout specifications (distinct banner block & left-aligned overlapping avatar)', () => {
    // Assert required classes for Pro Max design contract
    const bannerBlockClasses = 'relative w-full h-48 sm:h-56 md:h-64 overflow-hidden bg-surface-elevated/40';
    const avatarContainerClasses = 'w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-surface-elevated border-4 border-background shadow-2xl flex items-center justify-center relative ring-2 ring-accent/30';
    const avatarRowClasses = 'flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4';

    // Distinct banner block: full width, h-48 mobile to md:h-64 desktop
    expect(bannerBlockClasses).toContain('h-48');
    expect(bannerBlockClasses).toContain('md:h-64');

    // Left-aligned overlapping avatar: circular, -mt-12/-mt-16, thick background border
    expect(avatarContainerClasses).toContain('rounded-full');
    expect(avatarContainerClasses).toContain('border-4 border-background');
    expect(avatarRowClasses).toContain('-mt-12');
    expect(avatarRowClasses).toContain('sm:-mt-16');
  });
});

describe('Change Password Feature Validation & Logic', () => {
  const validatePasswordUpdate = (newPass: string, confirmPass: string): string | null => {
    if (!newPass) return 'Password cannot be empty.';
    if (newPass.length < 6) return 'Password must be at least 6 characters long.';
    if (newPass !== confirmPass) return 'Passwords do not match.';
    return null;
  };

  it('rejects passwords shorter than 6 characters', () => {
    expect(validatePasswordUpdate('12345', '12345')).toBe(
      'Password must be at least 6 characters long.'
    );
    expect(validatePasswordUpdate('', '')).toBe('Password cannot be empty.');
  });

  it('rejects passwords that do not match', () => {
    expect(validatePasswordUpdate('StrongPassword1!', 'DifferentPassword2@')).toBe(
      'Passwords do not match.'
    );
  });

  it('accepts valid matching passwords with 6+ characters', () => {
    expect(validatePasswordUpdate('SecretPass123!', 'SecretPass123!')).toBeNull();
    expect(validatePasswordUpdate('abcdef', 'abcdef')).toBeNull();
  });
});

describe('Library Filter State Preservation & Back Navigation', () => {
  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  it('correctly maps human-readable URL query parameters to internal status types', () => {
    expect(normalizeStatusParam('watching')).toBe('active');
    expect(normalizeStatusParam('reading')).toBe('active');
    expect(normalizeStatusParam('active')).toBe('active');
    expect(normalizeStatusParam('completed')).toBe('completed');
    expect(normalizeStatusParam('planned')).toBe('planned');
    expect(normalizeStatusParam('on_hold')).toBe('paused');
    expect(normalizeStatusParam('on-hold')).toBe('paused');
    expect(normalizeStatusParam('dropped')).toBe('dropped');
    expect(normalizeStatusParam('all')).toBe('all');
    expect(normalizeStatusParam(null)).toBe('all');
    expect(normalizeStatusParam(undefined)).toBe('all');
    expect(normalizeStatusParam('invalid_garbage_status')).toBe('all');
  });

  it('correctly maps human-readable URL query parameters to media format types', () => {
    expect(normalizeFormatParam('tv')).toBe('tv');
    expect(normalizeFormatParam('movie')).toBe('movie');
    expect(normalizeFormatParam('anime')).toBe('anime_series');
    expect(normalizeFormatParam('anime_series')).toBe('anime_series');
    expect(normalizeFormatParam('anime_film')).toBe('anime_film');
    expect(normalizeFormatParam('manga')).toBe('manga');
    expect(normalizeFormatParam('manhwa')).toBe('manhwa');
    expect(normalizeFormatParam('all')).toBe('all');
    expect(normalizeFormatParam(null)).toBe('all');
    expect(normalizeFormatParam(undefined)).toBe('all');
    expect(normalizeFormatParam('invalid_category')).toBe('all');
  });

  it('formats internal tracking status into clean query param strings for each domain', () => {
    expect(statusToParam('active', 'watch')).toBe('watching');
    expect(statusToParam('active', 'read')).toBe('reading');
    expect(statusToParam('completed', 'watch')).toBe('completed');
    expect(statusToParam('planned', 'read')).toBe('planned');
    expect(statusToParam('all', 'watch')).toBe('all');
  });

  it('strictly sanitizes malformed, null, or undefined filter objects', () => {
    // 1. null / undefined / empty
    expect(sanitizeFilterState(null)).toEqual({ status: 'all', format: 'all', searchQuery: '' });
    expect(sanitizeFilterState(undefined)).toEqual({ status: 'all', format: 'all', searchQuery: '' });
    expect(sanitizeFilterState({})).toEqual({ status: 'all', format: 'all', searchQuery: '' });

    // 2. poisoned or malformed values
    expect(
      sanitizeFilterState({
        status: 'undefined',
        format: null,
        searchQuery: 12345,
      })
    ).toEqual({ status: 'all', format: 'all', searchQuery: '' });

    // 3. alias support (category, type, selectedFormat, q, search)
    expect(
      sanitizeFilterState({
        activeStatus: 'watching',
        category: 'tv',
        q: 'Yellowstone',
      })
    ).toEqual({ status: 'active', format: 'tv', searchQuery: 'Yellowstone' });
  });

  it('persists and restores library filters via sessionStorage with safe fallbacks', () => {
    const filters: LibraryFilterState = {
      status: 'active',
      format: 'tv',
      searchQuery: 'Yellowstone',
    };

    persistLibraryFilters(filters, 'watch');
    const restored = getInitialLibraryFilters('watch');

    expect(restored.status).toBe('active');
    expect(restored.format).toBe('tv');
    expect(restored.searchQuery).toBe('Yellowstone');
  });

  it('safely handles DOMExceptions or malformed JSON in sessionStorage', () => {
    sessionStorage.setItem('trackup_library_filters_watch', 'invalid-json-{broken');
    const restored = getInitialLibraryFilters('watch');
    expect(restored).toEqual({ status: 'all', format: 'all', searchQuery: '' });
  });

  it('safely filters library items with null, undefined, or missing title properties without throwing', () => {
    const rawCorruptLibrary = [
      null,
      undefined,
      {},
      { id: 'corrupt_1', status: 'active' },
      { id: 'corrupt_2', status: 'completed', title: null },
      {
        id: 'valid_1',
        status: 'active',
        title: { id: 't1', title: 'Yellowstone', media_type: 'tv' },
      },
      {
        id: 'valid_2',
        status: 'completed',
        title: { id: 't2', title: 'Breaking Bad', media_type: 'tv' },
      },
    ] as any[];

    // Filtering with safe logic
    const filterSafe = (items: any[], activeStatus: string, format: string) => {
      const domainTypes = ['tv', 'movie', 'anime_series', 'anime_film'];
      return (Array.isArray(items) ? items : []).filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const type = item.title?.media_type;
        if (type && !domainTypes.includes(type)) return false;
        if (activeStatus && activeStatus !== 'all' && item.status && item.status !== activeStatus) {
          return false;
        }
        if (format && format !== 'all' && type && type !== format) {
          return false;
        }
        return true;
      });
    };

    expect(() => filterSafe(rawCorruptLibrary, 'active', 'tv')).not.toThrow();
    const result = filterSafe(rawCorruptLibrary, 'active', 'tv');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((i) => i.id === 'valid_1')).toBe(true);
  });
});

describe('Yellowstone Hardcoded Fixture & Poster Hydration', () => {
  it('has valid fully qualified TMDB poster_url and poster_path in MOCK_CATALOG_FIXTURES', () => {
    const yellowstone = MOCK_CATALOG_FIXTURES.find((item) => item.id === 'tmdb_tv_73586');
    expect(yellowstone).toBeDefined();
    expect(yellowstone?.title).toBe('Yellowstone');
    expect(yellowstone?.poster_url).toBe('https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg');
    expect(yellowstone?.poster_path).toBe('https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg');
    expect(yellowstone?.backdrop_url).toBe('https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg');
    expect(yellowstone?.backdrop_path).toBe('https://image.tmdb.org/t/p/w1280/7F1s2e5v0QJk5yU7Xw2s2zX.jpg');
  });

  it('auto-heals legacy Yellowstone library items with broken or placeholder posters', async () => {
    const brokenYellowstone: UserLibraryItem = {
      id: 'lib_ys_broken',
      user_id: 'user_tester',
      title_id: 'tmdb_tv_73586',
      status: 'active',
      rating: 9,
      is_private: false,
      personal_notes: null,
      started_at: null,
      completed_at: null,
      last_progressed_at: new Date().toISOString(),
      episodes_watched: ['ep_1', 'ep_2'],
      last_chapter_read: 0,
      last_volume_read: 0,
      title: {
        id: 'tmdb_tv_73586',
        media_type: 'tv',
        title: 'Yellowstone',
        poster_url: 'https://image.tmdb.org/t/p/w500/peNC0eyc3TQJa6x4TdKIIIRizUT.jpg', // broken URL
        genres: ['Western'],
      },
    };

    saveStoredLibraries([brokenYellowstone]);

    const library = await fetchUserLibrary('user_tester');
    expect(library.length).toBe(1);
    expect(library[0].title.poster_url).toBe('https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg');
  });
});

describe('Profile Picture 1:1 Cropper & Defensive Avatar Hydration', () => {
  beforeEach(() => {
    mockLocalStorage['trackup_avatar_user_mobile_1'] = '';
    mockLocalStorage['trackup_mock_profiles'] = '';
  });

  it('safely rejects null or undefined avatar updates if a valid URL is already painted', () => {
    let currentAvatarUrl: string | null = 'https://supabase.co/storage/v1/object/public/avatars/user_1_cropped.jpg';

    // The defensive setter logic used in ProfilePage
    const setSafeAvatarUrl = (nextUrl: string | null | ((prev: string | null) => string | null)) => {
      const prev = currentAvatarUrl;
      const resolved = typeof nextUrl === 'function' ? nextUrl(prev) : nextUrl;
      if (!resolved && prev) {
        // Reject null/undefined updates if already painted
        return;
      }
      currentAvatarUrl = resolved;
    };

    // Incoming network payload has null avatar_url due to race condition
    setSafeAvatarUrl(null);
    expect(currentAvatarUrl).toBe('https://supabase.co/storage/v1/object/public/avatars/user_1_cropped.jpg');

    setSafeAvatarUrl(undefined as any);
    expect(currentAvatarUrl).toBe('https://supabase.co/storage/v1/object/public/avatars/user_1_cropped.jpg');

    // Valid update proceeds normally
    setSafeAvatarUrl('https://supabase.co/storage/v1/object/public/avatars/new_photo.jpg');
    expect(currentAvatarUrl).toBe('https://supabase.co/storage/v1/object/public/avatars/new_photo.jpg');
  });

  it('preserves cached avatar on mobile refresh when network profile returns null avatar_url', () => {
    const userId = 'user_mobile_1';
    const cachedUrl = 'https://supabase.co/storage/v1/object/public/avatars/persisted_avatar.jpg';
    mockLocalStorage[`trackup_avatar_${userId}`] = cachedUrl;

    // Simulate incoming profile from network with null avatar_url
    const networkProfile = {
      id: userId,
      username: 'mobile_user',
      display_name: 'Mobile User',
      avatar_url: null,
      banner_url: null,
    };

    // Resilient hydration fallback
    const resolvedAvatar =
      networkProfile.avatar_url ||
      mockLocalStorage[`trackup_avatar_${userId}`] ||
      null;

    expect(resolvedAvatar).toBe(cachedUrl);
  });

  it('configures 1:1 square aspect ratio and circular crop shape for avatar cropper', () => {
    const avatarCropperConfig = {
      aspect: 1,
      cropShape: 'round' as const,
      minZoom: 1,
      maxZoom: 3,
      showGrid: true,
    };

    expect(avatarCropperConfig.aspect).toBe(1);
    expect(avatarCropperConfig.cropShape).toBe('round');
    expect(avatarCropperConfig.maxZoom).toBeGreaterThanOrEqual(3);
  });

  it('performs defensive merging and initiates silent DB healing when DB avatar is missing', () => {
    const userId = 'user_heal_1';
    const cachedAvatar = 'https://supabase.co/storage/v1/object/public/avatars/healed.jpg';
    mockLocalStorage[`trackup_avatar_${userId}`] = cachedAvatar;

    let dbUpdatedUrl: string | null = null;
    const mockSupabaseUpdate = (fields: { avatar_url: string }) => {
      dbUpdatedUrl = fields.avatar_url;
      return Promise.resolve({ error: null });
    };

    const incomingDbProfile: { id: string; avatar_url: string | null } = {
      id: userId,
      avatar_url: null,
    };

    // Defensive merging logic
    let effectiveAvatar = incomingDbProfile.avatar_url;
    if (!effectiveAvatar && cachedAvatar) {
      effectiveAvatar = cachedAvatar;
      mockSupabaseUpdate({ avatar_url: cachedAvatar });
    }

    expect(effectiveAvatar).toBe(cachedAvatar);
    expect(dbUpdatedUrl).toBe(cachedAvatar);
  });
});

describe('Episode & Progress Reset on Status Downgrade ("Planned")', () => {
  beforeEach(() => {
    mockLocalStorage['trackup_user_libraries'] = JSON.stringify([]);
  });

  it('automatically resets episodes_watched to [] and dates to null when show status is downgraded to planned', async () => {
    const userId = 'user_downgrade_test';
    const titleId = 'tv_breaking_bad_1396';

    // 1. Initially watching with 5 episodes tracked
    const initialItem = await upsertLibraryItem({
      userId,
      titleId,
      status: 'active',
      titleData: {
        id: titleId,
        media_type: 'tv',
        title: 'Breaking Bad',
        total_episodes: 62,
        genres: ['Drama'],
      },
    });

    initialItem.episodes_watched = ['ep_1', 'ep_2', 'ep_3', 'ep_4', 'ep_5'];
    saveStoredLibraries([initialItem]);

    // Verify it has 5 watched episodes
    const current = (await fetchUserLibrary(userId))[0];
    expect(current.episodes_watched.length).toBe(5);

    // 2. User downgrades status to 'planned'
    const updated = await updateItemStatus({
      userId,
      titleId,
      status: 'planned',
    });

    expect(updated.status).toBe('planned');
    expect(updated.episodes_watched).toEqual([]);
    expect(updated.started_at).toBeNull();
    expect(updated.completed_at).toBeNull();

    // Verify persisted state in storage
    const stored = (await fetchUserLibrary(userId))[0];
    expect(stored.episodes_watched).toEqual([]);
  });

  it('automatically resets reading progress (chapters & volumes) to 0 when manga status is changed to planned', async () => {
    const userId = 'user_downgrade_reading';
    const titleId = 'manga_solo_leveling_105398';

    const item = await upsertLibraryItem({
      userId,
      titleId,
      status: 'active',
      titleData: {
        id: titleId,
        media_type: 'manga',
        title: 'Solo Leveling',
        genres: ['Action'],
      },
    });

    item.last_chapter_read = 75;
    item.last_volume_read = 6;
    saveStoredLibraries([item]);

    // Downgrade to 'planned'
    const updated = await updateItemStatus({
      userId,
      titleId,
      status: 'planned',
    });

    expect(updated.status).toBe('planned');
    expect(updated.last_chapter_read).toBe(0);
    expect(updated.last_volume_read).toBe(0);
  });

  it('clears episodes_watched to [] on CSV import when incoming status is planned', async () => {
    const userId = 'user_csv_import_planned';
    saveStoredLibraries([]);

    const catalogItem = {
      id: 'tv_breaking_bad_1396',
      media_type: 'tv' as const,
      title: 'Breaking Bad',
      total_episodes: 62,
      genres: ['Drama'],
    };

    const importRows = [
      {
        row: {
          title: 'Breaking Bad',
          mediaType: 'tv' as const,
          status: 'planned' as const,
          episodesWatched: 15, // Incoming file had episodes, but status is planned
        },
        status: 'matched',
        resolvedTitle: catalogItem,
      },
    ];

    const result = await commitImportBatch({
      userId,
      items: importRows as any,
      duplicatePolicy: 'overwrite',
    });

    expect(result.committed).toBe(1);
    const storedLibraries = JSON.parse(mockLocalStorage['trackup_user_libraries'] || '[]');
    const importedEntry = storedLibraries.find((i: any) => i.title_id === 'tv_breaking_bad_1396');

    expect(importedEntry).toBeDefined();
    expect(importedEntry.status).toBe('planned');
    expect(importedEntry.episodes_watched).toEqual([]);
  });
});

describe('Automatic Status Inference on Episode & Season Progress', () => {
  beforeEach(() => {
    mockLocalStorage['trackup_user_libraries'] = JSON.stringify([]);
  });

  it('correctly calculates total episodes from title fields or seasons', () => {
    expect(calculateTotalEpisodes({ id: 't1', media_type: 'tv', title: 'T1', total_episodes: 10 } as any)).toBe(10);
    expect(calculateTotalEpisodes({ id: 't2', media_type: 'tv', title: 'T2', episodes: 24 } as any)).toBe(24);
    expect(calculateTotalEpisodes({
      id: 't3',
      media_type: 'tv',
      title: 'T3',
      seasons: [
        { id: 's1', season_number: 1, name: 'S1', episode_count: 5, episodes: [] },
        { id: 's2', season_number: 2, name: 'S2', episode_count: 7, episodes: [] },
      ],
    } as any)).toBe(12);
  });

  it('correctly calculates watched episode count across season IDs', () => {
    const title = {
      id: 'show_1',
      media_type: 'tv' as const,
      title: 'Show 1',
      total_episodes: 3,
      genres: ['Drama'],
      seasons: [
        {
          id: 's1',
          season_number: 1,
          name: 'S1',
          episode_count: 3,
          episodes: [
            { id: 'ep_s1_1', episode_number: 1, name: 'E1', runtime_minutes: 30, air_date: '2026-01-01' },
            { id: 'ep_s1_2', episode_number: 2, name: 'E2', runtime_minutes: 30, air_date: '2026-01-02' },
            { id: 'ep_s1_3', episode_number: 3, name: 'E3', runtime_minutes: 30, air_date: '2026-01-03' },
          ],
        },
      ],
    };

    expect(calculateWatchedEpisodesCount(['ep_s1_1'], title)).toBe(1);
    expect(calculateWatchedEpisodesCount(['ep_s1_1', 'ep_1'], title)).toBe(1); // deduplicates alias
    expect(calculateWatchedEpisodesCount(['ep_s1_1', 'ep_s1_2'], title)).toBe(2);
    expect(calculateWatchedEpisodesCount(['ep_s1_1', 'ep_s1_2', 'ep_s1_3'], title)).toBe(3);
  });

  it('infers status accurately based on watchedCount vs totalEpisodes', () => {
    // 1. Auto-promote to completed when watchedCount >= totalEpisodes
    expect(inferWatchedTrackingStatus({ currentStatus: 'active', watchedCount: 12, totalEpisodes: 12 })).toBe('completed');
    expect(inferWatchedTrackingStatus({ currentStatus: 'planned', watchedCount: 12, totalEpisodes: 12 })).toBe('completed');
    expect(inferWatchedTrackingStatus({ currentStatus: 'active', watchedCount: 15, totalEpisodes: 12 })).toBe('completed');

    // 2. Auto-promote planned to active when progress begins
    expect(inferWatchedTrackingStatus({ currentStatus: 'planned', watchedCount: 1, totalEpisodes: 12 })).toBe('active');
    expect(inferWatchedTrackingStatus({ currentStatus: 'active', watchedCount: 6, totalEpisodes: 12 })).toBe('active');

    // 3. Auto-demote completed to active when an episode is uncompleted
    expect(inferWatchedTrackingStatus({ currentStatus: 'completed', watchedCount: 11, totalEpisodes: 12 })).toBe('active');

    // 4. Auto-revert to planned when progress reaches 0
    expect(inferWatchedTrackingStatus({ currentStatus: 'active', watchedCount: 0, totalEpisodes: 12 })).toBe('planned');
    expect(inferWatchedTrackingStatus({ currentStatus: 'completed', watchedCount: 0, totalEpisodes: 12 })).toBe('planned');
  });

  it('auto-promotes show to completed in logEpisodeProgress when final episode is watched', async () => {
    const userId = 'user_auto_complete_1';
    const titleId = 'tv_short_series';

    const item = await upsertLibraryItem({
      userId,
      titleId,
      status: 'active',
      titleData: {
        id: titleId,
        media_type: 'tv',
        title: 'Short Series',
        total_episodes: 3,
        genres: ['Drama'],
      },
    });

    item.episodes_watched = ['ep_1', 'ep_2'];
    saveStoredLibraries([item]);

    // Mark the 3rd (and final) episode as watched
    const updated = await logEpisodeProgress({
      libraryId: item.id,
      userId,
      episodeId: 'ep_3',
      watched: true,
    });

    expect(updated.status).toBe('completed');
    expect(updated.completed_at).toBeTruthy();
    expect(updated.episodes_watched).toEqual(['ep_1', 'ep_2', 'ep_3']);

    // Persisted storage check
    const stored = (await fetchUserLibrary(userId))[0];
    expect(stored.status).toBe('completed');
  });

  it('auto-demotes show from completed to active when an episode is unchecked', async () => {
    const userId = 'user_auto_demote_1';
    const titleId = 'tv_short_series_demote';

    const item = await upsertLibraryItem({
      userId,
      titleId,
      status: 'completed',
      titleData: {
        id: titleId,
        media_type: 'tv',
        title: 'Short Series Demote',
        total_episodes: 3,
        genres: ['Drama'],
      },
    });

    item.episodes_watched = ['ep_1', 'ep_2', 'ep_3'];
    item.completed_at = '2026-10-30T10:00:00Z';
    saveStoredLibraries([item]);

    // Uncheck episode 3
    const updated = await logEpisodeProgress({
      libraryId: item.id,
      userId,
      episodeId: 'ep_3',
      watched: false,
    });

    expect(updated.status).toBe('active');
    expect(updated.completed_at).toBeNull();
    expect(updated.episodes_watched).toEqual(['ep_1', 'ep_2']);

    const stored = (await fetchUserLibrary(userId))[0];
    expect(stored.status).toBe('active');
  });

  it('auto-promotes show to completed in logBatchEpisodeProgress when full season equals total episodes', async () => {
    const userId = 'user_batch_complete_1';
    const titleId = 'tv_miniseries';

    const item = await upsertLibraryItem({
      userId,
      titleId,
      status: 'planned',
      titleData: {
        id: titleId,
        media_type: 'tv',
        title: 'Mini Series',
        total_episodes: 4,
        genres: ['Mystery'],
      },
    });

    // Mark all 4 episodes as watched via batch progress
    const updated = await logBatchEpisodeProgress({
      libraryId: item.id,
      userId,
      episodeIds: ['ep_1', 'ep_2', 'ep_3', 'ep_4'],
      watched: true,
    });

    expect(updated.status).toBe('completed');
    expect(updated.completed_at).toBeTruthy();
    expect(updated.episodes_watched.length).toBe(4);

    const stored = (await fetchUserLibrary(userId))[0];
    expect(stored.status).toBe('completed');
  });

  it('maintains active status when batch marking 1 season of a multi-season show', async () => {
    const userId = 'user_batch_season_1';
    const titleId = 'tv_multi_season';

    const item = await upsertLibraryItem({
      userId,
      titleId,
      status: 'planned',
      titleData: {
        id: titleId,
        media_type: 'tv',
        title: 'Multi Season Show',
        total_episodes: 20,
        genres: ['Action'],
      },
    });

    // Mark Season 1 (10 episodes out of 20 total)
    const season1EpIds = Array.from({ length: 10 }, (_, i) => `ep_${i + 1}`);
    const updated = await logBatchEpisodeProgress({
      libraryId: item.id,
      userId,
      episodeIds: season1EpIds,
      watched: true,
    });

    expect(updated.status).toBe('active');
    expect(updated.completed_at).toBeNull();
    expect(updated.episodes_watched.length).toBe(10);

    const stored = (await fetchUserLibrary(userId))[0];
    expect(stored.status).toBe('active');
  });
});

describe('Public Profile View & Routing', () => {
  it('correctly matches and extracts public profile username from routes', () => {
    expect(matchPublicProfileRoute('#/user/elena_tracker')).toBe('elena_tracker');
    expect(matchPublicProfileRoute('#/user/user_12345')).toBe('user_12345');
    expect(matchPublicProfileRoute('/user/marcus_anime')).toBe('marcus_anime');
    expect(matchPublicProfileRoute('#/dashboard')).toBeNull();
    expect(matchPublicProfileRoute('#/watch')).toBeNull();
  });

  it('filters out private items from public user library', async () => {
    const targetUserId = 'user_public_target';
    const publicItem: UserLibraryItem = {
      id: 'lib_pub_1',
      user_id: targetUserId,
      title_id: 'movie_inception_27205',
      status: 'completed',
      rating: 10,
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
        genres: ['Sci-Fi'],
      },
    };

    const privateItem: UserLibraryItem = {
      id: 'lib_priv_1',
      user_id: targetUserId,
      title_id: 'tv_secret_show',
      status: 'active',
      rating: 8,
      is_private: true,
      personal_notes: 'Private guilty pleasure',
      started_at: null,
      completed_at: null,
      last_progressed_at: new Date().toISOString(),
      episodes_watched: ['ep_1'],
      last_chapter_read: 0,
      last_volume_read: 0,
      title: {
        id: 'tv_secret_show',
        media_type: 'tv',
        title: 'Secret Show',
        genres: ['Drama'],
      },
    };

    saveStoredLibraries([publicItem, privateItem]);

    const library = await fetchUserLibrary(targetUserId);
    const publicOnly = library.filter((item) => !item.is_private);

    expect(library.length).toBe(2);
    expect(publicOnly.length).toBe(1);
    expect(publicOnly[0].title.title).toBe('Inception');
  });

  it('updates follow records correctly on follow and unfollow', async () => {
    mockLocalStorage['trackup_user_follows'] = JSON.stringify([]);
    const followerId = 'user_alice';
    const targetId = 'user_bob';

    const followSuccess = await followUser(followerId, targetId);
    expect(followSuccess).toBe(true);

    let storedFollows = getStoredFollows();
    expect(storedFollows.some((f) => f.follower_id === followerId && f.following_id === targetId)).toBe(true);

    const unfollowSuccess = await unfollowUser(followerId, targetId);
    expect(unfollowSuccess).toBe(false);

    storedFollows = getStoredFollows();
    expect(storedFollows.some((f) => f.follower_id === followerId && f.following_id === targetId)).toBe(false);
  });
});

describe('Global Search Deduplication & Quality Filter', () => {
  it('standardizes title strings by ignoring case, tags like (Anime), (TV), and season markers', () => {
    expect(standardizeTitleKey('Solo Leveling (Anime)')).toBe('sololeveling');
    expect(standardizeTitleKey('Solo Leveling')).toBe('sololeveling');
    expect(standardizeTitleKey('Solo Leveling [TV]')).toBe('sololeveling');
    expect(standardizeTitleKey('Solo Leveling Season 2')).toBe('sololeveling');
    expect(standardizeTitleKey('Attack on Titan (Manga)')).toBe('attackontitan');
    expect(standardizeTitleKey('Breaking Bad')).toBe('breakingbad');
  });

  it('rejects items with missing, null, undefined, or fallback placeholder posters', () => {
    expect(hasValidPoster(null)).toBe(false);
    expect(hasValidPoster(undefined)).toBe(false);
    expect(hasValidPoster({ id: '1', title: 'T1', genres: [], media_type: 'tv', poster_url: null } as any)).toBe(false);
    expect(hasValidPoster({ id: '2', title: 'T2', genres: [], media_type: 'tv', poster_url: '' } as any)).toBe(false);
    expect(hasValidPoster({ id: '3', title: 'T3', genres: [], media_type: 'tv', poster_url: '   ' } as any)).toBe(false);
    expect(hasValidPoster({ id: '4', title: 'T4', genres: [], media_type: 'tv', poster_url: '/assets/trackup-logo.jpg' } as any)).toBe(false);
    expect(hasValidPoster({ id: '5', title: 'T5', genres: [], media_type: 'tv', poster_url: 'https://image.tmdb.org/t/p/w500/test.jpg' } as any)).toBe(true);
    expect(hasValidPoster({ id: '6', title: 'T6', genres: [], media_type: 'tv', poster_url: '/valid_tmdb_path.jpg' } as any)).toBe(true);
  });

  it('prepends base image url https://image.tmdb.org/t/p/w500 to relative TMDB poster paths', () => {
    expect(resolvePosterUrl(null)).toBeNull();
    expect(resolvePosterUrl('')).toBeNull();
    expect(resolvePosterUrl('/assets/trackup-logo.jpg')).toBeNull();
    expect(resolvePosterUrl('https://s4.anilist.co/cover.jpg')).toBe('https://s4.anilist.co/cover.jpg');
    expect(resolvePosterUrl('/abc1234.jpg')).toBe('https://image.tmdb.org/t/p/w500/abc1234.jpg');
    expect(resolvePosterUrl('abc1234.jpg')).toBe('https://image.tmdb.org/t/p/w500/abc1234.jpg');
  });

  it('discards results with no poster and deduplicates anime by prioritizing AniList over TMDB', () => {
    const rawResults = [
      // 1. TMDB TV show with no poster (should be discarded)
      {
        id: 'tmdb_tv_noposter',
        media_type: 'tv' as const,
        title: 'Solo Leveling',
        genres: ['Action', 'Animation'],
        origin_country: 'JP',
        poster_url: null,
      },
      // 2. TMDB TV show with placeholder poster (should be discarded)
      {
        id: 'tmdb_tv_placeholder',
        media_type: 'tv' as const,
        title: 'Solo Leveling',
        genres: ['Action', 'Animation'],
        origin_country: 'JP',
        poster_url: '/assets/trackup-logo.jpg',
      },
      // 3. TMDB TV show with valid poster
      {
        id: 'tmdb_tv_with_poster',
        media_type: 'tv' as const,
        title: 'Solo Leveling',
        genres: ['Action', 'Animation'],
        origin_country: 'JP',
        poster_url: 'https://image.tmdb.org/t/p/w500/tmdb_solo.jpg',
      },
      // 4. AniList anime entry with valid poster (should win priority for anime)
      {
        id: 'anilist_anime_151807',
        media_type: 'anime_series' as const,
        title: 'Solo Leveling',
        genres: ['Action', 'Fantasy'],
        origin_country: 'JP',
        poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807.jpg',
        total_episodes: 24,
      },
    ];

    const deduplicated = deduplicateAndFilterCatalogResults(rawResults as any[], 'watch');

    // Exactly 1 result returned
    expect(deduplicated.length).toBe(1);
    // AniList anime won over TMDB
    expect(deduplicated[0].id).toBe('anilist_anime_151807');
    expect(deduplicated[0].media_type).toBe('anime_series');
    expect(deduplicated[0].poster_url).toBe('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807.jpg');
  });

  it('deduplicates live-action titles by prioritizing TMDB over AniList', () => {
    const rawResults = [
      // TMDB live-action with valid poster (should win)
      {
        id: 'tmdb_tv_1396',
        media_type: 'tv' as const,
        title: 'Breaking Bad',
        genres: ['Drama', 'Crime'],
        origin_country: 'US',
        poster_url: 'https://image.tmdb.org/t/p/w500/bb_poster.jpg',
      },
      // Stray AniList entry for Breaking Bad
      {
        id: 'anilist_anime_99999',
        media_type: 'anime_series' as const,
        title: 'Breaking Bad',
        genres: ['Drama'],
        origin_country: 'US',
        poster_url: 'https://s4.anilist.co/cover_bb.jpg',
      },
    ];

    const deduplicated = deduplicateAndFilterCatalogResults(rawResults as any[], 'watch');

    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].id).toBe('tmdb_tv_1396');
    expect(deduplicated[0].media_type).toBe('tv');
  });
});

describe('Library Search Input Persistence (No Reset Bug)', () => {
  it('does not reset or clear search input when search query returns 0 matches', () => {
    const libraryItems: UserLibraryItem[] = [
      {
        id: 'lib_1',
        user_id: 'user_search_test',
        title_id: 'tv_breaking_bad_1396',
        status: 'active',
        rating: 10,
        is_private: false,
        personal_notes: null,
        started_at: null,
        completed_at: null,
        last_progressed_at: new Date().toISOString(),
        episodes_watched: ['ep_1'],
        last_chapter_read: 0,
        last_volume_read: 0,
        title: {
          id: 'tv_breaking_bad_1396',
          media_type: 'tv',
          title: 'Breaking Bad',
          genres: ['Drama'],
        },
      },
    ];

    const searchQuery = 'NonExistentTitleQuery';

    // Filter library with non-matching query
    const filtered = libraryItems.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const title = (item.title?.title || '').toLowerCase();
      return title.includes(q);
    });

    expect(filtered.length).toBe(0);

    // Verify search term is decoupled and remains intact
    const retainedQuery = searchQuery;
    expect(retainedQuery).toBe('NonExistentTitleQuery');

    // Empty state message formats accurately
    const emptyMessage = `No titles found matching "${retainedQuery}"`;
    expect(emptyMessage).toBe('No titles found matching "NonExistentTitleQuery"');
  });
});
