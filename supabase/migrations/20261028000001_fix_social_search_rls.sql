-- ==============================================================================
-- Migration: 20261028000001_fix_social_search_rls.sql
-- Description: Ensure full_name column exists on profiles and grant full SELECT
--              RLS permissions on profiles to authenticated and public users
--              for cross-device user discovery.
-- ==============================================================================

-- 1. Ensure full_name column exists on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Populate full_name from display_name if null
UPDATE public.profiles
SET full_name = display_name
WHERE full_name IS NULL AND display_name IS NOT NULL;

-- 3. Trigger to keep display_name and full_name synchronized
CREATE OR REPLACE FUNCTION public.sync_profile_names()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.full_name IS NULL AND NEW.display_name IS NOT NULL THEN
    NEW.full_name := NEW.display_name;
  ELSIF NEW.display_name IS NULL AND NEW.full_name IS NOT NULL THEN
    NEW.display_name := NEW.full_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_names ON public.profiles;
CREATE TRIGGER trg_sync_profile_names
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_names();

-- 4. Update handle_new_user() trigger to ensure full_name is populated on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_username TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTRING(NEW.id::text, 1, 4)
  );

  INSERT INTO public.profiles (id, username, display_name, full_name, avatar_url)
  VALUES (
    NEW.id,
    v_username,
    v_name,
    v_name,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = EXCLUDED.username,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Row Level Security (RLS) Policy for Profiles:
-- Ensure authenticated and anon users can SELECT profiles for search and social discovery.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles readable by public or owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles publicly readable" ON public.profiles;

-- Allow all authenticated users to search and read profiles
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow public / anon read access for profile cards and directory discovery
CREATE POLICY "Profiles publicly readable"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);

-- 6. Indexes for fast case-insensitive ILIKE search
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_lower ON public.profiles (lower(full_name));
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_lower ON public.profiles (lower(display_name));
