-- ==============================================================================
-- Migration: 20261116000001_library_and_progress_strict_rls.sql
-- Description: Align user_libraries and user_episode_progress schemas for external
--              string media IDs and ensure RLS permissions for authenticated users
-- ==============================================================================

-- 1. Relax foreign key on catalog_titles/catalog_episodes to allow string IDs (TMDB, AniList, etc.)
ALTER TABLE public.user_libraries DROP CONSTRAINT IF EXISTS user_libraries_title_id_fkey;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_libraries' AND column_name = 'title_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE public.user_libraries ALTER COLUMN title_id TYPE TEXT;
  END IF;
END $$;

ALTER TABLE public.user_episode_progress DROP CONSTRAINT IF EXISTS user_episode_progress_episode_id_fkey;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_episode_progress' AND column_name = 'episode_id' AND data_type != 'text'
  ) THEN
    ALTER TABLE public.user_episode_progress ALTER COLUMN episode_id TYPE TEXT;
  END IF;
END $$;

-- 2. Ensure RLS is enabled on library and progress tables
ALTER TABLE public.user_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_episode_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_progress ENABLE ROW LEVEL SECURITY;

-- 3. Ensure owner full control policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_libraries' AND schemaname = 'public' AND policyname = 'user_libraries_owner_all'
  ) THEN
    CREATE POLICY "user_libraries_owner_all"
      ON public.user_libraries FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_episode_progress' AND schemaname = 'public' AND policyname = 'user_episode_progress_owner_all'
  ) THEN
    CREATE POLICY "user_episode_progress_owner_all"
      ON public.user_episode_progress FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reading_progress' AND schemaname = 'public' AND policyname = 'user_reading_progress_owner_all'
  ) THEN
    CREATE POLICY "user_reading_progress_owner_all"
      ON public.user_reading_progress FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Explicit grants for authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_libraries TO authenticated;
GRANT SELECT ON public.user_libraries TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_episode_progress TO authenticated;
GRANT SELECT ON public.user_episode_progress TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_reading_progress TO authenticated;
GRANT SELECT ON public.user_reading_progress TO anon;
