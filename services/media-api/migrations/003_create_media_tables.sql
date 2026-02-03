-- 0. Add bio to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- 1. FIX USERS TABLE
ALTER TABLE users DROP COLUMN IF EXISTS id;
ALTER TABLE users ADD PRIMARY KEY (auth0_id);

-- 2. CREATE POSTS TABLE (Replaces videos and image_posts)
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  cloudflare_video_id VARCHAR(255), -- Nullable, only for videos
  playback_url TEXT,
  thumbnail_url TEXT,
  images TEXT[], -- Array of image URLs/IDs
  post_type VARCHAR(50) NOT NULL, -- 'video' or 'image'
  status VARCHAR(50) DEFAULT 'pending',
  duration INTEGER,
  title TEXT,
  description TEXT,
  tags TEXT[],
  likes_count INTEGER DEFAULT 0,
  user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  google_place_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cloudflare_video_id) -- Still keep this unique if it exists
);

-- 3. CREATE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE LIKES TABLE
CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);