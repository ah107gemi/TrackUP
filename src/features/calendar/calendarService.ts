import type { ReleaseScheduleItem } from './types';
import type { UserLibraryItem } from '../library/libraryService';

export const MOCK_RELEASE_SCHEDULES: ReleaseScheduleItem[] = [
  {
    id: 'rel_aot_ep89',
    title_id: 'anime_aot_1429',
    title_name: 'Attack on Titan',
    media_type: 'anime_series',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg',
    release_type: 'episode',
    item_number: 89,
    item_title: 'The Battle of Heaven and Earth',
    air_date: '2026-10-25T17:00:00Z',
    day_of_week: 0, // Sunday
  },
  {
    id: 'rel_inception_remaster',
    title_id: 'movie_inception_27205',
    title_name: 'Inception',
    media_type: 'movie',
    poster_url: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    release_type: 'season',
    item_number: 1,
    item_title: '15th Anniversary IMAX Special',
    air_date: '2026-10-26T20:00:00Z',
    day_of_week: 1, // Monday
  },
  {
    id: 'rel_solo_ch180',
    title_id: 'manhwa_solo_leveling_105398',
    title_name: 'Solo Leveling',
    media_type: 'manhwa',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b673Vt5ZSuz3.jpg',
    release_type: 'chapter',
    item_number: 180,
    item_title: 'After Story Chapter 1: The New Shadow',
    air_date: '2026-10-27T14:00:00Z',
    day_of_week: 2, // Tuesday
  },
  {
    id: 'rel_aot_manga_special',
    title_id: 'manga_aot_30013',
    title_name: 'Attack on Titan (Manga)',
    media_type: 'manga',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg',
    release_type: 'chapter',
    item_number: 140,
    item_title: 'Bessatsu Shonen Anniversary Bonus',
    air_date: '2026-10-28T15:00:00Z',
    day_of_week: 3, // Wednesday
  },
  {
    id: 'rel_bb_special',
    title_id: 'tv_breaking_bad_1396',
    title_name: 'Breaking Bad',
    media_type: 'tv',
    poster_url: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    release_type: 'episode',
    item_number: 63,
    item_title: 'Bryan Cranston & Aaron Paul Retrospective',
    air_date: '2026-10-29T21:00:00Z',
    day_of_week: 4, // Thursday
  },
  {
    id: 'rel_spirited_4k',
    title_id: 'film_spirited_away_129',
    title_name: 'Spirited Away',
    media_type: 'anime_film',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199-sWefXJvXkDOb.jpg',
    release_type: 'volume',
    item_number: 1,
    item_title: 'Studio Ghibli 4K Ultra HD Edition',
    air_date: '2026-10-30T18:00:00Z',
    day_of_week: 5, // Friday
  },
];

export const DAYS_OF_WEEK = [
  { day: 0, label: 'Sun', fullLabel: 'Sunday' },
  { day: 1, label: 'Mon', fullLabel: 'Monday' },
  { day: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { day: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { day: 4, label: 'Thu', fullLabel: 'Thursday' },
  { day: 5, label: 'Fri', fullLabel: 'Friday' },
  { day: 6, label: 'Sat', fullLabel: 'Saturday' },
];

/**
 * Filter releases by day of week and tracked status.
 */
export function filterReleases(
  releases: ReleaseScheduleItem[],
  userLibraries: UserLibraryItem[],
  dayOfWeek: number | null = null,
  trackedOnly: boolean = false
): ReleaseScheduleItem[] {
  const trackedTitleIds = new Set(userLibraries.map((u) => u.title_id));

  return releases
    .map((item) => ({
      ...item,
      is_in_user_library: trackedTitleIds.has(item.title_id),
    }))
    .filter((item) => {
      if (dayOfWeek !== null && item.day_of_week !== dayOfWeek) {
        return false;
      }
      if (trackedOnly && !item.is_in_user_library) {
        return false;
      }
      return true;
    });
}

/**
 * Helper to get human-readable countdown or air day tag
 */
export function formatAirDate(airDateIso: string, dayOfWeek: number): string {
  const dayName = DAYS_OF_WEEK.find((d) => d.day === dayOfWeek)?.fullLabel || 'Upcoming';
  const date = new Date(airDateIso);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dayName} at ${timeStr}`;
}
