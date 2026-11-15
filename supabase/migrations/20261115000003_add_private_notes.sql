-- ============================================================================
-- MIGRATION: 20261115000003_add_private_notes.sql
-- Description: Adds strictly private notes column to user_libraries
-- ============================================================================

ALTER TABLE public.user_libraries ADD COLUMN IF NOT EXISTS private_notes TEXT;
