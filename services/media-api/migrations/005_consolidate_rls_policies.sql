-- Comprehensive RLS Policy Review and Cleanup
-- This migration consolidates and fixes all RLS policies to prevent conflicts

-- =============================================================================
-- USERS TABLE
-- =============================================================================
DROP POLICY IF EXISTS "authenticated_insert" ON public.users;
DROP POLICY IF EXISTS "authenticated_update" ON public.users;
DROP POLICY IF EXISTS "public_read" ON public.users;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth0_id);

CREATE POLICY "users_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth0_id)
  WITH CHECK (auth.uid() = auth0_id);

CREATE POLICY "users_select" ON public.users
  FOR SELECT
  TO public
  USING (true);

-- =============================================================================
-- VIDEO_POSTS (videos) TABLE
-- =============================================================================
DROP POLICY IF EXISTS "authenticated_insert" ON public.videos;
DROP POLICY IF EXISTS "authenticated_update" ON public.videos;
DROP POLICY IF EXISTS "public_read" ON public.videos;

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos_insert" ON public.videos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "videos_update" ON public.videos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "videos_select" ON public.videos
  FOR SELECT
  TO public
  USING (true);

-- =============================================================================
-- IMAGE_POSTS TABLE
-- =============================================================================
DROP POLICY IF EXISTS "authenticated_insert" ON public.image_posts;
DROP POLICY IF EXISTS "authenticated_update" ON public.image_posts;
DROP POLICY IF EXISTS "public_read" ON public.image_posts;

ALTER TABLE public.image_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "image_posts_insert" ON public.image_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "image_posts_update" ON public.image_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "image_posts_select" ON public.image_posts
  FOR SELECT
  TO public
  USING (true);

-- =============================================================================
-- VIDEO_LIKES TABLE
-- =============================================================================
DROP POLICY IF EXISTS "authenticated_insert" ON public.video_likes;
DROP POLICY IF EXISTS "authenticated_delete" ON public.video_likes;
DROP POLICY IF EXISTS "public_read" ON public.video_likes;

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_likes_insert" ON public.video_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "video_likes_delete" ON public.video_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "video_likes_select" ON public.video_likes
  FOR SELECT
  TO public
  USING (true);

-- =============================================================================
-- SUMMARY OF CHANGES
-- =============================================================================
-- 1. Renamed all policies to include table name to avoid conflicts
-- 2. Consistent auth.uid() = user_id/auth0_id pattern
-- 3. All tables have INSERT, UPDATE/DELETE, and SELECT policies
-- 4. Public read access for all content
-- 5. Only owners can modify their own data
