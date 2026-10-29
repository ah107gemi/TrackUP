export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MediaType =
  | 'movie'
  | 'tv'
  | 'anime_series'
  | 'anime_film'
  | 'manga'
  | 'manhwa';

export type TrackingStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'paused'
  | 'dropped'
  | 'reconsuming';

export type RelationshipType =
  | 'adaptation'
  | 'sequel'
  | 'prequel'
  | 'spin_off'
  | 'side_story'
  | 'parent'
  | 'other';

export type PrivacyLevel = 'private' | 'followers_only' | 'public';

export type ImportBatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type ImportItemStatus =
  | 'pending'
  | 'exact_match'
  | 'ambiguous_match'
  | 'unmatched'
  | 'invalid'
  | 'committed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          full_name?: string | null;
          avatar_url: string | null;
          banner_url?: string | null;
          bio: string | null;
          library_visibility: PrivacyLevel;
          activity_visibility: PrivacyLevel;
          rating_display_preference: 'stars_5' | 'points_10';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          library_visibility?: PrivacyLevel;
          activity_visibility?: PrivacyLevel;
          rating_display_preference?: 'stars_5' | 'points_10';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          library_visibility?: PrivacyLevel;
          activity_visibility?: PrivacyLevel;
          rating_display_preference?: 'stars_5' | 'points_10';
          created_at?: string;
          updated_at?: string;
        };
      };
      catalog_titles: {
        Row: {
          id: string;
          media_type: MediaType;
          title: string;
          original_title: string | null;
          release_year: number | null;
          synopsis: string | null;
          poster_url: string | null;
          backdrop_url: string | null;
          genres: string[];
          origin_country: string | null;
          status: string | null;
          total_episodes: number | null;
          total_seasons: number | null;
          total_chapters: number | null;
          total_volumes: number | null;
          runtime_minutes: number | null;
          tmdb_id: number | null;
          imdb_id: string | null;
          anilist_id: number | null;
          mal_id: number | null;
          metadata_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      user_libraries: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          status: TrackingStatus;
          rating: number | null;
          is_private: boolean;
          personal_notes: string | null;
          started_at: string | null;
          completed_at: string | null;
          last_progressed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title_id: string;
          status?: TrackingStatus;
          rating?: number | null;
          is_private?: boolean;
          personal_notes?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          last_progressed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          status?: TrackingStatus;
          rating?: number | null;
          is_private?: boolean;
          personal_notes?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          last_progressed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
