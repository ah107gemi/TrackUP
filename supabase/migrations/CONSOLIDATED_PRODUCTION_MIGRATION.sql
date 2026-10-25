-- ============================================================================
-- MIGRATION: 20261025000001_initial_schema.sql
-- ============================================================================

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


-- ============================================================================
-- MIGRATION: 20261025000002_progress_rpc.sql
-- ============================================================================

-- Migration: 20261025000002_progress_rpc.sql
-- Description: Atomic RPC functions for logging episode and reading progress with immutable history tracking

-- 1. RPC: log_episode_progress
CREATE OR REPLACE FUNCTION public.log_episode_progress(
  p_library_id UUID,
  p_episode_id UUID,
  p_watched BOOLEAN,
  p_is_rewatch BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_title_id UUID;
  v_result JSONB;
BEGIN
  -- Authenticate owner
  SELECT user_id, title_id INTO v_user_id, v_title_id
  FROM public.user_libraries
  WHERE id = p_library_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this library entry';
  END IF;

  -- 1. Upsert episode watched state
  INSERT INTO public.user_episode_progress (
    user_id,
    library_id,
    episode_id,
    watched,
    watched_at
  )
  VALUES (
    v_user_id,
    p_library_id,
    p_episode_id,
    p_watched,
    timezone('utc'::text, now())
  )
  ON CONFLICT (user_id, episode_id)
  DO UPDATE SET
    watched = EXCLUDED.watched,
    watched_at = EXCLUDED.watched_at;

  -- 2. Update library timestamp
  UPDATE public.user_libraries
  SET
    last_progressed_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now()),
    status = CASE WHEN status = 'planned' THEN 'active'::tracking_status ELSE status END
  WHERE id = p_library_id;

  -- 3. Append immutable watch history record if watched
  IF p_watched THEN
    INSERT INTO public.watch_history (
      user_id,
      library_id,
      episode_id,
      watched_at,
      is_rewatch
    )
    VALUES (
      v_user_id,
      p_library_id,
      p_episode_id,
      timezone('utc'::text, now()),
      p_is_rewatch
    );
  END IF;

  SELECT to_jsonb(l.*) INTO v_result
  FROM public.user_libraries l
  WHERE l.id = p_library_id;

  RETURN v_result;
END;
$$;

-- 2. RPC: log_reading_progress
CREATE OR REPLACE FUNCTION public.log_reading_progress(
  p_library_id UUID,
  p_chapter NUMERIC,
  p_volume INTEGER DEFAULT NULL,
  p_is_reread BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_title_id UUID;
  v_result JSONB;
BEGIN
  -- Authenticate owner
  SELECT user_id, title_id INTO v_user_id, v_title_id
  FROM public.user_libraries
  WHERE id = p_library_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this library entry';
  END IF;

  -- 1. Upsert reading progress (supports fractional chapters like 10.5)
  INSERT INTO public.user_reading_progress (
    user_id,
    library_id,
    last_chapter_read,
    last_volume_read,
    updated_at
  )
  VALUES (
    v_user_id,
    p_library_id,
    p_chapter,
    COALESCE(p_volume, 0),
    timezone('utc'::text, now())
  )
  ON CONFLICT (library_id)
  DO UPDATE SET
    last_chapter_read = EXCLUDED.last_chapter_read,
    last_volume_read = COALESCE(EXCLUDED.last_volume_read, user_reading_progress.last_volume_read),
    updated_at = EXCLUDED.updated_at;

  -- 2. Update library timestamp
  UPDATE public.user_libraries
  SET
    last_progressed_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now()),
    status = CASE WHEN status = 'planned' THEN 'active'::tracking_status ELSE status END
  WHERE id = p_library_id;

  -- 3. Append immutable reading history log
  INSERT INTO public.reading_history (
    user_id,
    library_id,
    chapter_number,
    volume_number,
    read_at,
    is_reread
  )
  VALUES (
    v_user_id,
    p_library_id,
    p_chapter,
    p_volume,
    timezone('utc'::text, now()),
    p_is_reread
  );

  SELECT to_jsonb(l.*) INTO v_result
  FROM public.user_libraries l
  WHERE l.id = p_library_id;

  RETURN v_result;
