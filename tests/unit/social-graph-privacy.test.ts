import { describe, it, expect, beforeEach } from 'vitest';
import {
  followUser,
  unfollowUser,
  isUserFollowing,
  searchProfiles,
  getFollowingActivityFeed,
  getRatingComparison,
} from '../../src/features/social/socialService';
import { saveStoredLibraries } from '../../src/features/library/libraryService';

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

describe('Phase 6: Social Graph & Self-Follow Prevention', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('strictly rejects self-following with SelfFollowError', async () => {
    await expect(followUser('user_alice', 'user_alice')).rejects.toThrow(
      /Users cannot follow themselves/i
    );
  });

  it('allows following and unfollowing community members', async () => {
    expect(isUserFollowing('user_alice', 'user_marcus_anime')).toBe(false);

    // Follow Marcus
    await followUser('user_alice', 'user_marcus_anime');
    expect(isUserFollowing('user_alice', 'user_marcus_anime')).toBe(true);

    // Unfollow Marcus
    await unfollowUser('user_alice', 'user_marcus_anime');
    expect(isUserFollowing('user_alice', 'user_marcus_anime')).toBe(false);
  });

  it('searches and filters community profiles with is_following indicator', async () => {
    await followUser('user_alice', 'user_elena_cinema');

    const searchElena = await searchProfiles('Elena', 'user_alice');
    expect(searchElena.length).toBe(1);
    expect(searchElena[0].username).toBe('elena_tracker');
    expect(searchElena[0].is_following).toBe(true);

    const searchMarcus = await searchProfiles('Marcus', 'user_alice');
    expect(searchMarcus.length).toBe(1);
    expect(searchMarcus[0].is_following).toBe(false);
  });

  it('searches users by exact @username and finds registered mock users', async () => {
    // Save dynamic registered user
    const dynamicProfiles = {
      user_bob: {
        id: 'user_bob',
        username: 'bob_builder',
        display_name: 'Bob The Builder',
        bio: 'Can we fix it? Yes we can!',
        avatar_url: null,
      },
    };
    localStorage.setItem('trackup_mock_profiles', JSON.stringify(dynamicProfiles));

    // Search by exact @username with @ prefix
    const searchWithAt = await searchProfiles('@bob_builder', 'user_alice');
    expect(searchWithAt.length).toBe(1);
    expect(searchWithAt[0].username).toBe('bob_builder');
    expect(searchWithAt[0].display_name).toBe('Bob The Builder');

    // Search by exact username without @ prefix
    const searchWithoutAt = await searchProfiles('bob_builder', 'user_alice');
    expect(searchWithoutAt.length).toBe(1);
    expect(searchWithoutAt[0].username).toBe('bob_builder');

    // Search by existing community profile with @ prefix
    const searchElenaAt = await searchProfiles('@elena_tracker', 'user_alice');
    expect(searchElenaAt.length).toBe(1);
    expect(searchElenaAt[0].username).toBe('elena_tracker');
  });
});

describe('Phase 6: Activity Feed Privacy & Rating Comparison', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enforces privacy: excludes private user activity from unauthorized feeds', async () => {
    // Follow both Elena (public) and Sofia (private)
    await followUser('user_alice', 'user_elena_cinema');
    await followUser('user_alice', 'user_sofia_private');

    const feed = await getFollowingActivityFeed('user_alice', 'following');

    // Elena's public activity must be present
    const elenaActivities = feed.filter((a) => a.user_id === 'user_elena_cinema');
    expect(elenaActivities.length).toBeGreaterThan(0);

    // Sofia's private activity must NEVER leak into the feed
    const sofiaActivities = feed.filter((a) => a.user_id === 'user_sofia_private');
    expect(sofiaActivities.length).toBe(0);
  });

  it('calculates side-by-side rating comparisons and delta accurately', async () => {
    // Seed Alice's rating (9 pts = 4.5 stars)
    saveStoredLibraries([
      {
        id: 'lib_alice_inc',
        user_id: 'user_alice',
        title_id: 'movie_inception_27205',
        status: 'completed',
        rating: 9, // 4.5 stars
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
          genres: [],
        },
      },
    ]);

    const comp = await getRatingComparison(
      'user_alice',
      'user_elena_cinema',
      'movie_inception_27205'
    );

    expect(comp).not.toBeNull();
    expect(comp?.user_a_rating).toBe(9); // Alice: 4.5 stars
    expect(comp?.user_b_rating).toBe(8); // Elena: 4.0 stars
    expect(comp?.delta).toBe(1); // +1 point higher (+0.5 star)
    expect(comp?.user_b_username).toBe('elena_tracker');
  });
});
