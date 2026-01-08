import { Router } from 'express';
import { pool } from '../db';

export const restaurantsRouter = Router();

interface MediaSummaryRequest {
  place_ids: string[];
}

interface MediaSummaryItem {
  video_count: number;
  image_count: number;
  latest_thumbnail_url: string | null;
}

/**
 * Get media summary for multiple restaurants
 * POST /api/restaurants/media-summary
 * Body: { place_ids: string[] }
 * Returns: { [place_id]: { video_count, image_count, latest_thumbnail_url } }
 */
restaurantsRouter.post('/media-summary', async (req, res) => {
  try {
    const { place_ids }: MediaSummaryRequest = req.body;
    
    if (!Array.isArray(place_ids) || place_ids.length === 0) {
      return res.status(400).json({ 
        error: 'Must provide an array of place_ids' 
      });
    }
    
    // Limit to prevent abuse
    if (place_ids.length > 100) {
      return res.status(400).json({ 
        error: 'Maximum 100 place_ids allowed per request' 
      });
    }

    // Get video counts and latest thumbnail per place_id
    const videoResult = await pool.query(
      `SELECT 
         google_place_id,
         COUNT(*) as video_count,
         (SELECT thumbnail_url 
          FROM videos v2 
          WHERE v2.google_place_id = videos.google_place_id 
          ORDER BY created_at DESC 
          LIMIT 1) as latest_thumbnail_url
       FROM videos 
       WHERE google_place_id = ANY($1)
       GROUP BY google_place_id`,
      [place_ids]
    );

    // Get image post counts per place_id
    const imageResult = await pool.query(
      `SELECT 
         google_place_id,
         COUNT(*) as image_count
       FROM image_posts 
       WHERE google_place_id = ANY($1)
       GROUP BY google_place_id`,
      [place_ids]
    );

    // Build response object
    const summary: Record<string, MediaSummaryItem> = {};
    
    // Initialize all requested place_ids with zeros
    for (const placeId of place_ids) {
      summary[placeId] = {
        video_count: 0,
        image_count: 0,
        latest_thumbnail_url: null,
      };
    }

    // Fill in video data
    for (const row of videoResult.rows) {
      if (summary[row.google_place_id]) {
        summary[row.google_place_id].video_count = parseInt(row.video_count, 10);
        summary[row.google_place_id].latest_thumbnail_url = row.latest_thumbnail_url;
      }
    }

    // Fill in image data
    for (const row of imageResult.rows) {
      if (summary[row.google_place_id]) {
        summary[row.google_place_id].image_count = parseInt(row.image_count, 10);
      }
    }

    res.json(summary);
  } catch (error) {
    console.error('Media summary error:', error);
    res.status(500).json({ error: 'Failed to fetch media summary' });
  }
});

/**
 * Get all media for a specific restaurant
 * GET /api/restaurants/:place_id/media
 */
restaurantsRouter.get('/:place_id/media', async (req, res) => {
  try {
    const { place_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Fetch videos for this restaurant
    const videosResult = await pool.query(
      `SELECT id, cloudflare_video_id, playback_url, thumbnail_url, 
              status, duration, created_at
       FROM videos 
       WHERE google_place_id = $1
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [place_id, limit, offset]
    );

    // Fetch image posts for this restaurant
    const imagesResult = await pool.query(
      `SELECT id, images, created_at
       FROM image_posts 
       WHERE google_place_id = $1
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [place_id, limit, offset]
    );

    // Combine and sort by created_at
    const media = [
      ...videosResult.rows.map(v => ({ type: 'video', ...v })),
      ...imagesResult.rows.map(i => ({ type: 'image_post', ...i })),
    ].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({
      place_id,
      media,
      count: media.length,
      hasMore: media.length === limit,
    });
  } catch (error) {
    console.error('Restaurant media error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant media' });
  }
});
