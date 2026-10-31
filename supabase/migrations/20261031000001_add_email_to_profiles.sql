-- Migration: 20261031000001_add_email_to_profiles.sql
-- Description: Add email column to profiles to support username-based authentication resolution

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create indexes for fast case-insensitive username and email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
ON public.profiles (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
ON public.profiles (LOWER(email));

-- Backfill emails from auth.users for existing users
DO $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND p.email IS NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- In environments where auth.users is restricted, fail gracefully
    NULL;
END $$;

-- Update the handle_new_user trigger to populate email upon signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTRING(NEW.id::text, 1, 6)
    ),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
