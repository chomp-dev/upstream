import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Supabase requires SSL connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, // 10s connection timeout
  idleTimeoutMillis: 30000, // Close idle clients after 30s
  keepAlive: true, // Enable TCP keepalives
  max: 20, // Max concurrent connections
});

export async function initDb() {
  try {
    // Test connection first
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Create videos table with google_place_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        cloudflare_video_id VARCHAR(255) UNIQUE NOT NULL,
        playback_url TEXT,
        thumbnail_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        duration INTEGER,
        google_place_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create image_posts table with google_place_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS image_posts (
        id SERIAL PRIMARY KEY,
        images TEXT[] NOT NULL,
        google_place_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tiktok_embeds table for TikTok video embeds
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tiktok_embeds (
        id SERIAL PRIMARY KEY,
        tiktok_url TEXT NOT NULL,
        embed_html TEXT,
        title TEXT,
        author_name TEXT,
        author_url TEXT,
        thumbnail_url TEXT,
        thumbnail_width INTEGER,
        thumbnail_height INTEGER,
        google_place_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add metadata columns if they don't exist
    await pool.query(`
      DO $$ 
      BEGIN 
        -- Videos table columns
        BEGIN
          ALTER TABLE videos ADD COLUMN google_place_id TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE videos ADD COLUMN title TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE videos ADD COLUMN description TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE videos ADD COLUMN tags TEXT[];
        EXCEPTION WHEN duplicate_column THEN NULL; END;
        
        -- Image posts table columns
        BEGIN
          ALTER TABLE image_posts ADD COLUMN google_place_id TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE image_posts ADD COLUMN title TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE image_posts ADD COLUMN description TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE image_posts ADD COLUMN tags TEXT[];
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        -- User ID columns
        BEGIN
          ALTER TABLE videos ADD COLUMN user_id TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE image_posts ADD COLUMN user_id TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE tiktok_embeds ADD COLUMN user_id TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        -- User safety/compliance columns
        BEGIN
          ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP WITH TIME ZONE;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE users ADD COLUMN terms_version TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE users ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE users ADD COLUMN suspended_reason TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE users ADD COLUMN is_removed BOOLEAN NOT NULL DEFAULT FALSE;
        EXCEPTION WHEN duplicate_column THEN NULL; END;

        BEGIN
          ALTER TABLE users ADD COLUMN account_deleted_at TIMESTAMP WITH TIME ZONE;
        EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        reported_user_id TEXT REFERENCES users(auth0_id) ON DELETE SET NULL,
        content_type TEXT NOT NULL,
        content_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT REFERENCES users(auth0_id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        blocker_user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        blocked_user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (blocker_user_id, blocked_user_id),
        CHECK (blocker_user_id <> blocked_user_id)
      )
    `);

    // Ensure comments schema is aligned with comments routes.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_url TEXT NOT NULL REFERENCES videos(video_url) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS image_post_id INTEGER REFERENCES image_posts(id) ON DELETE CASCADE,
      ALTER COLUMN video_url DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0
    `);

    await pool.query(`
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
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (comment_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_likes (
        video_url TEXT NOT NULL REFERENCES videos(playback_url),
        user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (video_url, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS image_post_likes (
        image_post_id INTEGER NOT NULL REFERENCES image_posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (image_post_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        video_url TEXT REFERENCES videos(playback_url),
        image_post_id INTEGER REFERENCES image_posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (user_id, video_url),
        UNIQUE (user_id, image_post_id)
      )
    `);

    // Create indexes for google_place_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_google_place_id ON videos (google_place_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_image_posts_google_place_id ON image_posts (google_place_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_status_created_at ON reports (status, created_at DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON user_blocks (blocked_user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_video_url_created_at ON comments (video_url, created_at DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes (comment_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_comments_image_post_id_created_at ON comments (image_post_id, created_at DESC);
    `);

    console.log('✅ Database tables initialized with google_place_id support');
    return pool;
  } catch (error: any) {
    console.error('❌ Database initialization error:', error.message);

    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('1. Check if your Supabase project is active (not paused)');
      console.error('2. Go to https://app.supabase.com/ and verify your project status');
      console.error('3. Verify your DATABASE_URL in .env file is correct');
      console.error('4. Make sure the connection string includes the correct password');
      console.error('5. Check your internet connection and firewall settings');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused - check if Supabase project is paused');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed - check your database password in DATABASE_URL');
    }

    throw error;
  }
}

// Helper to retry queries on connection failure
export async function queryWithRetry(text: string, params?: any[], retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(text, params);
    } catch (error: any) {
      const isConnectionError =
        error.message?.includes('Connection terminated') ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === '57P01'; // Admin shutdown

      if (isConnectionError && i < retries - 1) {
        console.warn(`⚠️ DB Query failed (attempt ${i + 1}/${retries}), retrying...`, error.message);
        await new Promise(res => setTimeout(res, 1000 * (i + 1))); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

export { pool };
