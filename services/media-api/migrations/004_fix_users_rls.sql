-- Fix RLS policies for users table to allow profile updates on Safari/mobile
-- This ensures authenticated users can update their own profiles

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "authenticated_insert" ON public.users;
DROP POLICY IF EXISTS "authenticated_update" ON public.users;
DROP POLICY IF EXISTS "public_read" ON public.users;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to insert their own record
CREATE POLICY "authenticated_insert" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth0_id);

-- Allow users to update their own profile
CREATE POLICY "authenticated_update" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth0_id)
  WITH CHECK (auth.uid() = auth0_id);

-- Allow public read access to user profiles
CREATE POLICY "public_read" ON public.users
  FOR SELECT
  TO public
  USING (true);