END;
$$;

-- 3. RPC: batch_mark_season_watched
CREATE OR REPLACE FUNCTION public.batch_mark_season_watched(
  p_library_id UUID,
  p_season_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.user_libraries
  WHERE id = p_library_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this library entry';
  END IF;

  FOR r IN (
    SELECT id FROM public.catalog_episodes
    WHERE season_id = p_season_id
  ) LOOP
    PERFORM public.log_episode_progress(p_library_id, r.id, true, false);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ============================================================================
-- MIGRATION: 20261025000003_reviews_and_stats.sql
-- ============================================================================

-- 20261025000003_reviews_and_stats.sql
-- Phase 4: User Statistics Calculation RPC & Review Constraints

-- RPC to compute user statistics dynamically
CREATE OR REPLACE FUNCTION public.get_user_statistics(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_episodes_watched INTEGER := 0;
  v_total_chapters_read NUMERIC := 0;
  v_total_watch_time_minutes INTEGER := 0;
  v_media_distribution JSONB := '{}'::jsonb;
  v_rating_stats JSONB := '{}'::jsonb;
  v_total_titles INTEGER := 0;
  v_completed_titles INTEGER := 0;
  v_active_titles INTEGER := 0;
  v_result JSONB;
BEGIN
  -- 1. Total episodes watched from watch_history or user_episode_progress
  SELECT COUNT(DISTINCT episode_id)
  INTO v_total_episodes_watched
  FROM user_episode_progress
  WHERE user_id = p_user_id AND watched = true;

  -- 2. Total chapters read
  SELECT COALESCE(SUM(last_chapter_read), 0)
  INTO v_total_chapters_read
  FROM user_reading_progress
  WHERE user_id = p_user_id;

  -- 3. Total watch time in minutes
  -- Sum from watched episodes + completed movies
  SELECT COALESCE(SUM(e.runtime_minutes), 0)
  INTO v_total_watch_time_minutes
  FROM user_episode_progress uep
  JOIN catalog_episodes e ON e.id = uep.episode_id
  WHERE uep.user_id = p_user_id AND uep.watched = true;

  -- Add movie runtimes for completed movies
  v_total_watch_time_minutes := v_total_watch_time_minutes + COALESCE((
    SELECT SUM(t.runtime_minutes)
    FROM user_libraries ul
    JOIN catalog_titles t ON t.id = ul.title_id
    WHERE ul.user_id = p_user_id
      AND ul.status = 'completed'
      AND t.media_type IN ('movie', 'anime_film')
      AND t.runtime_minutes IS NOT NULL
  ), 0);

  -- 4. Media type distribution
  SELECT jsonb_object_agg(media_type, cnt)
  INTO v_media_distribution
  FROM (
    SELECT t.media_type, COUNT(*) as cnt
    FROM user_libraries ul
    JOIN catalog_titles t ON t.id = ul.title_id
    WHERE ul.user_id = p_user_id
    GROUP BY t.media_type
  ) dist;

  IF v_media_distribution IS NULL THEN
    v_media_distribution := '{}'::jsonb;
  END IF;

  -- 5. Title counts & ratings
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'active'),
    jsonb_build_object(
      'total_rated', COUNT(rating),
      'average_rating', COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
    )
  INTO 
    v_total_titles,
    v_completed_titles,
    v_active_titles,
    v_rating_stats
  FROM user_libraries
  WHERE user_id = p_user_id;

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'total_episodes_watched', v_total_episodes_watched,
    'total_chapters_read', v_total_chapters_read,
    'total_watch_time_minutes', v_total_watch_time_minutes,
    'watch_time_days', ROUND((v_total_watch_time_minutes::numeric / 1440.0), 1),
    'watch_time_hours', ROUND((v_total_watch_time_minutes::numeric / 60.0), 1),
    'media_distribution', v_media_distribution,
    'total_titles', v_total_titles,
    'completed_titles', v_completed_titles,
    'active_titles', v_active_titles,
    'ratings', v_rating_stats
  );

  RETURN v_result;
