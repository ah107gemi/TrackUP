-- 20261025000003_reviews_and_stats.sql
-- Phase 4: User Statistics Calculation RPC & Review Constraints

-- RPC to compute user statistics dynamically
CREATE OR REPLACE FUNCTION public.get_user_statistics(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_episodes_watched INTEGER := 0;
  v_total_chapters_read NUMERIC := 0;
  v_total_watch_time_minutes INTEGER := 0;
  v_media_distribution JSONB := '{}'::jsonb;
  v_rating_stats JSONB := '{}'::jsonb;
  v_total_titles INTEGER := 0;
  v_completed_titles INTEGER := 0;
  v_active_titles INTEGER := 0;
  v_result JSONB;
BEGIN
  -- 1. Total episodes watched from watch_history or user_episode_progress
  SELECT COUNT(DISTINCT episode_id)
  INTO v_total_episodes_watched
  FROM user_episode_progress
  WHERE user_id = p_user_id AND watched = true;

  -- 2. Total chapters read
  SELECT COALESCE(SUM(last_chapter_read), 0)
  INTO v_total_chapters_read
  FROM user_reading_progress
  WHERE user_id = p_user_id;

  -- 3. Total watch time in minutes
  -- Sum from watched episodes + completed movies
  SELECT COALESCE(SUM(e.runtime_minutes), 0)
  INTO v_total_watch_time_minutes
  FROM user_episode_progress uep
  JOIN catalog_episodes e ON e.id = uep.episode_id
  WHERE uep.user_id = p_user_id AND uep.watched = true;

  -- Add movie runtimes for completed movies
  v_total_watch_time_minutes := v_total_watch_time_minutes + COALESCE((
    SELECT SUM(t.runtime_minutes)
    FROM user_libraries ul
    JOIN catalog_titles t ON t.id = ul.title_id
    WHERE ul.user_id = p_user_id
      AND ul.status = 'completed'
      AND t.media_type IN ('movie', 'anime_film')
      AND t.runtime_minutes IS NOT NULL
  ), 0);

  -- 4. Media type distribution
  SELECT jsonb_object_agg(media_type, cnt)
  INTO v_media_distribution
  FROM (
    SELECT t.media_type, COUNT(*) as cnt
    FROM user_libraries ul
    JOIN catalog_titles t ON t.id = ul.title_id
    WHERE ul.user_id = p_user_id
    GROUP BY t.media_type
  ) dist;

  IF v_media_distribution IS NULL THEN
    v_media_distribution := '{}'::jsonb;
  END IF;

  -- 5. Title counts & ratings
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'active'),
    jsonb_build_object(
      'total_rated', COUNT(rating),
      'average_rating', COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
    )
  INTO 
    v_total_titles,
    v_completed_titles,
    v_active_titles,
    v_rating_stats
  FROM user_libraries
  WHERE user_id = p_user_id;

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'total_episodes_watched', v_total_episodes_watched,
    'total_chapters_read', v_total_chapters_read,
    'total_watch_time_minutes', v_total_watch_time_minutes,
    'watch_time_days', ROUND((v_total_watch_time_minutes::numeric / 1440.0), 1),
    'watch_time_hours', ROUND((v_total_watch_time_minutes::numeric / 60.0), 1),
    'media_distribution', v_media_distribution,
    'total_titles', v_total_titles,
    'completed_titles', v_completed_titles,
    'active_titles', v_active_titles,
    'ratings', v_rating_stats
  );

  RETURN v_result;
END;
$$;
