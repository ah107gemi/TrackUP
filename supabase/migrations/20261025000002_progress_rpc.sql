-- Migration: 20261025000002_progress_rpc.sql
-- Description: Atomic RPC functions for logging episode and reading progress with immutable history tracking

-- 1. RPC: log_episode_progress
CREATE OR REPLACE FUNCTION public.log_episode_progress(
  p_library_id UUID,
  p_episode_id UUID,
  p_watched BOOLEAN,
  p_is_rewatch BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_title_id UUID;
  v_result JSONB;
BEGIN
  -- Authenticate owner
  SELECT user_id, title_id INTO v_user_id, v_title_id
  FROM public.user_libraries
  WHERE id = p_library_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this library entry';
  END IF;

  -- 1. Upsert episode watched state
  INSERT INTO public.user_episode_progress (
    user_id,
    library_id,
    episode_id,
    watched,
    watched_at
  )
  VALUES (
    v_user_id,
    p_library_id,
    p_episode_id,
    p_watched,
    timezone('utc'::text, now())
  )
  ON CONFLICT (user_id, episode_id)
  DO UPDATE SET
    watched = EXCLUDED.watched,
    watched_at = EXCLUDED.watched_at;

  -- 2. Update library timestamp
  UPDATE public.user_libraries
  SET
    last_progressed_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now()),
    status = CASE WHEN status = 'planned' THEN 'active'::tracking_status ELSE status END
  WHERE id = p_library_id;

  -- 3. Append immutable watch history record if watched
  IF p_watched THEN
    INSERT INTO public.watch_history (
      user_id,
      library_id,
      episode_id,
      watched_at,
      is_rewatch
    )
    VALUES (
      v_user_id,
      p_library_id,
      p_episode_id,
      timezone('utc'::text, now()),
      p_is_rewatch
    );
  END IF;

  SELECT to_jsonb(l.*) INTO v_result
  FROM public.user_libraries l
  WHERE l.id = p_library_id;

  RETURN v_result;
END;
$$;

-- 2. RPC: log_reading_progress
CREATE OR REPLACE FUNCTION public.log_reading_progress(
  p_library_id UUID,
  p_chapter NUMERIC,
  p_volume INTEGER DEFAULT NULL,
  p_is_reread BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_title_id UUID;
  v_result JSONB;
BEGIN
  -- Authenticate owner
  SELECT user_id, title_id INTO v_user_id, v_title_id
  FROM public.user_libraries
  WHERE id = p_library_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this library entry';
  END IF;

  -- 1. Upsert reading progress (supports fractional chapters like 10.5)
  INSERT INTO public.user_reading_progress (
    user_id,
    library_id,
    last_chapter_read,
    last_volume_read,
    updated_at
  )
  VALUES (
    v_user_id,
    p_library_id,
    p_chapter,
    COALESCE(p_volume, 0),
    timezone('utc'::text, now())
  )
  ON CONFLICT (library_id)
  DO UPDATE SET
    last_chapter_read = EXCLUDED.last_chapter_read,
    last_volume_read = COALESCE(EXCLUDED.last_volume_read, user_reading_progress.last_volume_read),
    updated_at = EXCLUDED.updated_at;

  -- 2. Update library timestamp
  UPDATE public.user_libraries
  SET
    last_progressed_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now()),
    status = CASE WHEN status = 'planned' THEN 'active'::tracking_status ELSE status END
  WHERE id = p_library_id;

  -- 3. Append immutable reading history log
  INSERT INTO public.reading_history (
    user_id,
    library_id,
    chapter_number,
    volume_number,
    read_at,
    is_reread
  )
  VALUES (
    v_user_id,
    p_library_id,
    p_chapter,
    p_volume,
    timezone('utc'::text, now()),
    p_is_reread
  );

  SELECT to_jsonb(l.*) INTO v_result
  FROM public.user_libraries l
  WHERE l.id = p_library_id;

  RETURN v_result;
END;
$$;

-- 3. RPC: batch_mark_season_watched
CREATE OR REPLACE FUNCTION public.batch_mark_season_watched(
  p_library_id UUID,
  p_season_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.user_libraries
  WHERE id = p_library_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this library entry';
  END IF;

  FOR r IN (
    SELECT id FROM public.catalog_episodes
    WHERE season_id = p_season_id
  ) LOOP
    PERFORM public.log_episode_progress(p_library_id, r.id, true, false);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
