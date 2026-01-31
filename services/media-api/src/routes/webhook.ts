import { Router } from 'express';
import { pool } from '../db';
import { getVideo } from '../services/cloudflare';

export const webhookRouter = Router();

// Cloudflare Stream webhook handler
webhookRouter.post('/cloudflare-stream', async (req, res) => {
  try {
    // Cloudflare webhook format: { result: { uid, status: { state }, ... } }
    const video = req.body.result || req.body.video || req.body;

    if (!video || !video.uid) {
      console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const videoId = video.uid;
    const status = video.status?.state || video.state || 'pending';

    console.log(`[Webhook] Received update for video ${videoId}, status: ${status}`);

    // If status is still 'pendingupload', it means the file hasn't reached Cloudflare yet
    // We log it but might not want to update DB to 'pending' if it's already there
    if (status === 'pendingupload') {
      console.log(`[Webhook] Video ${videoId} is pending upload (waiting for file)`);
      return res.json({ success: true, status: 'pendingupload' });
    }

    // Fetch full video details from Cloudflare to ensure we have latest data
    const videoDetails = await getVideo(videoId);

    // Update database with video details
    await pool.query(
      `UPDATE videos 
       SET status = $1, 
           playback_url = $2, 
           thumbnail_url = $3,
           duration = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE cloudflare_video_id = $5`,
      [
        videoDetails.status || status,
        videoDetails.playback?.hls || videoDetails.playback?.dash || null,
        videoDetails.thumbnail || null,
        videoDetails.duration || null,
        videoId,
      ]
    );

    console.log(`✅ Video ${videoId} processed with status: ${videoDetails.status || status}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

