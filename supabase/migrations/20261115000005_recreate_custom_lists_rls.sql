-- ============================================================================
-- MIGRATION: 20261115000005_recreate_custom_lists_rls.sql
-- Description: Complete DROP and RECREATE of RLS policies for custom_lists and list_items.
-- Guarantees authenticated user (auth.uid() = user_id) has full SELECT, INSERT, UPDATE, DELETE access.
-- ============================================================================

-- 1. Ensure table columns exist
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS list_name TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.custom_lists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

UPDATE public.custom_lists SET name = list_name WHERE name IS NULL AND list_name IS NOT NULL;
UPDATE public.custom_lists SET list_name = name WHERE list_name IS NULL AND name IS NOT NULL;

ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS media_id TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS title_id TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Drop restrictive catalog foreign keys on title_id if present
ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_title_id_fkey;

-- Backfill user_id from parent custom_lists
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

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_custom_lists_user_id ON public.custom_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_lists_created_at ON public.custom_lists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_list_items_user_id ON public.list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_media_id ON public.list_items(media_id);
CREATE INDEX IF NOT EXISTS idx_list_items_title_id ON public.list_items(title_id);

-- 3. Enable Row Level Security
ALTER TABLE public.custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- 4. Dynamically DROP all existing policies on custom_lists and list_items
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN ('custom_lists', 'list_items')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Drop explicitly by all historical names to guarantee removal
DROP POLICY IF EXISTS "Users can view public or own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can view their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can create their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can insert their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can update their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users can delete their own custom lists" ON public.custom_lists;
DROP POLICY IF EXISTS "custom_lists_select_policy" ON public.custom_lists;
DROP POLICY IF EXISTS "custom_lists_insert_policy" ON public.custom_lists;
DROP POLICY IF EXISTS "custom_lists_update_policy" ON public.custom_lists;
DROP POLICY IF EXISTS "custom_lists_delete_policy" ON public.custom_lists;

DROP POLICY IF EXISTS "Users can view items in accessible lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can insert items into own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items from own lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can view items from their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can insert items into their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can update items in their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can delete items from their own custom lists" ON public.list_items;
DROP POLICY IF EXISTS "Users can view accessible list items" ON public.list_items;
DROP POLICY IF EXISTS "list_items_select_policy" ON public.list_items;
DROP POLICY IF EXISTS "list_items_insert_policy" ON public.list_items;
DROP POLICY IF EXISTS "list_items_update_policy" ON public.list_items;
DROP POLICY IF EXISTS "list_items_delete_policy" ON public.list_items;

-- 5. RECREATE POLICIES: public.custom_lists
CREATE POLICY "custom_lists_select_policy"
  ON public.custom_lists FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_private = false 
    OR is_private IS NULL
  );

CREATE POLICY "custom_lists_insert_policy"
  ON public.custom_lists FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "custom_lists_update_policy"
  ON public.custom_lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "custom_lists_delete_policy"
  ON public.custom_lists FOR DELETE
  USING (auth.uid() = user_id);

-- 6. RECREATE POLICIES: public.list_items
CREATE POLICY "list_items_select_policy"
  ON public.list_items FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND (public.custom_lists.user_id = auth.uid() OR public.custom_lists.is_private = false OR public.custom_lists.is_private IS NULL)
    )
  );

CREATE POLICY "list_items_insert_policy"
  ON public.list_items FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "list_items_update_policy"
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

CREATE POLICY "list_items_delete_policy"
  ON public.list_items FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );

-- 7. Ensure table privileges are granted
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_lists TO authenticated;
GRANT SELECT ON public.custom_lists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_items TO authenticated;
GRANT SELECT ON public.list_items TO anon;
