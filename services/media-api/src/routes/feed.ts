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

// Debug endpoint to manually check video status from Cloudflare
feedRouter.get('/check-status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log(`[Debug] Checking status for video: ${videoId}`);
    const cloudflareVideo = await getVideo(videoId);
    console.log(`[Debug] Cloudflare response:`, cloudflareVideo);
    res.json({ success: true, video: cloudflareVideo });
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
