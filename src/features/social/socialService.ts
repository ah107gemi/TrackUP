import type { SocialProfile, ActivityFeedItem, RatingComparisonData } from './types';
import { getStoredLibraries } from '../library/libraryService';

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
  const q = query.trim().toLowerCase();
  const follows = getStoredFollows();

  return MOCK_COMMUNITY_PROFILES.filter((p) => {
    if (p.id === currentUserId) return false;
    if (!q) return true;
    return (
      p.username.toLowerCase().includes(q) ||
      p.display_name.toLowerCase().includes(q) ||
      (p.bio && p.bio.toLowerCase().includes(q))
    );
  }).map((p) => ({
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
