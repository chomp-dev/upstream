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

// Get feed of videos and image posts
feedRouter.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Fetch ALL videos - show newest first regardless of status
    let videosResult = await pool.query(
      `SELECT id, cloudflare_video_id, playback_url, thumbnail_url, 
              status, duration, google_place_id, created_at, updated_at
       FROM videos 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    console.log(`[Feed] Found ${videosResult.rows.length} videos. Statuses: ${videosResult.rows.map(v => `${v.id}:${v.status}`).join(', ')}`);

    // Check and update status for non-ready videos
    const pendingVideos = videosResult.rows.filter(v => v.status !== 'ready' || !v.playback_url);
    if (pendingVideos.length > 0) {
      console.log(`[Feed] Checking ${pendingVideos.length} pending/processing videos for status updates...`);
    }
    
    for (const video of videosResult.rows) {
      // Check any video that is not ready or missing playback URL
      if ((video.status !== 'ready' || !video.playback_url) && video.cloudflare_video_id) {
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
            // Log error but don't fail - video might still be uploading or processing
            console.log(`[Feed] Could not check status for video ${video.cloudflare_video_id}:`, error?.message || error);
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
      ...imagesResult.rows.map(i => ({ type: 'image_post', ...i })),
    ].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({
      feed,
      hasMore: feed.length === limit,
    });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});
