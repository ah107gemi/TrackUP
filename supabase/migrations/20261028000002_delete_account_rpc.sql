-- Migration: Add delete_account() RPC to allow authenticated users to delete their own account
-- File: supabase/migrations/20261028000002_delete_account_rpc.sql

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the caller's authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user profile records, library entries, and social links explicitly if needed
  DELETE FROM public.user_libraries WHERE user_id = v_user_id;
  DELETE FROM public.watch_history WHERE user_id = v_user_id;
  DELETE FROM public.reading_history WHERE user_id = v_user_id;
  DELETE FROM public.reviews WHERE user_id = v_user_id;
  DELETE FROM public.user_favorites WHERE user_id = v_user_id;
  DELETE FROM public.user_followers WHERE follower_id = v_user_id OR following_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Delete from auth.users which terminates the auth account
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