END;
$$;


-- ============================================================================
-- MIGRATION: 20261025000004_social_graph.sql
-- ============================================================================

-- 20261025000004_social_graph.sql
-- Phase 6: Social Graph, Activity Feeds & Rating Comparison RPCs

-- 1. Helper function: Get Following Activity Feed respecting RLS & privacy
CREATE OR REPLACE FUNCTION public.get_following_activity_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'activity_type', a.activity_type,
      'title_id', a.title_id,
      'title_name', t.title,
      'media_type', t.media_type,
      'poster_url', t.poster_url,
      'metadata', a.metadata,
      'created_at', a.created_at
    )
  )
  INTO v_feed
  FROM activity_logs a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN catalog_titles t ON t.id = a.title_id
  WHERE (
    -- Include followed users or self
    a.user_id = p_user_id
    OR a.user_id IN (
      SELECT following_id FROM user_follows WHERE follower_id = p_user_id
    )
  )
  AND (
    -- Strict privacy enforcement
    a.user_id = p_user_id
    OR (
      p.activity_visibility = 'public'
      OR (p.activity_visibility = 'followers_only' AND public.is_following(p.id))
    )
  )
  ORDER BY a.created_at DESC
  LIMIT p_limit;

  RETURN COALESCE(v_feed, '[]'::jsonb);
END;
$$;

