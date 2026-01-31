import { Router } from 'express';
import { pool, queryWithRetry } from '../db';
import { getVideo } from '../services/cloudflare';

export const feedRouter = Router();

// Debug endpoint to see all videos in database
feedRouter.get('/debug/all-videos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, cloudflare_video_id, status, playback_url IS NOT NULL as has_playback, 
              thumbnail_url IS NOT NULL as has_thumbnail, google_place_id, created_at
       FROM videos 
       ORDER BY created_at DESC`
    );
    res.json({
      count: result.rows.length,
      videos: result.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// Debug endpoint to manually check video status from Cloudflare and sync DB
feedRouter.get('/check-status/:cloudflareVideoId', async (req, res) => {
  try {
    const { cloudflareVideoId } = req.params;
    console.log(`[Debug] Checking status for video: ${cloudflareVideoId}`);

    try {
      const cloudflareVideo = await getVideo(cloudflareVideoId);
      console.log(`[Debug] Cloudflare status: ${cloudflareVideo.status}`);

      // Update DB with latest status
      const newPlaybackUrl = cloudflareVideo.playback?.hls || cloudflareVideo.playback?.dash || null;
      const durationInt = cloudflareVideo.duration ? Math.round(cloudflareVideo.duration) : null;

      await pool.query(
        `UPDATE videos 
                SET status = $1, 
                    playback_url = $2, 
                    thumbnail_url = $3,
                    duration = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE cloudflare_video_id = $5`,
        [
          cloudflareVideo.status,
          newPlaybackUrl,
          cloudflareVideo.thumbnail || null,
          durationInt,
          cloudflareVideoId,
        ]
      );

      res.json({ success: true, video: cloudflareVideo });

    } catch (error: any) {
      // Handle 404 (Deleted on Cloudflare)
      const is404 = error?.statusCode === 404 ||
        error?.message?.includes('404') ||
        error?.message?.includes('not found') ||
        // Cloudflare sometimes returns 400 for invalid/deleted IDs
        error?.statusCode === 400;

      if (is404) {
        console.log(`[Debug] Video ${cloudflareVideoId} not found on Cloudflare (deleted), marking as error`);

        await pool.query(
          `UPDATE videos SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE cloudflare_video_id = $1`,
          [cloudflareVideoId]
        );
        return res.json({ success: true, status: 'error', message: 'Video marked as deleted' });
      }

      throw error;
    }
  } catch (error: any) {
    console.error(`[Debug] Error checking video:`, error);
    res.status(500).json({ error: error?.message || 'Failed to check video status' });
  }
});

// Admin endpoint to verify all videos and mark deleted ones
feedRouter.post('/admin/verify-all-videos', async (req, res) => {
  try {
    console.log('[Admin] Starting verification of all videos...');

    // Get all videos from database
    const allVideos = await pool.query(
      `SELECT id, cloudflare_video_id, status FROM videos ORDER BY created_at DESC`
    );

    let checked = 0;
    let markedAsError = 0;
    let stillValid = 0;

    for (const video of allVideos.rows) {
      if (video.cloudflare_video_id) {
        try {
          await getVideo(video.cloudflare_video_id);
          stillValid++;
        } catch (error: any) {
          const is404 = error?.statusCode === 404 ||
            error?.message?.includes('404') ||
            error?.message?.includes('not found');

          if (is404 && video.status !== 'error') {
            // Mark as error
            await pool.query(
              `UPDATE videos SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [video.id]
            );
            markedAsError++;
            console.log(`[Admin] Marked video ${video.cloudflare_video_id} as error (deleted from Cloudflare)`);
          }
        }
        checked++;
      }
    }

    console.log(`[Admin] Verification complete: ${checked} checked, ${markedAsError} marked as error, ${stillValid} still valid`);

    res.json({
      success: true,
      totalVideos: allVideos.rows.length,
      checked,
      markedAsError,
      stillValid,
    });
  } catch (error: any) {
    console.error('[Admin] Error verifying videos:', error);
    res.status(500).json({ error: error?.message || 'Failed to verify videos' });
  }
});

// ============================================================================
// Location-Based Feed - Videos from nearby restaurants
// ============================================================================

/**
 * Get feed of videos and image posts for nearby restaurants
 * GET /api/feed/nearby?place_ids=id1,id2,id3&limit=20&offset=0
 * 
 * Returns only content linked to the specified google_place_ids.
 * Used by mobile app to show location-relevant content.
 */
