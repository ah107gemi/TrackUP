import type { MediaType } from '../../types/database.types';

export interface ReleaseScheduleItem {
  id: string;
  title_id: string;
  title_name: string;
  media_type: MediaType;
  poster_url: string | null;
  release_type: 'episode' | 'chapter' | 'season' | 'volume';
  item_number: number;
  item_title: string;
  air_date: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  is_in_user_library?: boolean;
}
