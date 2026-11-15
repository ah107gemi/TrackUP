-- Migration: 20261115000001_custom_lists.sql
-- Description: Custom Lists and List Items schema with Row Level Security (RLS)

-- 1. CUSTOM LISTS TABLE
CREATE TABLE IF NOT EXISTS custom_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_lists_user_id ON custom_lists (user_id);
CREATE INDEX IF NOT EXISTS idx_custom_lists_created_at ON custom_lists (created_at DESC);

-- 2. LIST ITEMS TABLE (Supports all media types: movies, tv shows, anime, manga, manhwa)
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES catalog_titles(id) ON DELETE CASCADE,
  notes TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(list_id, title_id)
);

-- Indexes for items
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_title_id ON list_items (title_id);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES FOR custom_lists
-- Anyone can view public lists, and users can view their own lists
CREATE POLICY "Users can view public or own custom lists"
  ON custom_lists FOR SELECT
  USING (is_private = false OR auth.uid() = user_id);

-- Authenticated users can create their own lists
CREATE POLICY "Users can create their own custom lists"
  ON custom_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own lists
CREATE POLICY "Users can update their own custom lists"
  ON custom_lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own lists
CREATE POLICY "Users can delete their own custom lists"
  ON custom_lists FOR DELETE
  USING (auth.uid() = user_id);

-- 5. POLICIES FOR list_items
-- Anyone can view list items of public or owned lists
CREATE POLICY "Users can view items in accessible lists"
  ON list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists
      WHERE custom_lists.id = list_items.list_id
        AND (custom_lists.is_private = false OR custom_lists.user_id = auth.uid())
    )
  );

-- Users can insert items into their own lists
CREATE POLICY "Users can insert items into own lists"
  ON list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_lists
      WHERE custom_lists.id = list_items.list_id
        AND custom_lists.user_id = auth.uid()
    )
  );

-- Users can update items in their own lists
CREATE POLICY "Users can update items in own lists"
  ON list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists
      WHERE custom_lists.id = list_items.list_id
        AND custom_lists.user_id = auth.uid()
    )
  );

-- Users can delete items from their own lists
CREATE POLICY "Users can delete items from own lists"
  ON list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists
      WHERE custom_lists.id = list_items.list_id
        AND custom_lists.user_id = auth.uid()
    )
  );