feedRouter.get('/nearby', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Parse place_ids from query string (comma-separated or repeated params)
    let placeIds: string[] = [];
    const placeIdsParam = req.query.place_ids;

    if (typeof placeIdsParam === 'string') {
      placeIds = placeIdsParam.split(',').map(id => id.trim()).filter(Boolean);
    } else if (Array.isArray(placeIdsParam)) {
      placeIds = placeIdsParam.map(id => String(id).trim()).filter(Boolean);
    }

    console.log(`[Feed/Nearby] Request with ${placeIds.length} place_ids, limit=${limit}, offset=${offset}`);

    // If no place_ids provided, return empty feed
    if (placeIds.length === 0) {
      return res.json({
        feed: [],
        hasMore: false,
        feedMode: 'nearby',
        nearbyPlaceIds: [],
        totalNearbyRestaurants: 0,
      });
    }

    // Fetch videos linked to nearby restaurants - exclude error/deleted videos
    // Fetch videos linked to nearby restaurants - exclude error/deleted videos
    const videosResult = await queryWithRetry(
      `SELECT id, cloudflare_video_id, playback_url, thumbnail_url, 
              status, duration, google_place_id, created_at, updated_at
       FROM videos 
       WHERE status != 'error' 
         AND google_place_id = ANY($1)
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [placeIds, limit, offset]
    );

    console.log(`[Feed/Nearby] Found ${videosResult.rows.length} videos for nearby restaurants`);

    // Fetch image posts linked to nearby restaurants
    const imagesResult = await queryWithRetry(
      `SELECT id, images, google_place_id, created_at
       FROM image_posts 
       WHERE google_place_id = ANY($1)
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [placeIds, limit, offset]
    );

    console.log(`[Feed/Nearby] Found ${imagesResult.rows.length} image posts for nearby restaurants`);

    // Combine and interleave, sorted by created_at
    const feed = [
      ...videosResult.rows.map((v: any) => ({ type: 'video', ...v })),
      ...imagesResult.rows.map((i: any) => ({
        type: 'image_post',
        ...i,
        images: Array.isArray(i.images) ? i.images.filter((url: string) => !!url) : []
      })),
    ].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Get unique place_ids that actually have content
    const matchedPlaceIds = [...new Set(feed.map((item: any) => item.google_place_id).filter(Boolean))];

    res.json({
      feed,
      hasMore: feed.length === limit,
      feedMode: 'nearby',
      nearbyPlaceIds: matchedPlaceIds,
      totalNearbyRestaurants: placeIds.length,
    });

    // Background validation (Fire-and-forget)
    // Check and update status for ALL videos to handle manual Cloudflare deletions
    const videosToCheck = videosResult.rows.filter((v: any) => v.cloudflare_video_id);

    if (videosToCheck.length > 0) {
      Promise.all(videosToCheck.map(async (video: any) => {
        try {
          // We need to import getVideo at the top or assumed it's available
          const cloudflareVideo = await getVideo(video.cloudflare_video_id);
          // ... existing code ...

          // Update database if status changed OR if we need to sync metadata
          const newPlaybackUrl = cloudflareVideo.playback?.hls || cloudflareVideo.playback?.dash || null;
          const durationInt = cloudflareVideo.duration ? Math.round(cloudflareVideo.duration) : null;

          if (cloudflareVideo.status !== video.status ||
            !video.playback_url ||
            video.duration !== durationInt) {

            console.log(`[Feed/Nearby] Syncing video ${video.cloudflare_video_id}: ${video.status} -> ${cloudflareVideo.status}`);

            await pool.query(
              `UPDATE videos 
                 SET status = $1, 
                     playback_url = $2, 
                     thumbnail_url = $3,
                     duration = $4,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE cloudflare_video_id = $5`,
              [
                cloudflareVideo.status,
                newPlaybackUrl,
                cloudflareVideo.thumbnail || null,
                durationInt,
                video.cloudflare_video_id,
              ]
            );
          }
        } catch (error: any) {
          // Check for 404 (Deleted)
          const is404 = error?.statusCode === 404 ||
            error?.message?.includes('404') ||
            error?.message?.includes('not found') ||
            error?.statusCode === 400;

          if (is404) {
            console.log(`[Feed/Nearby] Video ${video.cloudflare_video_id} deleted on Cloudflare, marking as error`);

            await pool.query(
              `UPDATE videos SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE cloudflare_video_id = $1`,
              [video.cloudflare_video_id]
            );
          } else {
            console.warn(`[Feed/Nearby] Status check failed for ${video.cloudflare_video_id}:`, error?.message);
          }
        }
      })).catch(err => console.error('[Feed/Nearby] Background validation error:', err));
    }

    // Validate images in background
    if (imagesResult.rows.length > 0) {
      validateImagePosts(imagesResult.rows);
    }
  } catch (error) {
    console.error('[Feed/Nearby] Error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby feed' });
  }
});

// ============================================================================
// Demo Feed - All videos (original behavior)
// ============================================================================

// Get feed of videos and image posts
feedRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Fetch videos - exclude error/deleted videos
    // Fetch videos - exclude error/deleted videos
    let videosResult = await queryWithRetry(
      `SELECT id, cloudflare_video_id, playback_url, thumbnail_url, 
              status, duration, google_place_id, created_at, updated_at
       FROM videos 
       WHERE status != 'error'
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    console.log(`[Feed] Found ${videosResult.rows.length} videos. Statuses: ${videosResult.rows.map(v => `${v.id}:${v.status}`).join(', ')}`);

    // Check and update status for ALL videos to handle manual Cloudflare deletions
    // We run this in the background (no await) to keep the feed fast
    const videosToCheck = videosResult.rows.filter((v: any) => v.cloudflare_video_id);

    if (videosToCheck.length > 0) {
      // Fire-and-forget validation
      // This means the current response might show deleted videos (stale), but they will be fixed on next refresh
      Promise.all(videosToCheck.map(async (video: any) => {
        try {
          const cloudflareVideo = await getVideo(video.cloudflare_video_id);

          // Update database if status changed OR if we need to sync metadata
          const newPlaybackUrl = cloudflareVideo.playback?.hls || cloudflareVideo.playback?.dash || null;
          const durationInt = cloudflareVideo.duration ? Math.round(cloudflareVideo.duration) : null;

          if (cloudflareVideo.status !== video.status ||
            !video.playback_url ||
            video.duration !== durationInt) {

            console.log(`[Feed] Syncing video ${video.cloudflare_video_id}: ${video.status} -> ${cloudflareVideo.status}`);

            await pool.query(
              `UPDATE videos 
                 SET status = $1, 
                     playback_url = $2, 
                     thumbnail_url = $3,
                     duration = $4,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE cloudflare_video_id = $5`,
              [
                cloudflareVideo.status,
                newPlaybackUrl,
                cloudflareVideo.thumbnail || null,
                durationInt,
                video.cloudflare_video_id,
              ]
            );
          }
        } catch (error: any) {
          // Check for 404 (Deleted)
          const is404 = error?.statusCode === 404 ||
            error?.message?.includes('404') ||
            error?.message?.includes('not found') ||
            error?.statusCode === 400;

          if (is404) {
            console.log(`[Feed] Video ${video.cloudflare_video_id} deleted on Cloudflare, marking as error`);

            await pool.query(
              `UPDATE videos SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE cloudflare_video_id = $1`,
              [video.cloudflare_video_id]
            );
          } else {
            console.warn(`[Feed] Status check failed for ${video.cloudflare_video_id}:`, error?.message);
          }
        }
      })).catch(err => console.error('[Feed] Background validation error:', err));
    }

    // Fetch image posts
    // Fetch image posts
    const imagesResult = await queryWithRetry(
      `SELECT id, images, google_place_id, created_at
       FROM image_posts 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Combine and interleave (simple approach - videos first, then images)
    const feed = [
      ...videosResult.rows.map((v: any) => ({ type: 'video', ...v })),
      ...imagesResult.rows.map((i: any) => ({
        type: 'image_post',
        ...i,
        images: Array.isArray(i.images) ? i.images.filter((url: string) => !!url) : []
      })),
    ].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Debug logging
    console.log('[Feed] Serving feed with ' + feed.length + ' items');
    const imagePosts = feed.filter((i: any) => i.type === 'image_post');
    if (imagePosts.length > 0) {
      console.log('[Feed] content check:', JSON.stringify(imagePosts[0], null, 2));
      // Validate images in background
      validateImagePosts(imagesResult.rows);
    }

    res.json({
      feed,
      hasMore: feed.length === limit,
    });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Helper to validate image posts in background
async function validateImagePosts(imagePosts: any[]) {
  if (!imagePosts || imagePosts.length === 0) return;

  // @ts-ignore
  const { getImage } = require('../services/cloudflare');

  Promise.all(imagePosts.map(async (post) => {
    try {
      if (!post.images || !Array.isArray(post.images) || post.images.length === 0) return;

      const validImages: string[] = [];
      let hasChanges = false;

      for (const imageUrl of post.images) {
        // Extract ID from URL
        // https://imagedelivery.net/<hash>/<id>/<variant>
        const matches = imageUrl.match(/imagedelivery\.net\/[^\/]+\/([^\/]+)/);
        if (matches && matches[1]) {
          const imageId = matches[1];
          try {
            await getImage(imageId);
            validImages.push(imageUrl);
          } catch (error: any) {
            if (error.statusCode === 404) {
              console.log(`[Feed/Images] Image ${imageId} in post ${post.id} deleted on Cloudflare, removing.`);
              hasChanges = true;
            } else {
              // If other error, keep it (innocent until proven guilty)
              validImages.push(imageUrl);
            }
          }
        } else {
          // Not a cloudflare URL, keep it
          validImages.push(imageUrl);
        }
      }

      if (hasChanges) {
        if (validImages.length === 0) {
          console.log(`[Feed/Images] Post ${post.id} has no valid images left, deleting.`);
          await pool.query('DELETE FROM image_posts WHERE id = $1', [post.id]);
        } else {
          console.log(`[Feed/Images] Updating post ${post.id} with valid images.`);
          await pool.query('UPDATE image_posts SET images = $1 WHERE id = $2', [validImages, post.id]);
        }
      }
    } catch (e) {
      console.error(`[Feed/Images] Error validating post ${post.id}:`, e);
    }
  })).catch(err => console.error('[Feed/Images] Validation error:', err));
}

export default feedRouter;
