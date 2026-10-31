-- ==============================================================================
-- Migration: 20261031000002_unlock_profiles_rls_and_auth_trigger.sql
-- Description: Ensure profiles table has a broad public read RLS policy for
--              authenticated users, fix handle_new_user auth trigger, and
--              ensure case-insensitive username lookups.
-- ==============================================================================

-- 1. Ensure RLS is active on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy or restrictive SELECT policies on profiles
DROP POLICY IF EXISTS "Allow users to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by public or owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles publicly readable" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who created them." ON public.profiles;

-- 3. Create the permissive SELECT policy allowing authenticated (and public) users to read all profiles
CREATE POLICY "Allow users to read all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- 4. Create case-insensitive functional index on username
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_profiles_display_name_lower
  ON public.profiles (LOWER(display_name));

-- 5. Robust handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
  v_full_name TEXT;
  v_avatar_url TEXT;
BEGIN
  -- Extract or generate username safely
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTRING(NEW.id::text, 1, 6)
  );

  -- Extract or generate display_name
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Extract full_name
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    v_display_name
  );

  -- Extract avatar
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    full_name,
    avatar_url,
    email,
    library_visibility,
    activity_visibility,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    v_username,
    v_display_name,
    v_full_name,
    v_avatar_url,
    NEW.email,
    'public',
    'public',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. Backfill any existing auth.users who do not yet have a profile row
DO $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    full_name,
    avatar_url,
    email,
    library_visibility,
    activity_visibility,
    created_at,
    updated_at
  )
  SELECT
    u.id,
    COALESCE(
      u.raw_user_meta_data->>'username',
      LOWER(SPLIT_PART(u.email, '@', 1)) || '_' || SUBSTRING(u.id::text, 1, 6)
    ),
    COALESCE(
      u.raw_user_meta_data->>'display_name',
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'username',
      SPLIT_PART(u.email, '@', 1)
    ),
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'display_name',
      SPLIT_PART(u.email, '@', 1)
    ),
    u.raw_user_meta_data->>'avatar_url',
    u.email,
    'public',
    'public',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    -- In environments where auth.users direct access is restricted, fail gracefully
    NULL;
END $$;
