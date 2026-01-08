import { Router } from 'express';
import { createDirectUploadUrl } from '../services/cloudflare';
import { pool } from '../db';

export const uploadRouter = Router();

// Get signed upload URL for video
uploadRouter.post('/video', async (req, res) => {
  try {
    const { google_place_id } = req.body || {};
    const upload = await createDirectUploadUrl();
    
    if (!upload.id || !upload.uploadURL) {
      throw new Error('Invalid upload response from Cloudflare');
    }
    
    // Store video record in DB with pending status and optional google_place_id
    const result = await pool.query(
      `INSERT INTO videos (cloudflare_video_id, status, google_place_id) 
       VALUES ($1, 'pending', $2) 
       RETURNING id, cloudflare_video_id, status, google_place_id, created_at`,
      [upload.id, google_place_id || null]
    );

    res.json({
      uploadUrl: upload.uploadURL,
      videoId: upload.id,
      dbRecord: result.rows[0],
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to create upload URL',
      details: error.message 
    });
  }
});

// Upload image post (1-10 images)
uploadRouter.post('/images', async (req, res) => {
  try {
    const { images, google_place_id } = req.body;
    
    if (!Array.isArray(images) || images.length < 1 || images.length > 10) {
      return res.status(400).json({ 
        error: 'Must provide between 1 and 10 images' 
      });
    }

    // Store image post with optional google_place_id
    const result = await pool.query(
      `INSERT INTO image_posts (images, google_place_id) 
       VALUES ($1, $2) 
       RETURNING id, images, google_place_id, created_at`,
      [images, google_place_id || null]
    );

    res.json({
      post: result.rows[0],
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to create image post' });
  }
});
