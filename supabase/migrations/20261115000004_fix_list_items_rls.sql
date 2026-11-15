-- ============================================================================
-- MIGRATION: 20261115000004_fix_list_items_rls.sql
-- Description: Fix list_items schema and RLS policies with direct user_id support
-- ============================================================================

-- 1. Ensure columns exist on public.custom_lists
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS list_name TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Sync name and list_name
UPDATE public.custom_lists SET name = list_name WHERE name IS NULL AND list_name IS NOT NULL;
UPDATE public.custom_lists SET list_name = name WHERE list_name IS NULL AND name IS NOT NULL;

-- 2. Ensure columns exist on public.list_items (including user_id for direct clean RLS)
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS media_id TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS title_id TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Drop restrictive catalog foreign keys on title_id if present
ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_title_id_fkey;

-- Backfill user_id from custom_lists
UPDATE public.list_items
SET user_id = custom_lists.user_id
FROM public.custom_lists
WHERE list_items.list_id = custom_lists.id
  AND list_items.user_id IS NULL;

-- Set default user_id to auth.uid()
ALTER TABLE public.list_items ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Sync media_id and title_id
UPDATE public.list_items SET media_id = title_id WHERE media_id IS NULL AND title_id IS NOT NULL;
UPDATE public.list_items SET title_id = media_id WHERE title_id IS NULL AND media_id IS NOT NULL;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_list_items_user_id ON public.list_items (user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_media_id ON public.list_items (media_id);
CREATE INDEX IF NOT EXISTS idx_list_items_title_id ON public.list_items (title_id);

-- 4. Enable RLS
ALTER TABLE public.custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- 5. Refresh RLS Policies for custom_lists
DROP POLICY IF EXISTS "Users can view public or own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can create their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can update their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can delete their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can view their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can insert their own custom lists" ON public.custom_lists;

CREATE POLICY "Users can view public or own custom lists"
  ON public.custom_lists FOR SELECT
  USING (is_private = false OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom lists"
  ON public.custom_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom lists"
  ON public.custom_lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom lists"
  ON public.custom_lists FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Refresh RLS Policies for list_items
DROP POLICY IF EXISTS "Users can view items in accessible lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can insert items into own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items from own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can view items from their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can insert items into their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items from their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can view accessible list items" ON public.list_items;

CREATE POLICY "Users can view accessible list items"
  ON public.list_items FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND (public.custom_lists.is_private = false OR public.custom_lists.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert items into their own custom lists"
  ON public.list_items FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their own custom lists"
  ON public.list_items FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their own custom lists"
  ON public.list_items FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );
