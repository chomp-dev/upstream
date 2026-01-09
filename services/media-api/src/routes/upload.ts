import { Router } from 'express';
import { createDirectUploadUrl } from '../services/cloudflare';
import { createImageUploadUrl, getImageDeliveryUrl, uploadImageFromBase64 } from '../services/cloudflareImages';
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

// Get direct upload URL for a single image (Cloudflare Images)
// Client should call this for each image they want to upload
uploadRouter.post('/image-url', async (req, res) => {
  try {
    const upload = await createImageUploadUrl();

    res.json({
      imageId: upload.id,
      uploadURL: upload.uploadURL,
      // Client will use this to construct the delivery URL after upload
      deliveryUrl: getImageDeliveryUrl(upload.id),
    });
  } catch (error: any) {
    console.error('[Upload] Image URL error:', error);
    res.status(500).json({
      error: 'Failed to create image upload URL',
      details: error.message
    });
  }
});

// Upload image from base64 (server-side upload)
// Useful if client can't do direct upload to Cloudflare
uploadRouter.post('/image-base64', async (req, res) => {
  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data required' });
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await uploadImageFromBase64(base64Data, filename || 'image.jpg');

    res.json({
      imageId: result.id,
      url: result.url,
    });
  } catch (error: any) {
    console.error('[Upload] Base64 upload error:', error);
    res.status(500).json({
      error: 'Failed to upload image',
      details: error.message
    });
  }
});

// Create image post with Cloudflare image URLs
// Called after images have been uploaded to Cloudflare
uploadRouter.post('/images', async (req, res) => {
  try {
    const { images, google_place_id } = req.body;

    if (!Array.isArray(images) || images.length < 1 || images.length > 10) {
      return res.status(400).json({
        error: 'Must provide between 1 and 10 images'
      });
    }

    // Convert image IDs to delivery URLs if they're not already URLs
    const imageUrls = images.map((img: string) => {
      if (img.startsWith('http')) {
        return img; // Already a URL
      }
      // Assume it's a Cloudflare image ID
      return getImageDeliveryUrl(img);
    });

    // Store image post with optional google_place_id
    const result = await pool.query(
      `INSERT INTO image_posts (images, google_place_id) 
       VALUES ($1, $2) 
       RETURNING id, images, google_place_id, created_at`,
      [imageUrls, google_place_id || null]
    );

    res.json({
      post: result.rows[0],
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to create image post' });
  }
});
