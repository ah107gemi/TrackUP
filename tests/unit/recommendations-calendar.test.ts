import { describe, it, expect } from 'vitest';
import {
  calculateCrossFormatRecommendations,
  calculateGenreAffinityRecommendations,
  getPersonalizedRecommendations,
} from '../../src/features/recommendations/recommendationService';
import {
  filterReleases,
  formatAirDate,
  MOCK_RELEASE_SCHEDULES,
} from '../../src/features/calendar/calendarService';
import { MOCK_CATALOG_FIXTURES } from '../../src/features/catalog/catalogService';
import type { UserLibraryItem } from '../../src/features/library/libraryService';

describe('Phase 7 Recommendations Engine', () => {
  const dummyMangaLibraryItem: UserLibraryItem = {
    id: 'lib_manga_1',
    user_id: 'user_123',
    title_id: 'manga_aot_30013',
    status: 'completed',
    rating: 10,
    is_private: false,
    personal_notes: 'Masterpiece',
    started_at: '2023-01-01',
    completed_at: '2023-02-01',
    last_progressed_at: '2023-02-01T00:00:00Z',
    last_chapter_read: 139,
    last_volume_read: 34,
    episodes_watched: [],
    title: MOCK_CATALOG_FIXTURES.find((f) => f.id === 'manga_aot_30013')!,
  };

  const dummyAnimeLibraryItem: UserLibraryItem = {
    id: 'lib_anime_1',
    user_id: 'user_123',
    title_id: 'anime_aot_1429',
    status: 'active',
    rating: 9,
    is_private: false,
    personal_notes: null,
    started_at: '2023-01-01',
    completed_at: null,
    last_progressed_at: '2023-01-10T00:00:00Z',
    last_chapter_read: 0,
    last_volume_read: 0,
    episodes_watched: ['e1'],
    title: MOCK_CATALOG_FIXTURES.find((f) => f.id === 'anime_aot_1429')!,
  };

  it('generates cross-format adaptation recommendation when user tracked manga', () => {
    const userLibraries = [dummyMangaLibraryItem];
    const recs = calculateCrossFormatRecommendations(userLibraries);

    expect(recs.length).toBeGreaterThan(0);
    const animeRec = recs.find((r) => r.id === 'anime_aot_1429');
    expect(animeRec).toBeDefined();
    expect(animeRec?.reasonType).toBe('cross_format_adaptation');
    expect(animeRec?.reason).toContain('Watch the Anime Adaptation');
    expect(animeRec?.matchScore).toBe(98);
  });

  it('generates reverse cross-format recommendation when user tracked anime', () => {
    const userLibraries = [dummyAnimeLibraryItem];
    const recs = calculateCrossFormatRecommendations(userLibraries);

    expect(recs.length).toBeGreaterThan(0);
    const mangaRec = recs.find((r) => r.id === 'manga_aot_30013');
    expect(mangaRec).toBeDefined();
    expect(mangaRec?.reasonType).toBe('cross_format_adaptation');
    expect(mangaRec?.reason).toContain('Read the Source Manga');
  });

  it('does not recommend adaptations already tracked in user library', () => {
    // Both Manga and Anime are in library
    const userLibraries = [dummyMangaLibraryItem, dummyAnimeLibraryItem];
    const recs = calculateCrossFormatRecommendations(userLibraries);

    expect(recs.find((r) => r.id === 'anime_aot_1429')).toBeUndefined();
    expect(recs.find((r) => r.id === 'manga_aot_30013')).toBeUndefined();
  });

  it('computes genre affinity recommendations based on tracked titles', () => {
    const userLibraries = [dummyMangaLibraryItem]; // Genres: Action, Mystery, Supernatural
    const genreRecs = calculateGenreAffinityRecommendations(userLibraries);

    expect(genreRecs.length).toBeGreaterThan(0);
    // Solo Leveling shares 'Action'
    const soloLeveling = genreRecs.find((r) => r.id === 'manhwa_solo_leveling_105398');
    expect(soloLeveling).toBeDefined();
    expect(soloLeveling?.reasonType).toBe('genre_affinity');
    expect(soloLeveling?.reason).toContain('Matches your taste for');
    expect(soloLeveling?.matchScore).toBeGreaterThanOrEqual(70);
  });

  it('aggregates non-overlapping recommendations across shelves', async () => {
    const userLibraries = [dummyMangaLibraryItem];
    const { adaptations, genreAffinity, communityPicks } =
      await getPersonalizedRecommendations(userLibraries);

    const adaptationIds = new Set(adaptations.map((a) => a.id));
    const genreIds = new Set(genreAffinity.map((g) => g.id));

    // No title should be in both adaptations and genre affinity
    for (const gid of genreIds) {
      expect(adaptationIds.has(gid)).toBe(false);
    }

    // Community picks should not duplicate previous shelves
    for (const cp of communityPicks) {
      expect(adaptationIds.has(cp.id)).toBe(false);
      expect(genreIds.has(cp.id)).toBe(false);
    }
  });
});

describe('Phase 7 Airing & Release Calendar Service', () => {
  const dummyTrackedItem: UserLibraryItem = {
    id: 'lib_aot_1',
    user_id: 'user_123',
    title_id: 'anime_aot_1429',
    status: 'active',
    rating: 9,
    is_private: false,
    personal_notes: null,
    started_at: '2023-01-01',
    completed_at: null,
    last_progressed_at: '2023-01-10T00:00:00Z',
    last_chapter_read: 0,
    last_volume_read: 0,
    episodes_watched: [],
    title: MOCK_CATALOG_FIXTURES.find((f) => f.id === 'anime_aot_1429')!,
  };

  it('filters releases by day of the week', () => {
    // Sunday is 0
    const sundayReleases = filterReleases(MOCK_RELEASE_SCHEDULES, [], 0, false);
    expect(sundayReleases.length).toBeGreaterThan(0);
    expect(sundayReleases.every((r) => r.day_of_week === 0)).toBe(true);
    expect(sundayReleases[0].title_name).toBe('Attack on Titan');
  });

  it('filters releases for tracked titles only', () => {
    const allTracked = filterReleases(
      MOCK_RELEASE_SCHEDULES,
      [dummyTrackedItem],
      null,
      true
    );

    expect(allTracked.length).toBe(1);
    expect(allTracked[0].title_id).toBe('anime_aot_1429');
    expect(allTracked[0].is_in_user_library).toBe(true);
  });

  it('formats air dates with day and timestamp correctly', () => {
    const formatted = formatAirDate('2026-10-25T17:00:00Z', 0);
    expect(formatted).toContain('Sunday');
  });
});
