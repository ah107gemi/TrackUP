import type { SocialProfile, ActivityFeedItem, RatingComparisonData } from './types';
import { getStoredLibraries } from '../library/libraryService';
import { supabase } from '../../lib/supabase';

const LOCAL_STORAGE_FOLLOWS_KEY = 'trackup_user_follows';
const LOCAL_STORAGE_ACTIVITIES_KEY = 'trackup_activity_logs';

export interface UserFollowRecord {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// Curated social community profiles
export const MOCK_COMMUNITY_PROFILES: SocialProfile[] = [
  {
    id: 'user_elena_cinema',
    username: 'elena_tracker',
    display_name: 'Elena Rostova',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    bio: 'Cinema buff & Sci-Fi enthusiast. Christopher Nolan & Denis Villeneuve fan.',
    library_visibility: 'public',
    activity_visibility: 'public',
    follower_count: 142,
    following_count: 38,
  },
  {
    id: 'user_marcus_anime',
    username: 'marcus_anime',
    display_name: 'Marcus Vance',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    bio: 'Tracking every season of anime and South Korean manhwa.',
    library_visibility: 'public',
    activity_visibility: 'public',
    follower_count: 289,
    following_count: 94,
  },
  {
    id: 'user_sofia_private',
    username: 'sofia_private',
    display_name: 'Sofia Vance',
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    bio: 'Private reading journal.',
    library_visibility: 'private',
    activity_visibility: 'private',
    follower_count: 12,
    following_count: 5,
  },
];

// Pre-seeded community activity logs
const DEFAULT_ACTIVITIES: ActivityFeedItem[] = [
  {
    id: 'act_1',
    user_id: 'user_elena_cinema',
    username: 'elena_tracker',
    display_name: 'Elena Rostova',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    activity_type: 'rate_title',
    title_id: 'movie_inception_27205',
    title_name: 'Inception',
    media_type: 'movie',
    poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
    metadata: {
      rating: 8, // 4.0 stars
      review_excerpt: 'Rewatched in 4K — the spinning top ending still gives me chills.',
    },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'act_2',
    user_id: 'user_marcus_anime',
    username: 'marcus_anime',
    display_name: 'Marcus Vance',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    activity_type: 'read_chapter',
    title_id: 'manhwa_solo_leveling_105398',
    title_name: 'Solo Leveling',
    media_type: 'manhwa',
    poster_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500',
    metadata: {
      chapter_number: 120,
    },
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export function getStoredFollows(): UserFollowRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredFollows(follows: UserFollowRecord[]): void {
  localStorage.setItem(LOCAL_STORAGE_FOLLOWS_KEY, JSON.stringify(follows));
}

export function getStoredActivities(): ActivityFeedItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_ACTIVITIES;
  } catch {
    return DEFAULT_ACTIVITIES;
  }
}

export function saveStoredActivities(activities: ActivityFeedItem[]): void {
  localStorage.setItem(LOCAL_STORAGE_ACTIVITIES_KEY, JSON.stringify(activities));
}

export function isUserFollowing(followerId: string, targetUserId: string): boolean {
  const follows = getStoredFollows();
  return follows.some((f) => f.follower_id === followerId && f.following_id === targetUserId);
}

export async function followUser(followerId: string, targetUserId: string): Promise<boolean> {
  // Enforce self-follow restriction
  if (followerId === targetUserId) {
    throw new Error('SelfFollowError: Users cannot follow themselves.');
  }

  const follows = getStoredFollows();
  const exists = follows.some((f) => f.follower_id === followerId && f.following_id === targetUserId);
  if (exists) return true;

  const newFollow: UserFollowRecord = {
    id: `fol_${Math.random().toString(36).substring(2, 10)}`,
    follower_id: followerId,
    following_id: targetUserId,
    created_at: new Date().toISOString(),
  };

  follows.push(newFollow);
  saveStoredFollows(follows);
  return true;
}

export async function unfollowUser(followerId: string, targetUserId: string): Promise<boolean> {
  const follows = getStoredFollows();
  const filtered = follows.filter(
    (f) => !(f.follower_id === followerId && f.following_id === targetUserId)
  );
  saveStoredFollows(filtered);
  return false;
}

export async function searchProfiles(query: string, currentUserId: string): Promise<SocialProfile[]> {
  const cleanQ = query.trim().replace(/^@/, '');
  const follows = getStoredFollows();
  const allProfilesMap = new Map<string, SocialProfile>();

  const isLocalSupabase =
    !import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL.includes('127.0.0.1') ||
    import.meta.env.VITE_SUPABASE_URL.includes('localhost');

  // Fast timeout (350ms) in offline/local test suites; 6000ms in live cloud environments
  const timeoutMs = isLocalSupabase ? 350 : 6000;

  const executeWithTimeout = async <T>(thenable: PromiseLike<T>, ms: number): Promise<T> => {
    return Promise.race([
      Promise.resolve(thenable),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
      ),
    ]);
  };

  const isNetworkOrTimeout = (err: any) => {
    if (!err) return false;
    const msg = typeof err === 'string' ? err : err.message || '';
    return msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('fetch failed') || msg.toLowerCase().includes('network');
  };