-- 2. Helper function: Get Rating Comparison between two users on a title
CREATE OR REPLACE FUNCTION public.get_rating_comparison(
  p_user_a UUID,
  p_user_b UUID,
  p_title_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating_a SMALLINT;
  v_rating_b SMALLINT;
  v_result JSONB;
BEGIN
  SELECT rating INTO v_rating_a FROM user_libraries WHERE user_id = p_user_a AND title_id = p_title_id;
  SELECT rating INTO v_rating_b FROM user_libraries WHERE user_id = p_user_b AND title_id = p_title_id;

  v_result := jsonb_build_object(
    'title_id', p_title_id,
    'user_a_rating', v_rating_a,
    'user_b_rating', v_rating_b,
    'delta', CASE 
      WHEN v_rating_a IS NOT NULL AND v_rating_b IS NOT NULL THEN (v_rating_a - v_rating_b)
      ELSE NULL
    END
  );

  RETURN v_result;
END;
$$;


-- ============================================================================
-- MIGRATION: 20261025000005_phase7_recommendations_and_releases.sql
-- ============================================================================

-- ============================================================================
-- Migration: 20261025000005_phase7_recommendations_and_releases.sql
-- Description: Phase 7 Recommendations, Airing Calendar & Performance Hardening
-- ============================================================================

-- 1. Catalog Release Schedules table (Airing Calendar for TV, Anime, Manga, Manhwa)
CREATE TABLE IF NOT EXISTS public.catalog_release_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id UUID NOT NULL REFERENCES public.catalog_titles(id) ON DELETE CASCADE,
    release_type TEXT NOT NULL CHECK (release_type IN ('episode', 'chapter', 'season', 'volume')),
    item_number NUMERIC(6, 1) NOT NULL,
    item_title TEXT,
    air_date TIMESTAMPTZ NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday ... 6=Saturday
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable 100% RLS
ALTER TABLE public.catalog_release_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to catalog_release_schedules"
    ON public.catalog_release_schedules
    FOR SELECT
    USING (true);

CREATE POLICY "Allow service_role full management of catalog_release_schedules"
    ON public.catalog_release_schedules
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Performance Hardening Indexes (Supabase Advisors alignment)
CREATE INDEX IF NOT EXISTS idx_release_schedules_day_air 
    ON public.catalog_release_schedules (day_of_week, air_date ASC);

CREATE INDEX IF NOT EXISTS idx_release_schedules_title_id 
    ON public.catalog_release_schedules (title_id);

CREATE INDEX IF NOT EXISTS idx_user_libraries_user_status 
    ON public.user_libraries (user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_libraries_user_last_prog 
    ON public.user_libraries (user_id, last_progressed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_reviews_user_rating 
    ON public.reviews (user_id, rating DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_following 
    ON public.user_follows (follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_title_relationships_source 
    ON public.title_relationships (source_title_id, relationship_type);

-- 3. Database RPC: Get User Recommendations (Cross-format adaptations & Genre Affinity)
CREATE OR REPLACE FUNCTION public.get_user_recommendations(
    p_user_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    media_type public.media_type,
    poster_url TEXT,
    backdrop_url TEXT,
    genres TEXT[],
    recommendation_reason TEXT,
    source_title_name TEXT,
    match_score INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    -- A) Cross-Format Adaptations
    WITH user_tracked_titles AS (
        SELECT ul.title_id, ct.title as title_name, ul.status
        FROM public.user_libraries ul
        JOIN public.catalog_titles ct ON ct.id = ul.title_id
        WHERE ul.user_id = p_user_id
    ),
    adaptation_recs AS (
        SELECT 
            target.id,
            target.title,
            target.media_type,
            target.poster_url,
            target.backdrop_url,
            target.genres,
            ('Because you tracked ' || ut.title_name || ' (' || target.media_type::TEXT || ' adaptation)')::TEXT as recommendation_reason,
            ut.title_name::TEXT as source_title_name,
            98 as match_score
        FROM user_tracked_titles ut
        JOIN public.title_relationships tr ON tr.source_title_id = ut.title_id
        JOIN public.catalog_titles target ON target.id = tr.target_title_id
        WHERE target.id NOT IN (SELECT utt.title_id FROM user_tracked_titles utt)
    ),
    -- B) Genre affinity recommendations
    top_user_genres AS (
        SELECT unnest(ct.genres) as genre_name, COUNT(*) as frequency
        FROM public.user_libraries ul
        JOIN public.catalog_titles ct ON ct.id = ul.title_id
        WHERE ul.user_id = p_user_id
        GROUP BY 1
        ORDER BY frequency DESC
        LIMIT 3
    ),
    genre_recs AS (
        SELECT 
            ct.id,
            ct.title,
            ct.media_type,
            ct.poster_url,
            ct.backdrop_url,
            ct.genres,
            ('Based on your interest in ' || tg.genre_name)::TEXT as recommendation_reason,
            NULL::TEXT as source_title_name,
            88 as match_score
        FROM top_user_genres tg
        JOIN public.catalog_titles ct ON tg.genre_name = ANY(ct.genres)
        WHERE ct.id NOT IN (SELECT utt.title_id FROM user_tracked_titles utt)
          AND ct.id NOT IN (SELECT ar.id FROM adaptation_recs ar)
    )
    SELECT * FROM adaptation_recs
    UNION ALL
    SELECT * FROM genre_recs
    ORDER BY match_score DESC
    LIMIT p_limit;
END;
$$;

-- 4. Database RPC: Get Upcoming Releases (Calendar Schedule)
CREATE OR REPLACE FUNCTION public.get_upcoming_releases(
    p_user_id UUID DEFAULT NULL,
    p_day_of_week SMALLINT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title_id UUID,
    title_name TEXT,
    media_type public.media_type,
    poster_url TEXT,
    release_type TEXT,
    item_number NUMERIC(6, 1),
    item_title TEXT,
    air_date TIMESTAMPTZ,
    day_of_week SMALLINT,
    is_in_user_library BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id,
        rs.title_id,
        ct.title as title_name,
        ct.media_type,
        ct.poster_url,
        rs.release_type,
        rs.item_number,
        rs.item_title,
        rs.air_date,
        rs.day_of_week,
        CASE 
            WHEN p_user_id IS NOT NULL THEN EXISTS (
                SELECT 1 FROM public.user_libraries ul 
                WHERE ul.user_id = p_user_id AND ul.title_id = rs.title_id
            )
            ELSE false
        END as is_in_user_library
    FROM public.catalog_release_schedules rs
    JOIN public.catalog_titles ct ON ct.id = rs.title_id
    WHERE (p_day_of_week IS NULL OR rs.day_of_week = p_day_of_week)
    ORDER BY rs.air_date ASC;
END;
$$;


