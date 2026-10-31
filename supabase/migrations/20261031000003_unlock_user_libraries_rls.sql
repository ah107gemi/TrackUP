-- ==============================================================================
-- Migration: 20261031000003_unlock_user_libraries_rls.sql
-- Description: Allow public reads on user_libraries where is_private = false,
--              and allow public reads on episodic and reading progress tables
--              for public social profiles.
-- ==============================================================================

-- 1. USER LIBRARIES TABLE
ALTER TABLE public.user_libraries ENABLE ROW LEVEL SECURITY;

-- Drop previous restrictive or conflicting SELECT policies
DROP POLICY IF EXISTS "Public library entries readable according to privacy" ON public.user_libraries;
DROP POLICY IF EXISTS "Allow public read on libraries" ON public.user_libraries;
DROP POLICY IF EXISTS "Allow authenticated read on libraries" ON public.user_libraries;
DROP POLICY IF EXISTS "Libraries publicly readable" ON public.user_libraries;

-- Allow public read on non-private library entries
CREATE POLICY "Allow public read on libraries"
  ON public.user_libraries FOR SELECT
  USING (is_private = false);

-- Ensure owner full control policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_libraries' AND schemaname = 'public' AND policyname = 'Users have full control of own library'
  ) THEN
    CREATE POLICY "Users have full control of own library"
      ON public.user_libraries FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. USER EPISODE PROGRESS TABLE
ALTER TABLE public.user_episode_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on episode progress" ON public.user_episode_progress;
DROP POLICY IF EXISTS "Public episode progress readable" ON public.user_episode_progress;

CREATE POLICY "Allow public read on episode progress"
  ON public.user_episode_progress FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_libraries ul
      WHERE ul.id = user_episode_progress.library_id
      AND ul.is_private = false
    )
  );

-- 3. USER READING PROGRESS TABLE
ALTER TABLE public.user_reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on reading progress" ON public.user_reading_progress;
DROP POLICY IF EXISTS "Public reading progress readable" ON public.user_reading_progress;

CREATE POLICY "Allow public read on reading progress"
  ON public.user_reading_progress FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_libraries ul
      WHERE ul.id = user_reading_progress.library_id
      AND ul.is_private = false
    )
  );

-- 4. SHARED CATALOG TITLES & SEASONS & EPISODES
ALTER TABLE public.catalog_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalog titles are publicly readable" ON public.catalog_titles;
CREATE POLICY "Catalog titles are publicly readable"
  ON public.catalog_titles FOR SELECT
  USING (true);

ALTER TABLE public.catalog_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalog seasons are publicly readable" ON public.catalog_seasons;
CREATE POLICY "Catalog seasons are publicly readable"
  ON public.catalog_seasons FOR SELECT
  USING (true);

ALTER TABLE public.catalog_episodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalog episodes are publicly readable" ON public.catalog_episodes;
CREATE POLICY "Catalog episodes are publicly readable"
  ON public.catalog_episodes FOR SELECT
  USING (true);
