import type { Review, CreateReviewParams } from './reviewTypes';

const LOCAL_STORAGE_REVIEWS_KEY = 'trackup_reviews';

export function getStoredReviews(): Review[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredReviews(reviews: Review[]): void {
  localStorage.setItem(LOCAL_STORAGE_REVIEWS_KEY, JSON.stringify(reviews));
}

export async function fetchReviewsForTitle(titleId: string): Promise<Review[]> {
  const stored = getStoredReviews();
  return stored.filter((r) => r.title_id === titleId);
}

export async function fetchReviewsForUser(userId: string): Promise<Review[]> {
  const stored = getStoredReviews();
  return stored.filter((r) => r.user_id === userId);
}

export async function createOrUpdateReview(params: CreateReviewParams): Promise<Review> {
  const all = getStoredReviews();
  const existingIndex = all.findIndex(
    (r) => r.user_id === params.userId && r.title_id === params.titleId
  );
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const existing = all[existingIndex];
    const updated: Review = {
      ...existing,
      rating: params.rating,
      review_text: params.reviewText,
      contains_spoilers: params.containsSpoilers,
      visibility: params.visibility,
      updated_at: now,
      author_name: params.authorName || existing.author_name,
      author_username: params.authorUsername || existing.author_username,
    };
    all[existingIndex] = updated;
    saveStoredReviews(all);
    return updated;
  }

  const newReview: Review = {
    id: `rev_${Math.random().toString(36).substring(2, 10)}`,
    user_id: params.userId,
    title_id: params.titleId,
    rating: params.rating,
    review_text: params.reviewText,
    contains_spoilers: params.containsSpoilers,
    visibility: params.visibility,
    created_at: now,
    updated_at: now,
    author_name: params.authorName || 'Anonymous',
    author_username: params.authorUsername || 'user',
  };

  all.unshift(newReview);
  saveStoredReviews(all);
  return newReview;
}

export async function deleteReview(reviewId: string, userId: string): Promise<boolean> {
  const all = getStoredReviews();
  const target = all.find((r) => r.id === reviewId);
  if (!target) return false;

  // Enforce ownership
  if (target.user_id !== userId) {
    throw new Error('Unauthorized: You can only delete your own reviews.');
  }

  const filtered = all.filter((r) => r.id !== reviewId);
  saveStoredReviews(filtered);
  return true;
}
