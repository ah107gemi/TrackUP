import type { MediaType, PrivacyLevel } from '../../types/database.types';

export interface SocialProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  library_visibility: PrivacyLevel;
  activity_visibility: PrivacyLevel;
  follower_count: number;
  following_count: number;
  is_following?: boolean;
}

export type ActivityType =
  | 'watch_episode'
  | 'complete_title'
  | 'read_chapter'
  | 'rate_title'
  | 'publish_review';

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  activity_type: ActivityType;
  title_id: string;
  title_name: string;
  media_type: MediaType;
  poster_url?: string;
  metadata: {
    episode_number?: number;
    chapter_number?: number;
    rating?: number; // 1-10 scale
    review_excerpt?: string;
  };
  created_at: string;
}

export interface RatingComparisonData {
  title_id: string;
  user_a_rating: number | null; // 1-10
  user_b_rating: number | null; // 1-10
  user_b_username: string;
  user_b_name: string;
  delta: number | null; // e.g. +1 point (+0.5 star)
}
