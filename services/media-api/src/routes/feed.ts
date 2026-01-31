import { Router } from 'express';
import { pool } from '../db';
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
    const videosResult = await pool.query(
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
    const imagesResult = await pool.query(
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
      ...videosResult.rows.map(v => ({ type: 'video', ...v })),
      ...imagesResult.rows.map(i => ({
        type: 'image_post',
        ...i,
        images: Array.isArray(i.images) ? i.images.filter((url: string) => !!url) : []
      })),
    ].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Get unique place_ids that actually have content
    const matchedPlaceIds = [...new Set(feed.map(item => item.google_place_id).filter(Boolean))];

    res.json({
      feed,
      hasMore: feed.length === limit,
      feedMode: 'nearby',
      nearbyPlaceIds: matchedPlaceIds,
      totalNearbyRestaurants: placeIds.length,
    });
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
    let videosResult = await pool.query(
      `SELECT id, cloudflare_video_id, playback_url, thumbnail_url, 
              status, duration, google_place_id, created_at, updated_at
       FROM videos 
       WHERE status != 'error'
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    console.log(`[Feed] Found ${videosResult.rows.length} videos. Statuses: ${videosResult.rows.map(v => `${v.id}:${v.status}`).join(', ')}`);

    // Check and update status for non-ready videos OR ready videos without playback URLs
    const videosToCheck = videosResult.rows.filter(v => v.status !== 'ready' || !v.playback_url);
    if (videosToCheck.length > 0) {
      console.log(`[Feed] Checking ${videosToCheck.length} videos for status updates...`);
    }

    for (const video of videosToCheck) {
      if (video.cloudflare_video_id) {
        try {
          console.log(`[Feed] Checking Cloudflare status for video ${video.cloudflare_video_id} (current: ${video.status})`);
          const cloudflareVideo = await getVideo(video.cloudflare_video_id);
          console.log(`[Feed] Video ${video.cloudflare_video_id} status from Cloudflare: ${cloudflareVideo.status}`);

          // Update database if status changed or if we have new playback URL
          const newPlaybackUrl = cloudflareVideo.playback?.hls || cloudflareVideo.playback?.dash || null;
          if (cloudflareVideo.status !== video.status ||
            cloudflareVideo.status === 'ready' ||
            (newPlaybackUrl && !video.playback_url)) {

            console.log(`[Feed] Updating video ${video.cloudflare_video_id} to status: ${cloudflareVideo.status}`);

            // Round duration to integer (PostgreSQL INTEGER column)
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
                video.cloudflare_video_id,
              ]
            );

            // Update the video in our result set
            video.status = cloudflareVideo.status;
            video.playback_url = newPlaybackUrl;
            video.thumbnail_url = cloudflareVideo.thumbnail || null;
            video.duration = durationInt;

            console.log(`[Feed] ✅ Video ${video.cloudflare_video_id} updated: status=${cloudflareVideo.status}, hasPlaybackUrl=${!!newPlaybackUrl}`);
          }
        } catch (error: any) {
          // If video returns 404, mark it as deleted
          const is404 = error?.statusCode === 404 ||
            error?.message?.includes('404') ||
            error?.message?.includes('not found');

          if (is404) {
            console.log(`[Feed] Video ${video.cloudflare_video_id} not found on Cloudflare (deleted), marking as error`);

            // Mark video as error/deleted in database
            await pool.query(
              `UPDATE videos 
                 SET status = 'error',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE cloudflare_video_id = $1`,
              [video.cloudflare_video_id]
            );

            video.status = 'error';
            console.log(`[Feed] ❌ Video ${video.cloudflare_video_id} marked as deleted/error`);
          } else {
            // Log other errors but don't fail - video might still be uploading or processing
            console.log(`[Feed] Could not check status for video ${video.cloudflare_video_id}:`, error?.message || error);
          }
        }
      }
    }

    // Fetch image posts
    const imagesResult = await pool.query(
      `SELECT id, images, google_place_id, created_at
       FROM image_posts 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Combine and interleave (simple approach - videos first, then images)
    const feed = [
      ...videosResult.rows.map(v => ({ type: 'video', ...v })),
      ...imagesResult.rows.map(i => ({
        type: 'image_post',
        ...i,
        images: Array.isArray(i.images) ? i.images.filter((url: string) => !!url) : []
      })),
    ].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Debug logging
    console.log('[Feed] Serving feed with ' + feed.length + ' items');
    const imagePosts = feed.filter(i => i.type === 'image_post');
    if (imagePosts.length > 0) {
      console.log('[Feed] content check:', JSON.stringify(imagePosts[0], null, 2));
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
