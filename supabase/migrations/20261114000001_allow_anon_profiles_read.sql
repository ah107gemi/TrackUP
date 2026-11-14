-- ==============================================================================
-- Migration: 20261114000001_allow_anon_profiles_read.sql
-- Description: Grant explicit SELECT access to anon role on profiles table
--              and create a permissive SELECT policy for anon and authenticated users
--              so username-to-email resolution works prior to authentication.
-- ==============================================================================

-- 1. Ensure table grants exist for anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;

-- 2. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing SELECT policies to prevent policy ambiguity or conflicts
DROP POLICY IF EXISTS "Allow anon read access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by public or owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles publicly readable" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Allow anon and authenticated to read profiles" ON public.profiles;

-- 4. Create explicit SELECT policy for anon and authenticated roles
CREATE POLICY "Allow anon and authenticated to read profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. Ensure functional index exists for case-insensitive username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (LOWER(email));
