-- Migration: 20261025000001_initial_schema.sql
-- Description: Core schema for TrackUp (Profiles, Catalog, Libraries, Progress, Reviews, Social, RLS)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
CREATE TYPE media_type AS ENUM (
  'movie',
  'tv',
  'anime_series',
  'anime_film',
  'manga',
  'manhwa'
);

CREATE TYPE tracking_status AS ENUM (
  'planned',
  'active',
  'completed',
  'paused',
  'dropped',
  'reconsuming'
);

CREATE TYPE relationship_type AS ENUM (
  'adaptation',
  'sequel',
  'prequel',
  'spin_off',
  'side_story',
  'parent',
  'other'
);

CREATE TYPE privacy_level AS ENUM (
  'private',
  'followers_only',
  'public'
);

CREATE TYPE import_batch_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'cancelled',
  'failed'
);

CREATE TYPE import_item_status AS ENUM (
  'pending',
  'exact_match',
  'ambiguous_match',
  'unmatched',
  'invalid',
  'committed'
);

-- 3. PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  library_visibility privacy_level NOT NULL DEFAULT 'public',
  activity_visibility privacy_level NOT NULL DEFAULT 'public',
  rating_display_preference TEXT NOT NULL DEFAULT 'stars_5' CHECK (rating_display_preference IN ('stars_5', 'points_10')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Automatic Profile Creation Trigger on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTRING(NEW.id::text, 1, 6)
    ),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. SHARED CATALOG TITLES
CREATE TABLE catalog_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type media_type NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  release_year INTEGER,
  synopsis TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  origin_country TEXT,
  status TEXT DEFAULT 'released',
  total_episodes INTEGER,
  total_seasons INTEGER,
  total_chapters NUMERIC,
  total_volumes INTEGER,
  runtime_minutes INTEGER,
  tmdb_id INTEGER,
  imdb_id TEXT,
  anilist_id INTEGER,
  mal_id INTEGER,
  metadata_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique indexes on external provider IDs to avoid catalog duplication
CREATE UNIQUE INDEX idx_catalog_tmdb ON catalog_titles (tmdb_id, media_type) WHERE tmdb_id IS NOT NULL;
CREATE UNIQUE INDEX idx_catalog_anilist ON catalog_titles (anilist_id) WHERE anilist_id IS NOT NULL;
CREATE INDEX idx_catalog_search ON catalog_titles USING gin (to_tsvector('english', title));

-- 5. CATALOG SEASONS & EPISODES (WATCH PROGRESS)
CREATE TABLE catalog_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  name TEXT,
  overview TEXT,
  poster_url TEXT,
  episode_count INTEGER NOT NULL DEFAULT 0,
  air_date DATE,
  UNIQUE(title_id, season_number)
);

CREATE TABLE catalog_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES catalog_seasons(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  absolute_episode_number INTEGER,
  name TEXT,
  overview TEXT,
  runtime_minutes INTEGER,
  air_date DATE,
  still_url TEXT,
  UNIQUE(season_id, episode_number)
);

CREATE INDEX idx_episodes_title_id ON catalog_episodes (title_id);

-- 6. TITLE RELATIONSHIPS (ADAPTATIONS & SEQUELS)
CREATE TABLE title_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  target_title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(source_title_id, target_title_id, relationship_type)
);

-- 7. USER LIBRARIES
CREATE TABLE user_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  status tracking_status NOT NULL DEFAULT 'planned',
  rating SMALLINT CHECK (rating >= 1 AND rating <= 10),
  is_private BOOLEAN NOT NULL DEFAULT false,
  personal_notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_progressed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, title_id)
);

CREATE INDEX idx_user_libraries_user ON user_libraries (user_id);
CREATE INDEX idx_user_libraries_title ON user_libraries (title_id);
CREATE INDEX idx_user_libraries_status ON user_libraries (user_id, status);

-- 8. EPISODIC & READING PROGRESS
CREATE TABLE user_episode_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES user_libraries(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES catalog_episodes(id) ON DELETE CASCADE,
  watched BOOLEAN NOT NULL DEFAULT true,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, episode_id)
);

CREATE TABLE user_reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES user_libraries(id) ON DELETE CASCADE,
  last_chapter_read NUMERIC NOT NULL DEFAULT 0,
  last_volume_read INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(library_id)
);

