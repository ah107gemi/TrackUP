import type { PrivacyLevel } from '../../types/database.types';

export interface Review {
  id: string;
  user_id: string;
  title_id: string;
  rating: number; // 1 to 10 scale (where 10 = 5.0 stars, 1 = 0.5 stars)
  review_text: string;
  contains_spoilers: boolean;
  visibility: PrivacyLevel;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_username?: string;
}

export interface CreateReviewParams {
  userId: string;
  titleId: string;
  rating: number;
  reviewText: string;
  containsSpoilers: boolean;
  visibility: PrivacyLevel;
  authorName?: string;
  authorUsername?: string;
}

export interface UpdateReviewParams {
  id: string;
  userId: string;
  rating?: number;
  reviewText?: string;
  containsSpoilers?: boolean;
  visibility?: PrivacyLevel;
}
