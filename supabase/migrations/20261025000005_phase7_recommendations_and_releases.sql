-- ============================================================================
-- Migration: 20261025000005_phase7_recommendations_and_releases.sql
-- Description: Phase 7 Recommendations, Airing Calendar & Performance Hardening
-- ============================================================================

-- 1. Catalog Release Schedules table (Airing Calendar for TV, Anime, Manga, Manhwa)
CREATE TABLE IF NOT EXISTS public.catalog_release_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_id TEXT NOT NULL REFERENCES public.catalog_titles(id) ON DELETE CASCADE,
    release_type TEXT NOT NULL CHECK (release_type IN ('episode', 'chapter', 'season', 'volume')),
    item_number NUMERIC(6, 1) NOT NULL,
    item_title TEXT,
    air_date TIMESTAMPTZ NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday ... 6=Saturday
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable 100% RLS
ALTER TABLE public.catalog_release_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to catalog_release_schedules"
    ON public.catalog_release_schedules
    FOR SELECT
    USING (true);

CREATE POLICY "Allow service_role full management of catalog_release_schedules"
    ON public.catalog_release_schedules
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 2. Performance Hardening Indexes (Supabase Advisors alignment)
CREATE INDEX IF NOT EXISTS idx_release_schedules_day_air 
    ON public.catalog_release_schedules (day_of_week, air_date ASC);

CREATE INDEX IF NOT EXISTS idx_release_schedules_title_id 
    ON public.catalog_release_schedules (title_id);

CREATE INDEX IF NOT EXISTS idx_user_libraries_user_status 
    ON public.user_libraries (user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_libraries_user_last_prog 
    ON public.user_libraries (user_id, last_progressed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_reviews_user_rating 
    ON public.reviews (user_id, rating DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_following 
    ON public.user_follows (follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_title_relationships_source 
    ON public.title_relationships (source_title_id, relationship_type);

-- 3. Database RPC: Get User Recommendations (Cross-format adaptations & Genre Affinity)
CREATE OR REPLACE FUNCTION public.get_user_recommendations(
    p_user_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    id TEXT,
    title TEXT,
    media_type public.media_type,
    poster_url TEXT,
    backdrop_url TEXT,
    genres TEXT[],
    recommendation_reason TEXT,
    source_title_name TEXT,
    match_score INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    -- A) Cross-Format Adaptations
    WITH user_tracked_titles AS (
        SELECT ul.title_id, ct.title as title_name, ul.status
        FROM public.user_libraries ul
        JOIN public.catalog_titles ct ON ct.id = ul.title_id
        WHERE ul.user_id = p_user_id
    ),
    adaptation_recs AS (
        SELECT 
            target.id,
            target.title,
            target.media_type,
            target.poster_url,
            target.backdrop_url,
            target.genres,
            ('Because you tracked ' || ut.title_name || ' (' || target.media_type::TEXT || ' adaptation)')::TEXT as recommendation_reason,
            ut.title_name::TEXT as source_title_name,
            98 as match_score
        FROM user_tracked_titles ut
        JOIN public.title_relationships tr ON tr.source_title_id = ut.title_id
        JOIN public.catalog_titles target ON target.id = tr.target_title_id
        WHERE target.id NOT IN (SELECT utt.title_id FROM user_tracked_titles utt)
    ),
    -- B) Genre affinity recommendations
    top_user_genres AS (
        SELECT unnest(ct.genres) as genre_name, COUNT(*) as frequency
        FROM public.user_libraries ul
        JOIN public.catalog_titles ct ON ct.id = ul.title_id
        WHERE ul.user_id = p_user_id
        GROUP BY 1
        ORDER BY frequency DESC
        LIMIT 3
    ),
    genre_recs AS (
        SELECT 
            ct.id,
            ct.title,
            ct.media_type,
            ct.poster_url,
            ct.backdrop_url,
            ct.genres,
            ('Based on your interest in ' || tg.genre_name)::TEXT as recommendation_reason,
            NULL::TEXT as source_title_name,
            88 as match_score
        FROM top_user_genres tg
        JOIN public.catalog_titles ct ON tg.genre_name = ANY(ct.genres)
        WHERE ct.id NOT IN (SELECT utt.title_id FROM user_tracked_titles utt)
          AND ct.id NOT IN (SELECT ar.id FROM adaptation_recs ar)
    )
    SELECT * FROM adaptation_recs
    UNION ALL
    SELECT * FROM genre_recs
    ORDER BY match_score DESC
    LIMIT p_limit;
END;
$$;

-- 4. Database RPC: Get Upcoming Releases (Calendar Schedule)
CREATE OR REPLACE FUNCTION public.get_upcoming_releases(
    p_user_id UUID DEFAULT NULL,
    p_day_of_week SMALLINT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title_id TEXT,
    title_name TEXT,
    media_type public.media_type,
    poster_url TEXT,
    release_type TEXT,
    item_number NUMERIC(6, 1),
    item_title TEXT,
    air_date TIMESTAMPTZ,
    day_of_week SMALLINT,
    is_in_user_library BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id,
        rs.title_id,
        ct.title as title_name,
        ct.media_type,
        ct.poster_url,
        rs.release_type,
        rs.item_number,
        rs.item_title,
        rs.air_date,
        rs.day_of_week,
        CASE 
            WHEN p_user_id IS NOT NULL THEN EXISTS (
                SELECT 1 FROM public.user_libraries ul 
                WHERE ul.user_id = p_user_id AND ul.title_id = rs.title_id
            )
            ELSE false
        END as is_in_user_library
    FROM public.catalog_release_schedules rs
    JOIN public.catalog_titles ct ON ct.id = rs.title_id
    WHERE (p_day_of_week IS NULL OR rs.day_of_week = p_day_of_week)
    ORDER BY rs.air_date ASC;
END;
$$;
