import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Supabase requires SSL connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
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

    // Add google_place_id column if it doesn't exist (for existing tables)
    await pool.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE videos ADD COLUMN google_place_id TEXT;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
        
        BEGIN
          ALTER TABLE image_posts ADD COLUMN google_place_id TEXT;
        EXCEPTION
          WHEN duplicate_column THEN NULL;
        END;
      END $$;
    `);

    // Create indexes for google_place_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videos_google_place_id ON videos (google_place_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_image_posts_google_place_id ON image_posts (google_place_id);
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

export { pool };
