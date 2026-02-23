-- Allow comments to target either a video or an image post.
-- Keeps existing video_url comments intact while enabling image_post_id comments.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS image_post_id INTEGER REFERENCES image_posts(id) ON DELETE CASCADE;

ALTER TABLE comments
  ALTER COLUMN video_url DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_exactly_one_target'
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_exactly_one_target
      CHECK (
        (video_url IS NOT NULL AND image_post_id IS NULL)
        OR
        (video_url IS NULL AND image_post_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comments_image_post_id_created_at
  ON comments(image_post_id, created_at DESC);
