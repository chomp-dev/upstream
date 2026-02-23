-- Align comments schema with comments API expectations.
-- Additive only: safe for partially migrated environments.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_video_url_created_at
  ON comments(video_url, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id
  ON comment_likes(comment_id);
