-- Migration: 20261115000002_custom_lists_schema.sql
-- Description: Custom Lists & List Items Schema with Row Level Security (RLS)

-- 1. Create custom_lists Table
CREATE TABLE IF NOT EXISTS public.custom_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  list_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create list_items Table
CREATE TABLE IF NOT EXISTS public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.custom_lists(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT list_items_list_media_unique UNIQUE (list_id, media_id)
);

-- 3. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_custom_lists_user_id ON public.custom_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_media_id ON public.list_items(media_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies for custom_lists
CREATE POLICY "Users can view their own custom lists"
  ON public.custom_lists FOR SELECT
  USING (auth.uid() = user_id);

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

-- 6. Row Level Security Policies for list_items
CREATE POLICY "Users can view items from their own custom lists"
  ON public.list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items into their own custom lists"
  ON public.list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in their own custom lists"
  ON public.list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items from their own custom lists"
  ON public.list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE public.custom_lists.id = list_items.list_id
        AND public.custom_lists.user_id = auth.uid()
    )
  );
