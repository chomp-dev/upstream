-- Migration: Add google_place_id to videos and image_posts
-- This enables linking posts to restaurants from the search-api

-- Add google_place_id column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Add google_place_id column to image_posts table  
ALTER TABLE image_posts ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Create indexes for efficient lookups by restaurant
CREATE INDEX IF NOT EXISTS idx_videos_google_place_id ON videos (google_place_id);
CREATE INDEX IF NOT EXISTS idx_image_posts_google_place_id ON image_posts (google_place_id);

-- Note: No foreign key constraint added intentionally to avoid cross-service coupling
-- The google_place_id references restaurants in the search-api database
-- 
-- If you want to add a foreign key constraint (same database):
-- ALTER TABLE videos 
--   ADD CONSTRAINT fk_videos_google_place_id 
--   FOREIGN KEY (google_place_id) 
--   REFERENCES restaurants(google_place_id);
