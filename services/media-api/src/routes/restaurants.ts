import { Router } from 'express';
import { pool, queryWithRetry } from '../db';

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
    if (place_ids.length > 500) {
      return res.status(400).json({
        error: 'Maximum 500 place_ids allowed per request'
      });
    }

    // Get aggregated counts and latest thumbnail per place_id
    // We can do this in one query with conditional aggregation
    // or two queries if simpler.
    // Let's do a single query for counts and thumbnail
    const summaryResult = await queryWithRetry(
      `SELECT 
         google_place_id,
         COUNT(*) FILTER (WHERE post_type = 'video') as video_count,
         COUNT(*) FILTER (WHERE post_type = 'image') as image_count,
         (SELECT thumbnail_url 
          FROM posts p2 
          WHERE p2.google_place_id = p.google_place_id 
            AND p2.post_type = 'video' 
            AND p2.thumbnail_url IS NOT NULL 
          ORDER BY created_at DESC 
          LIMIT 1) as latest_thumbnail_url
       FROM posts p
       WHERE google_place_id = ANY($1)
         AND (status != 'error' OR status IS NULL)
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

    // Fill in data
    for (const row of summaryResult.rows) {
      if (summary[row.google_place_id]) {
        summary[row.google_place_id].video_count = parseInt(row.video_count, 10);
        summary[row.google_place_id].image_count = parseInt(row.image_count, 10);
        summary[row.google_place_id].latest_thumbnail_url = row.latest_thumbnail_url;
      }
    }

    res.json(summary);
  } catch (error: any) {
    console.error('Media summary error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch media summary',
      details: error.message,
      code: error.code
    });
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

    // Fetch posts for this restaurant
    const result = await queryWithRetry(
      `SELECT *
       FROM posts 
       WHERE google_place_id = $1
         AND (status != 'error' OR status IS NULL)
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [place_id, limit, offset]
    );

    // Map to feed items
    const media = result.rows.map((post: any) => {
      // Map post_type
      const item = {
        ...post,
        type: post.post_type
      };

      if (item.type === 'image') {
        item.type = 'image_post';
      }

      return item;
    });

    res.json({
      place_id,
      media,
      count: media.length,
      hasMore: media.length === limit,
    });
  } catch (error: any) {
    console.error('Restaurant media error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch restaurant media',
      details: error.message,
      code: error.code
    });
  }
});