  const isPostgrestSchemaOrBadRequest = (err: any): boolean => {
    if (!err) return false;
    const code = String(err.code || err.statusCode || err.status || '');
    const msg = String(err.message || err.details || err.hint || '').toLowerCase();
    const status = Number(err.status || err.statusCode || 0);

    return (
      status === 400 ||
      code === '400' ||
      code.startsWith('PGRST') || // PGRST204 (column not found), PGRST200, etc.
      code === '42703' || // PostgreSQL undefined_column
      msg.includes('column') ||
      msg.includes('schema') ||
      msg.includes('bad request') ||
      msg.includes('could not find') ||
      msg.includes('full_name')
    );
  };

  let liveProfiles: any[] = [];
  const queryLogs: { tier: string; error?: any; count?: number }[] = [];
  let isNetworkDown = false;

  // 1. Live Supabase query with strict 400 / PGRST schema error catch & username fallback
  if (cleanQ) {
    let triggeredSafeFallback = false;

    // Initial query attempt: Search across username and display_name
    try {
      let qInitial = supabase.from('profiles').select('*');
      if (currentUserId) qInitial = qInitial.neq('id', currentUserId);
      qInitial = qInitial.or(`username.ilike.%${cleanQ}%,display_name.ilike.%${cleanQ}%`);

      const resInitial = (await executeWithTimeout(qInitial.limit(50), timeoutMs)) as any;

      if (!resInitial.error && resInitial.data && resInitial.data.length > 0) {
        liveProfiles = resInitial.data;
        queryLogs.push({ tier: 'Initial (username + display_name)', count: resInitial.data.length });
      } else if (resInitial.error) {
        queryLogs.push({ tier: 'Initial (username + display_name)', error: resInitial.error });
        if (isPostgrestSchemaOrBadRequest(resInitial.error)) {
          console.warn('[SocialSearch] Caught PostgREST 400/schema error on initial query. Triggering safe username-only fallback:', resInitial.error);
          triggeredSafeFallback = true;
        } else if (isNetworkOrTimeout(resInitial.error)) {
          isNetworkDown = true;
        } else {
          triggeredSafeFallback = true;
        }
      } else {
        // 0 matches found via combined or() filter; also trigger safe username-only query to catch pure username matches
        triggeredSafeFallback = true;
      }
    } catch (err: any) {
      queryLogs.push({ tier: 'Initial (username + display_name)', error: err?.message || err });
      if (isPostgrestSchemaOrBadRequest(err)) {
        console.warn('[SocialSearch] Exception in initial query matched PostgREST 400/schema error. Triggering safe username-only fallback:', err);
        triggeredSafeFallback = true;
      } else if (isNetworkOrTimeout(err)) {
        isNetworkDown = true;
      } else {
        triggeredSafeFallback = true;
      }
    }

    // Strict Safe Fallback: Catch PostgREST 400/schema errors and query ONLY the username column
    if (liveProfiles.length === 0 && !isNetworkDown && triggeredSafeFallback) {
      try {
        let qSafe = supabase.from('profiles').select('*');
        if (currentUserId) qSafe = qSafe.neq('id', currentUserId);
        // ONLY searches the username column, completely ignoring full_name and display_name
        qSafe = qSafe.ilike('username', `%${cleanQ}%`);

        const resSafe = (await executeWithTimeout(qSafe.limit(50), timeoutMs)) as any;
        if (!resSafe.error && resSafe.data && resSafe.data.length > 0) {
          liveProfiles = resSafe.data;
          queryLogs.push({ tier: 'Safe Fallback (username only)', count: resSafe.data.length });
        } else if (resSafe.error) {
          queryLogs.push({ tier: 'Safe Fallback (username only)', error: resSafe.error });
          console.error('[SocialSearch] Safe username fallback error:', resSafe.error);
        }
      } catch (err: any) {
        queryLogs.push({ tier: 'Safe Fallback (username only)', error: err?.message || err });
        console.error('[SocialSearch] Safe username fallback exception:', err);
      }
    }
  } else {
    // Initial load without query: get recent profiles
    try {
      let qInitial = supabase.from('profiles').select('*');
      if (currentUserId) qInitial = qInitial.neq('id', currentUserId);
      const resInit = (await executeWithTimeout(qInitial.limit(30), timeoutMs)) as any;
      if (!resInit.error && resInit.data) {
        liveProfiles = resInit.data;
        queryLogs.push({ tier: 'Initial All Profiles', count: resInit.data.length });
      } else {
        queryLogs.push({ tier: 'Initial All Profiles', error: resInit.error });
      }
    } catch (err: any) {
      queryLogs.push({ tier: 'Initial All Profiles', error: err?.message || err });
    }
  }

