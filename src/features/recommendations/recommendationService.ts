import { MOCK_CATALOG_FIXTURES } from '../catalog/catalogService';
import type { UserLibraryItem } from '../library/libraryService';
import type { RecommendationItem } from './types';

/**
 * Pure heuristic calculator for cross-format adaptation recommendations.
 * E.g., if user tracked a Manga, recommend the Anime adaptation (and vice versa).
 */
export function calculateCrossFormatRecommendations(
  userLibraries: UserLibraryItem[],
  catalog: typeof MOCK_CATALOG_FIXTURES = MOCK_CATALOG_FIXTURES
): RecommendationItem[] {
  const trackedTitleIds = new Set(userLibraries.map((u) => u.title_id));
  const recs: RecommendationItem[] = [];

  for (const libraryItem of userLibraries) {
    const sourceFixture = catalog.find((c) => c.id === libraryItem.title_id);
    if (!sourceFixture || !sourceFixture.related_title_ids) continue;

    for (const rel of sourceFixture.related_title_ids) {
      if (rel.type === 'adaptation' && !trackedTitleIds.has(rel.targetId)) {
        const targetFixture = catalog.find((c) => c.id === rel.targetId);
        if (targetFixture && !recs.some((r) => r.id === targetFixture.id)) {
          const isSourceManga =
            sourceFixture.media_type === 'manga' || sourceFixture.media_type === 'manhwa';
          const reason = isSourceManga
            ? `You tracked the ${sourceFixture.media_type.toUpperCase()} — Watch the Anime Adaptation!`
            : `You tracked the ${sourceFixture.media_type.replace('_', ' ').toUpperCase()} — Read the Source Manga!`;

          recs.push({
            id: targetFixture.id,
            title: targetFixture.title,
            media_type: targetFixture.media_type,
            poster_url: targetFixture.poster_url ?? null,
            backdrop_url: targetFixture.backdrop_url ?? null,
            genres: targetFixture.genres,
            reasonType: 'cross_format_adaptation',
            reason,
            sourceTitleName: sourceFixture.title,
            matchScore: 98,
            catalogItem: targetFixture,
          });
        }
      }
    }
  }

  return recs;
}

/**
 * Pure heuristic calculator for Genre Affinity recommendations.
 * Scores non-tracked catalog items based on user's favorite / highest-frequency genres.
 */
export function calculateGenreAffinityRecommendations(
  userLibraries: UserLibraryItem[],
  catalog: typeof MOCK_CATALOG_FIXTURES = MOCK_CATALOG_FIXTURES,
  excludeIds: Set<string> = new Set()
): RecommendationItem[] {
  const trackedTitleIds = new Set(userLibraries.map((u) => u.title_id));

  // Count genre frequencies across user's library
  const genreScores: Record<string, number> = {};
  for (const item of userLibraries) {
    const weight = item.status === 'completed' ? 2 : 1;
    const ratingWeight = item.rating ? item.rating / 5 : 1;
    for (const genre of item.title.genres) {
      genreScores[genre] = (genreScores[genre] || 0) + weight * ratingWeight;
    }
  }

  const topGenres = Object.entries(genreScores)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);

  if (topGenres.length === 0) {
    return [];
  }

  const recs: RecommendationItem[] = [];

  for (const fixture of catalog) {
    if (trackedTitleIds.has(fixture.id) || excludeIds.has(fixture.id)) continue;

    // Count matching genres
    const sharedGenres = fixture.genres.filter((g) => genreScores[g] !== undefined);
    if (sharedGenres.length > 0) {
      const bestGenre = sharedGenres.sort(
        (a, b) => (genreScores[b] || 0) - (genreScores[a] || 0)
      )[0];
      const matchScore = Math.min(
        95,
        Math.max(65, 70 + sharedGenres.length * 10)
      );

      recs.push({
        id: fixture.id,
        title: fixture.title,
        media_type: fixture.media_type,
        poster_url: fixture.poster_url ?? null,
        backdrop_url: fixture.backdrop_url ?? null,
        genres: fixture.genres,
        reasonType: 'genre_affinity',
        reason: `Matches your taste for ${bestGenre} (${sharedGenres.join(', ')})`,
        matchScore,
        catalogItem: fixture,
      });
    }
  }

  return recs.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Fallback Community Top Rated picks for fresh/new users.
 */
export function getCommunityTopPicks(
  userLibraries: UserLibraryItem[],
  catalog: typeof MOCK_CATALOG_FIXTURES = MOCK_CATALOG_FIXTURES,
  excludeIds: Set<string> = new Set()
): RecommendationItem[] {
  const trackedTitleIds = new Set(userLibraries.map((u) => u.title_id));

  return catalog
    .filter((f) => !trackedTitleIds.has(f.id) && !excludeIds.has(f.id))
    .map((f) => ({
      id: f.id,
      title: f.title,
      media_type: f.media_type,
      poster_url: f.poster_url ?? null,
      backdrop_url: f.backdrop_url ?? null,
      genres: f.genres,
      reasonType: 'community_top_rated',
      reason: 'Highly rated across the TrackUp community',
      matchScore: 90,
      catalogItem: f,
    }));
}

/**
 * Comprehensive recommendation getter combining adaptations, genre affinity, and top picks.
 */
export async function getPersonalizedRecommendations(
  userLibraries: UserLibraryItem[]
): Promise<{
  adaptations: RecommendationItem[];
  genreAffinity: RecommendationItem[];
  communityPicks: RecommendationItem[];
}> {
  const adaptations = calculateCrossFormatRecommendations(userLibraries);
  const excludedIds = new Set(adaptations.map((a) => a.id));

  const genreAffinity = calculateGenreAffinityRecommendations(
    userLibraries,
    MOCK_CATALOG_FIXTURES,
    excludedIds
  );

  for (const g of genreAffinity) {
    excludedIds.add(g.id);
  }

  const communityPicks = getCommunityTopPicks(
    userLibraries,
    MOCK_CATALOG_FIXTURES,
    excludedIds
  );

  return {
    adaptations,
    genreAffinity,
    communityPicks,
  };
}
