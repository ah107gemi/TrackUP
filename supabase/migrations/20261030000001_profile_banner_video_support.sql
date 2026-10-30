-- Migration: 20261030000001_profile_banner_video_support.sql
-- Description: Updates the profile_assets storage bucket to allow video/mp4 and video/webm in addition to images and GIFs.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
WHERE id = 'profile_assets';
