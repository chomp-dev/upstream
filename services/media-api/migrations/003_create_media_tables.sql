-- 0. Add bio to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- 1. FIX USERS TABLE
-- Remove the 'id' column and set 'auth0_id' as the Primary Key
ALTER TABLE users DROP COLUMN IF EXISTS id;
ALTER TABLE users ADD PRIMARY KEY (auth0_id);

-- 2. CREATE VIDEOS TABLE (The Parent)
-- This MUST be created before comments or likes can reference it
CREATE TABLE IF NOT EXISTS videos (
  video_url TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  description TEXT,
  title TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE COMMENTS TABLE (The Child)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url TEXT NOT NULL REFERENCES videos(video_url) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE LIKES TABLE (The Child)
CREATE TABLE IF NOT EXISTS video_likes (
  video_url TEXT NOT NULL REFERENCES videos(video_url) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (video_url, user_id)
);