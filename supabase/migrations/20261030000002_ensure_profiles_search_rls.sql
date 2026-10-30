-- Migration: 20261030000002_ensure_profiles_search_rls.sql
-- Description: Ensures authenticated and public users have SELECT permissions on the profiles table for Find Friends search.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Authenticated users can read profiles for search & social discovery
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public' AND policyname = 'Profiles readable by authenticated users'
  ) THEN
    CREATE POLICY "Profiles readable by authenticated users"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Public / anonymous users can read public profiles for community discovery
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public' AND policyname = 'Profiles publicly readable'
  ) THEN
    CREATE POLICY "Profiles publicly readable"
      ON public.profiles FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
