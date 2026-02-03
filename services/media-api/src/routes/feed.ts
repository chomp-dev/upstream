import { Router } from 'express';
import { pool, queryWithRetry } from '../db';

export const feedRouter = Router();

// Debug endpoint to see all posts in database
feedRouter.get('/debug/all-posts', async (req, res) => {
  try {
    const result = await pool.query(`
       SELECT * 
       FROM posts 
       ORDER BY created_at DESC
    `);

    res.json({
      count: result.rowCount,
      posts: result.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoint to verify all videos and mark deleted ones
feedRouter.post('/admin/verify-all-videos', async (req, res) => {
  try {
    console.log('[Admin] Starting verification of all videos...');
    // @ts-ignore
    const { getVideo } = require('../services/cloudflare');

    // Get all videos from database
    const allVideos = await pool.query(
      `SELECT id, cloudflare_video_id, status FROM posts WHERE post_type = 'video' AND cloudflare_video_id IS NOT NULL ORDER BY created_at DESC`
    );

    console.log(`[Admin] Found ${allVideos.rows.length} videos to verify`);

    let verifiedCount = 0;
    let markedDeletedCount = 0;
    let errorCount = 0;

    for (const video of allVideos.rows) {
      try {
        const cloudflareStatus = await getVideo(video.cloudflare_video_id);

        // If 404/deleted, update DB
        if (!cloudflareStatus || (cloudflareStatus.status && cloudflareStatus.status.state === 'deleted')) {
          console.log(`[Admin] Video ${video.id} (${video.cloudflare_video_id}) is deleted on Cloudflare`);

          await pool.query(
            `UPDATE posts SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [video.id]
          );
          markedDeletedCount++;
        } else {
          verifiedCount++;
        }
      } catch (e: any) {
        // If 404 error from API
        if (e.statusCode === 404 || e.message?.includes('404')) {
          console.log(`[Admin] Video ${video.id} (${video.cloudflare_video_id}) not found on Cloudflare`);
          await pool.query(
            `UPDATE posts SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [video.id]
          );
          markedDeletedCount++;
        } else {
          console.error(`[Admin] Error checking video ${video.id}:`, e.message);
          errorCount++;
        }
      }
    }

    res.json({
      success: true,
      summary: {
        totalVideos: allVideos.rows.length,
        verified: verifiedCount,
        markedDeleted: markedDeletedCount,
        errors: errorCount
      }
    });

  } catch (error: any) {
    console.error('[Admin] Error verifying videos:', error);
    res.status(500).json({ error: error?.message || 'Failed to verify videos' });
  }
});

// Location-Based Feed - Posts from nearby restaurants
feedRouter.get('/nearby', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let placeIds: string[] = [];

    // Check if place_ids are provided directly (from frontend that already fetched nearby)
    if (req.query.place_ids) {
      const placeIdsParam = req.query.place_ids as string;
      placeIds = placeIdsParam.split(',').filter(Boolean);
      console.log(`[Feed/Nearby] Using ${placeIds.length} place_ids from request`);
    } else {
      // Fallback to lat/lng lookup
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Valid lat/lng or place_ids required' });
      }

      // Get nearby places from Google Places API
      // @ts-ignore
      const { searchRestaurants } = require('../services/googlePlaces');
      const places = await searchRestaurants("restaurant", lat, lng);
      placeIds = places.restaurants.map((r: any) => r.id);
    }

    if (placeIds.length === 0) {
      return res.json({ feed: [], count: 0, hasMore: false, feedMode: 'nearby', nearbyPlaceIds: [], totalNearbyRestaurants: 0 });
    }

    // Fetch posts linked to nearby restaurants - exclude error/deleted/pending posts
    const result = await queryWithRetry(
      `SELECT p.*, u.name as username, u.avatar as user_avatar, u.auth0_id as user_id
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.auth0_id
       WHERE p.google_place_id = ANY($1)
       AND p.status = 'ready'
       AND (p.post_type != 'video' OR p.playback_url IS NOT NULL)
       ORDER BY p.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [placeIds, limit, offset]
    );

    console.log(`[Feed/Nearby] Found ${result.rows.length} posts for nearby restaurants`);

    // Process posts
    const feed = await Promise.all(result.rows.map(async (post: any) => {
      // Map post_type to type
      const feedItem = {
        ...post,
        type: post.post_type // 'video', 'image', or 'tiktok_embed'
      };

      // Backward compatibility for 'image_post' type if frontend strictly checks 'image_post'
      if (feedItem.type === 'image') {
        feedItem.type = 'image_post';
      }

      // Filter out empty image URLs if any
      if (feedItem.type === 'image_post' && Array.isArray(feedItem.images)) {
        feedItem.images = feedItem.images.filter((url: string) => !!url);
      }

      return feedItem;
    }));

    const validFeed = feed.filter(item => item !== null);
    const matchedPlaceIds = [...new Set(validFeed.map((item: any) => item.google_place_id).filter(Boolean))];

    res.json({
      feed: validFeed,
      count: validFeed.length,
      hasMore: validFeed.length === limit,
      feedMode: 'nearby',
      nearbyPlaceIds: matchedPlaceIds,
      totalNearbyRestaurants: placeIds.length,
    });

  } catch (error: any) {
    console.error('Nearby feed error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby feed' });
  }
});

// Demo Feed - All posts
feedRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Fetch posts - exclude error/deleted/pending posts, require playback_url for videos
    let result = await queryWithRetry(
      `SELECT p.*, u.name as username, u.avatar as user_avatar, u.auth0_id as user_id
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.auth0_id
       WHERE p.status = 'ready'
       AND (p.post_type != 'video' OR p.playback_url IS NOT NULL)
       ORDER BY p.created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    console.log(`[Feed] Found ${result.rows.length} posts.`);

    // Check and update status for video posts
    const videosToCheck = result.rows.filter((p: any) => p.post_type === 'video' && p.cloudflare_video_id);

    if (videosToCheck.length > 0) {
      Promise.all(videosToCheck.map(async (video: any) => {
        try {
          // @ts-ignore
          const { getVideo } = require('../services/cloudflare');
          const status = await getVideo(video.cloudflare_video_id);

          if (!status || (status.status && status.status.state === 'deleted')) {
            await pool.query(
              `UPDATE posts SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE cloudflare_video_id = $1`,
              [video.cloudflare_video_id]
            );
          }
        } catch (e: any) {
          if (e.statusCode === 404) {
            await pool.query(
              `UPDATE posts SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE cloudflare_video_id = $1`,
              [video.cloudflare_video_id]
            );
          }
        }
      })).catch(err => console.error('Background status check failed:', err));
    }

    const feed = await Promise.all(result.rows.map(async (post: any) => {
      // Map post_type
      const feedItem = {
        ...post,
        type: post.post_type
      };

      if (feedItem.type === 'image') {
        feedItem.type = 'image_post';
      }

      return feedItem;
    }));

    res.json({
      feed,
      count: feed.length,
      hasMore: feed.length === limit,
    });

  } catch (error: any) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Delete a post
feedRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First get the post to know its type and details
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = result.rows[0];

    // Delete from DB
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);

    // Perform cleanup based on type (e.g. delete from Cloudflare)
    if (post.post_type === 'video' && post.cloudflare_video_id) {
      // @ts-ignore
      const { deleteVideo } = require('../services/cloudflare');
      try {
        await deleteVideo(post.cloudflare_video_id);
      } catch (e) {
        console.error('Failed to delete video from Cloudflare', e);
      }
    }

    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Edit a post (images only for now in original code?)
feedRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { images, title, description, tags } = req.body;

    // Check if post exists
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = result.rows[0];

    // Update fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (typeof title !== 'undefined') {
      updateFields.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (typeof description !== 'undefined') {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (typeof tags !== 'undefined') {
      updateFields.push(`tags = $${paramCount++}`);
      values.push(tags);
    }
    if (typeof images !== 'undefined' && (post.post_type === 'image' || post.post_type === 'image_post')) {
      // Validate images
      if (!Array.isArray(images) || images.length < 1 || images.length > 10) {
        return res.status(400).json({ error: 'Must provide between 1 and 10 images' });
      }

      // @ts-ignore
      const { getImageDeliveryUrl } = require('../services/cloudflareImages');
      const validImages = images.map((img: string) => {
        if (img.startsWith('http')) return img;
        return getImageDeliveryUrl(img);
      });

      updateFields.push(`images = $${paramCount++}`);
      values.push(validImages);
    }

    if (updateFields.length === 0) {
      return res.json({ success: true, post });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `UPDATE posts SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const updateResult = await pool.query(updateQuery, values);

    res.json({ success: true, post: updateResult.rows[0] });

  } catch (error: any) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});
