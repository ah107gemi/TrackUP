-- 20261025000004_social_graph.sql
-- Phase 6: Social Graph, Activity Feeds & Rating Comparison RPCs

-- 1. Helper function: Get Following Activity Feed respecting RLS & privacy
CREATE OR REPLACE FUNCTION public.get_following_activity_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'activity_type', a.activity_type,
      'title_id', a.title_id,
      'title_name', t.title,
      'media_type', t.media_type,
      'poster_url', t.poster_url,
      'metadata', a.metadata,
      'created_at', a.created_at
    )
  )
  INTO v_feed
  FROM activity_logs a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN catalog_titles t ON t.id = a.title_id
  WHERE (
    -- Include followed users or self
    a.user_id = p_user_id
    OR a.user_id IN (
      SELECT following_id FROM user_follows WHERE follower_id = p_user_id
    )
  )
  AND (
    -- Strict privacy enforcement
    a.user_id = p_user_id
    OR (
      p.activity_visibility = 'public'
      OR (p.activity_visibility = 'followers_only' AND public.is_following(p.id))
    )
  )
  ORDER BY a.created_at DESC
  LIMIT p_limit;

  RETURN COALESCE(v_feed, '[]'::jsonb);
END;
$$;

-- 2. Helper function: Get Rating Comparison between two users on a title
CREATE OR REPLACE FUNCTION public.get_rating_comparison(
  p_user_a UUID,
  p_user_b UUID,
  p_title_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating_a SMALLINT;
  v_rating_b SMALLINT;
  v_result JSONB;
BEGIN
  SELECT rating INTO v_rating_a FROM user_libraries WHERE user_id = p_user_a AND title_id = p_title_id;
  SELECT rating INTO v_rating_b FROM user_libraries WHERE user_id = p_user_b AND title_id = p_title_id;

  v_result := jsonb_build_object(
    'title_id', p_title_id,
    'user_a_rating', v_rating_a,
    'user_b_rating', v_rating_b,
    'delta', CASE 
      WHEN v_rating_a IS NOT NULL AND v_rating_b IS NOT NULL THEN (v_rating_a - v_rating_b)
      ELSE NULL
    END
  );

  RETURN v_result;
END;
$$;
