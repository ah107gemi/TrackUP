-- Migration: 20261029000001_profile_banner_and_assets_bucket.sql
-- Description: Adds banner_url to profiles and sets up the profile_assets public storage bucket with RLS policies.

-- 1. Ensure profiles table has banner_url column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banner_url text;

-- 2. Create profile_assets public storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile_assets',
  'profile_assets',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Storage RLS Policies for profile_assets
DO $$
BEGIN
  -- Public read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public profile assets are viewable by everyone'
  ) THEN
    CREATE POLICY "Public profile assets are viewable by everyone"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile_assets');
  END IF;

  -- Authenticated user upload policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload their own profile assets'
  ) THEN
    CREATE POLICY "Users can upload their own profile assets"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'profile_assets' AND
      (
        auth.uid()::text = (storage.foldername(name))[1] OR
        auth.uid()::text = (storage.foldername(name))[2]
      )
    );
  END IF;

  -- Authenticated user update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can update their own profile assets'
  ) THEN
    CREATE POLICY "Users can update their own profile assets"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'profile_assets' AND
      (
        auth.uid()::text = (storage.foldername(name))[1] OR
        auth.uid()::text = (storage.foldername(name))[2]
      )
    );
  END IF;

  -- Authenticated user delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own profile assets'
  ) THEN
    CREATE POLICY "Users can delete their own profile assets"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'profile_assets' AND
      (
        auth.uid()::text = (storage.foldername(name))[1] OR
        auth.uid()::text = (storage.foldername(name))[2]
      )
    );
  END IF;
END $$;