-- 9. CHRONOLOGICAL LOGS & HISTORY
CREATE TABLE watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES user_libraries(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES catalog_episodes(id) ON DELETE SET NULL,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_rewatch BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE reading_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES user_libraries(id) ON DELETE CASCADE,
  chapter_number NUMERIC NOT NULL,
  volume_number INTEGER,
  read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_reread BOOLEAN NOT NULL DEFAULT false
);

-- 10. REVIEWS & USER FAVORITES
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 10),
  review_text TEXT NOT NULL,
  contains_spoilers BOOLEAN NOT NULL DEFAULT false,
  visibility privacy_level NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, title_id)
);

CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, title_id)
);

-- 11. IMPORT STAGING & BATCHING
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  filename TEXT NOT NULL,
  status import_batch_status NOT NULL DEFAULT 'pending',
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE import_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  raw_title TEXT NOT NULL,
  raw_year TEXT,
  raw_media_type TEXT,
  raw_external_id TEXT,
  raw_payload JSONB,
  status import_item_status NOT NULL DEFAULT 'pending',
  resolved_title_id UUID REFERENCES catalog_titles(id) ON DELETE SET NULL,
  candidate_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_fingerprint TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. SOCIAL GRAPH & ACTIVITY LOGS
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id <> following_id)
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  title_id UUID REFERENCES catalog_titles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_activity_user ON activity_logs (user_id, created_at DESC);

-- ==========================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on ALL tables in public schema
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_episode_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Is following?
CREATE OR REPLACE FUNCTION public.is_following(p_target_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_follows
    WHERE follower_id = auth.uid() AND following_id = p_target_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles:
-- Public can read profiles unless private; owner can always read & edit
CREATE POLICY "Profiles readable by public or owner"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR library_visibility = 'public'
    OR (library_visibility = 'followers_only' AND public.is_following(id))
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Catalog:
-- Anyone can view catalog metadata; updates restricted to service role
CREATE POLICY "Catalog titles are publicly readable"
  ON catalog_titles FOR SELECT
  USING (true);

CREATE POLICY "Catalog seasons are publicly readable"
  ON catalog_seasons FOR SELECT
  USING (true);

CREATE POLICY "Catalog episodes are publicly readable"
  ON catalog_episodes FOR SELECT
  USING (true);

CREATE POLICY "Title relationships are publicly readable"
  ON title_relationships FOR SELECT
  USING (true);

-- User Libraries:
-- Owner full control. Others can view if entry is not private and user profile is public/followed
CREATE POLICY "Users have full control of own library"
  ON user_libraries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public library entries readable according to privacy"
  ON user_libraries FOR SELECT
  USING (
    is_private = false AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_libraries.user_id
        AND (
          p.library_visibility = 'public'
          OR (p.library_visibility = 'followers_only' AND public.is_following(p.id))
        )
      )
    )
  );

-- Episode & Reading Progress:
-- Only owner can view and mutate their own granular progress
CREATE POLICY "Users manage own episode progress"
  ON user_episode_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own reading progress"
  ON user_reading_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Watch & Reading History:
-- Only owner can view and mutate history
CREATE POLICY "Users manage own watch history"
  ON watch_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own reading history"
  ON reading_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reviews:
-- Owner full control. Others can view if review visibility allows
CREATE POLICY "Users manage own reviews"
  ON reviews FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public and follower reviews readable"
  ON reviews FOR SELECT
  USING (
    visibility = 'public'
    OR (visibility = 'followers_only' AND public.is_following(user_id))
  );

-- User Favorites:
CREATE POLICY "Users manage own favorites"
  ON user_favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Favorites readable if profile is visible"
  ON user_favorites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_favorites.user_id
      AND (
        p.library_visibility = 'public'
        OR (p.library_visibility = 'followers_only' AND public.is_following(p.id))
      )
    )
  );

-- Import Batches & Items:
-- Strictly owner isolated
CREATE POLICY "Users manage own import batches"
  ON import_batches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own import items"
  ON import_batch_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.import_batches b
      WHERE b.id = import_batch_items.batch_id
      AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.import_batches b
      WHERE b.id = import_batch_items.batch_id
      AND b.user_id = auth.uid()
    )
  );

-- Social: User Follows
CREATE POLICY "Follows are viewable by anyone"
  ON user_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others"
  ON user_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Activity Logs:
CREATE POLICY "Users can create own activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Activity logs readable according to user visibility"
  ON activity_logs FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = activity_logs.user_id
      AND (
        p.activity_visibility = 'public'
        OR (p.activity_visibility = 'followers_only' AND public.is_following(p.id))
      )
    )
  );
