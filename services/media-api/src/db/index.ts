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

    // Create posts table if not exists (replacing videos and image_posts)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        cloudflare_video_id VARCHAR(255),
        playback_url TEXT,
        thumbnail_url TEXT,
        images TEXT[],
        post_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        duration INTEGER,
        google_place_id TEXT,
        title TEXT,
        description TEXT,
        tags TEXT[],
        likes_count INTEGER DEFAULT 0,
        user_id TEXT REFERENCES users(auth0_id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cloudflare_video_id)
      )
    `);

    // Create comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create post_likes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(auth0_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (post_id, user_id)
      )
    `);

    // Create function to update likes count
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_likes_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF (TG_OP = 'INSERT') THEN
          UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
          RETURN NEW;
        ELSIF (TG_OP = 'DELETE') THEN
          UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger
    await pool.query(`
      DROP TRIGGER IF EXISTS update_post_likes_count ON post_likes;
      CREATE TRIGGER update_post_likes_count
      AFTER INSERT OR DELETE ON post_likes
      FOR EACH ROW
      EXECUTE FUNCTION update_likes_count();
    `);

    // Create index on google_place_id for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_google_place_id ON posts(google_place_id);
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    `);

    console.log('✅ Database tables initialized (posts, comments, post_likes)');
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