  // Extensive logging for debugging live Supabase behavior in browser console
  if (liveProfiles.length === 0) {
    console.error('[SocialSearch] Supabase returned 0 profiles. Diagnostic log:', {
      rawQuery: query,
      cleanQuery: cleanQ,
      currentUserId,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'default (http://127.0.0.1:54321)',
      queryLogs,
    });
  } else {
    console.log('[SocialSearch] Supabase returned live profiles:', {
      query: cleanQ,
      count: liveProfiles.length,
      usernames: liveProfiles.map((p) => p.username),
      queryLogs,
    });
  }

  // Populate live profiles with complete null safety
  liveProfiles.forEach((sp: any) => {
    const resolvedUsername = sp.username || 'user';
    const resolvedDisplayName =
      (typeof sp.full_name === 'string' && sp.full_name.trim()) ||
      (typeof sp.display_name === 'string' && sp.display_name.trim()) ||
      resolvedUsername;

    allProfilesMap.set(sp.id, {
      id: sp.id,
      username: resolvedUsername,
      display_name: resolvedDisplayName,
      avatar_url: sp.avatar_url || null,
      bio: sp.bio || null,
      library_visibility: sp.library_visibility || 'public',
      activity_visibility: sp.activity_visibility || 'public',
      follower_count: sp.follower_count || 0,
      following_count: sp.following_count || 0,
    });
  });

  // 2. Curated community profiles and local mock dynamic seeds for offline/testing fallback
  MOCK_COMMUNITY_PROFILES.forEach((p) => {
    if (!allProfilesMap.has(p.id)) {
      allProfilesMap.set(p.id, p);
    }
  });

  try {
    const dynamicProfiles: Record<string, any> = JSON.parse(
      localStorage.getItem('trackup_mock_profiles') || '{}'
    );
    Object.values(dynamicProfiles).forEach((p: any) => {
      if (p && p.id && !allProfilesMap.has(p.id)) {
        allProfilesMap.set(p.id, {
          id: p.id,
          username: p.username,
          display_name: p.full_name || p.display_name || p.username,
          avatar_url: p.avatar_url || null,
          bio: p.bio || null,
          library_visibility: p.library_visibility || 'public',
          activity_visibility: p.activity_visibility || 'public',
          follower_count: 0,
          following_count: 0,
        });
      }
    });
  } catch {
    // ignore
  }

  const lowerQ = cleanQ.toLowerCase();
  const list = Array.from(allProfilesMap.values()).filter((p) => {
    if (p.id === currentUserId) return false;
    if (!lowerQ) return true;
    return (
      p.username.toLowerCase() === lowerQ ||
      p.username.toLowerCase().includes(lowerQ) ||
      (p.display_name && p.display_name.toLowerCase().includes(lowerQ)) ||
      (p.bio && p.bio.toLowerCase().includes(lowerQ))
    );
  });

  // Prioritize exact username matches
  list.sort((a, b) => {
    const aExact = a.username.toLowerCase() === lowerQ ? 1 : 0;
    const bExact = b.username.toLowerCase() === lowerQ ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return (b.follower_count || 0) - (a.follower_count || 0);
  });

  return list.map((p) => ({
    ...p,
    is_following: follows.some((f) => f.follower_id === currentUserId && f.following_id === p.id),
  }));
}

export async function getFollowingActivityFeed(
  currentUserId: string,
  mode: 'following' | 'all' = 'following'
): Promise<ActivityFeedItem[]> {
  const allActivities = getStoredActivities();
  const follows = getStoredFollows();
  const followedIds = new Set(
    follows.filter((f) => f.follower_id === currentUserId).map((f) => f.following_id)
  );

  return allActivities
    .filter((act) => {
      // Owner always sees own activity
      if (act.user_id === currentUserId) return true;

      // Check author privacy setting
      const author = MOCK_COMMUNITY_PROFILES.find((p) => p.id === act.user_id);
      if (author?.activity_visibility === 'private') {
        return false;
      }

      if (author?.activity_visibility === 'followers_only') {
        if (!followedIds.has(act.user_id)) return false;
      }

      if (mode === 'following') {
        return followedIds.has(act.user_id);
      }

      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getRatingComparison(
  userAId: string,
  userBId: string,
  titleId: string
): Promise<RatingComparisonData | null> {
  const libraries = getStoredLibraries();

  const userAEntry = libraries.find((l) => l.user_id === userAId && l.title_id === titleId);
  const userBEntry = libraries.find((l) => l.user_id === userBId && l.title_id === titleId);

  // If user B doesn't have an entry in mock libraries, check if user_elena_cinema rated Inception (she did: 8/10)
  let userBRating = userBEntry?.rating ?? null;
  if (!userBRating && userBId === 'user_elena_cinema' && titleId === 'movie_inception_27205') {
    userBRating = 8; // 4.0 stars
  }

  const userBProfile = MOCK_COMMUNITY_PROFILES.find((p) => p.id === userBId) || {
    username: 'friend',
    display_name: 'Friend',
  };

  const userARating = userAEntry?.rating ?? null;

  return {
    title_id: titleId,
    user_a_rating: userARating,
    user_b_rating: userBRating,
    user_b_username: userBProfile.username,
    user_b_name: userBProfile.display_name,
    delta:
      userARating !== null && userBRating !== null ? userARating - userBRating : null,
  };
}
