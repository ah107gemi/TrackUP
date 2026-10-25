import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOrUpdateReview,
  deleteReview,
  fetchReviewsForTitle,
} from '../../src/features/reviews/reviewService';
import {
  toggleFavorite,
  removeFavorite,
  fetchUserFavorites,
  isTitleFavorite,
} from '../../src/features/favorites/favoritesService';

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

describe('Phase 4: Reviews, Spoilers & RLS Permissions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('allows a user to write and update their own review', async () => {
    const review = await createOrUpdateReview({
      userId: 'user-alice',
      titleId: 'title-dune-2',
      rating: 9, // 4.5 stars
      reviewText: 'Visually stunning cinematography and world-building.',
      containsSpoilers: false,
      visibility: 'public',
      authorName: 'Alice',
      authorUsername: 'alice',
    });

    expect(review.id).toBeDefined();
    expect(review.rating).toBe(9);
    expect(review.user_id).toBe('user-alice');

    // Updating existing review
    const updated = await createOrUpdateReview({
      userId: 'user-alice',
      titleId: 'title-dune-2',
      rating: 10,
      reviewText: 'Updated: Masterpiece on IMAX.',
      containsSpoilers: true,
      visibility: 'public',
    });

    expect(updated.id).toBe(review.id);
    expect(updated.rating).toBe(10);
    expect(updated.contains_spoilers).toBe(true);
    expect(updated.review_text).toContain('Updated');
  });

  it('enforces RLS: rejects attempts by User B to delete User A review', async () => {
    const review = await createOrUpdateReview({
      userId: 'user-alice',
      titleId: 'title-frieren-s1',
      rating: 10,
      reviewText: 'Frieren is poetic fantasy.',
      containsSpoilers: false,
      visibility: 'public',
    });

    // User Bob attempts to delete Alice's review
    await expect(deleteReview(review.id, 'user-bob')).rejects.toThrow(
      /Unauthorized: You can only delete your own reviews/i
    );

    // Review still exists
    const reviews = await fetchReviewsForTitle('title-frieren-s1');
    expect(reviews.length).toBe(1);

    // User Alice can delete her own review
    const deleted = await deleteReview(review.id, 'user-alice');
    expect(deleted).toBe(true);

    const afterDelete = await fetchReviewsForTitle('title-frieren-s1');
    expect(afterDelete.length).toBe(0);
  });

  it('respects spoiler flags and privacy levels', async () => {
    await createOrUpdateReview({
      userId: 'user-alice',
      titleId: 'title-solo-leveling-manga',
      rating: 9,
      reviewText: 'Jinwoo defeats the Monarch in the final confrontation!',
      containsSpoilers: true,
      visibility: 'public',
    });

    await createOrUpdateReview({
      userId: 'user-alice',
      titleId: 'title-private-note',
      rating: 8,
      reviewText: 'Personal private analysis.',
      containsSpoilers: false,
      visibility: 'private',
    });

    const reviews = await fetchReviewsForTitle('title-solo-leveling-manga');
    expect(reviews.length).toBe(1);
    expect(reviews[0].contains_spoilers).toBe(true);
  });
});

describe('Phase 4: Favorites System & Showcase', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('toggles favorites and isolates favorites per user', async () => {
    expect(isTitleFavorite('user-alice', 'tmdb_movie_693134')).toBe(false);

    // Alice favorites Dune
    const added = await toggleFavorite('user-alice', 'tmdb_movie_693134');
    expect(added).toBe(true);
    expect(isTitleFavorite('user-alice', 'tmdb_movie_693134')).toBe(true);

    // User Bob has not favorited it
    expect(isTitleFavorite('user-bob', 'tmdb_movie_693134')).toBe(false);
    const bobFavs = await fetchUserFavorites('user-bob');
    expect(bobFavs.length).toBe(0);

    const aliceFavs = await fetchUserFavorites('user-alice');
    expect(aliceFavs.length).toBe(1);
    expect(aliceFavs[0].title_id).toBe('tmdb_movie_693134');

    // Remove favorite
    await removeFavorite('user-alice', 'tmdb_movie_693134');
    expect(isTitleFavorite('user-alice', 'tmdb_movie_693134')).toBe(false);
  });
});
