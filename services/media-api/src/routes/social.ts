import { Router } from 'express';
import { pool } from '../db';

export const socialRouter = Router();

/**
 * GET /api/social/status?video_url=...&user_id=...
 * OR  /api/social/status?image_post_id=...&user_id=...
 *
 * Returns all social counts and user-specific state in a single call.
 */
socialRouter.get('/status', async (req, res) => {
  try {
    const videoUrl = typeof req.query.video_url === 'string' ? req.query.video_url.trim() : '';
    const imagePostId = req.query.image_post_id ? Number(req.query.image_post_id) : null;
    const userId = typeof req.query.user_id === 'string' ? req.query.user_id.trim() : '';

    if (!videoUrl && !imagePostId) {
      return res.status(400).json({ error: 'Provide video_url or image_post_id' });
    }

    let likesCount = 0;
    let commentsCount = 0;
    let savesCount = 0;
    let isLiked = false;
    let isSaved = false;

    if (videoUrl) {
      const [likesRes, commentsRes, savesRes] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS cnt FROM video_likes WHERE video_url = $1', [videoUrl]),
        pool.query('SELECT COUNT(*)::int AS cnt FROM comments WHERE video_url = $1', [videoUrl]),
        pool.query('SELECT COUNT(*)::int AS cnt FROM saves WHERE video_url = $1', [videoUrl]),
      ]);
      likesCount = likesRes.rows[0]?.cnt || 0;
      commentsCount = commentsRes.rows[0]?.cnt || 0;
      savesCount = savesRes.rows[0]?.cnt || 0;

      if (userId) {
        const [likedRes, savedRes] = await Promise.all([
          pool.query('SELECT 1 FROM video_likes WHERE video_url = $1 AND user_id = $2', [videoUrl, userId]),
          pool.query('SELECT 1 FROM saves WHERE video_url = $1 AND user_id = $2', [videoUrl, userId]),
        ]);
        isLiked = likedRes.rows.length > 0;
        isSaved = savedRes.rows.length > 0;
      }
    } else if (imagePostId) {
      const [likesRes, commentsRes, savesRes] = await Promise.all([
        pool.query('SELECT COUNT(*)::int AS cnt FROM image_post_likes WHERE image_post_id = $1', [imagePostId]),
        pool.query('SELECT COUNT(*)::int AS cnt FROM comments WHERE image_post_id = $1', [imagePostId]),
        pool.query('SELECT COUNT(*)::int AS cnt FROM saves WHERE image_post_id = $1', [imagePostId]),
      ]);
      likesCount = likesRes.rows[0]?.cnt || 0;
      commentsCount = commentsRes.rows[0]?.cnt || 0;
      savesCount = savesRes.rows[0]?.cnt || 0;

      if (userId) {
        const [likedRes, savedRes] = await Promise.all([
          pool.query('SELECT 1 FROM image_post_likes WHERE image_post_id = $1 AND user_id = $2', [imagePostId, userId]),
          pool.query('SELECT 1 FROM saves WHERE image_post_id = $1 AND user_id = $2', [imagePostId, userId]),
        ]);
        isLiked = likedRes.rows.length > 0;
        isSaved = savedRes.rows.length > 0;
      }
    }

    res.json({ likes_count: likesCount, comments_count: commentsCount, saves_count: savesCount, is_liked: isLiked, is_saved: isSaved });
  } catch (error: any) {
    console.error('[Social] Status error:', error);
    res.status(500).json({ error: 'Failed to fetch social status' });
  }
});

/**
 * POST /api/social/like
 * Body: { video_url?, image_post_id?, user_id }
 * Toggles a like: inserts if not present, deletes if present. Returns new state.
 */
socialRouter.post('/like', async (req, res) => {
  try {
    const { video_url, image_post_id, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    if (!video_url && !image_post_id) return res.status(400).json({ error: 'Provide video_url or image_post_id' });

    let liked: boolean;
    let likesCount: number;

    if (video_url) {
      const existing = await pool.query(
        'SELECT 1 FROM video_likes WHERE video_url = $1 AND user_id = $2',
        [video_url, user_id]
      );

      if (existing.rows.length > 0) {
        await pool.query('DELETE FROM video_likes WHERE video_url = $1 AND user_id = $2', [video_url, user_id]);
        liked = false;
      } else {
        await pool.query(
          'INSERT INTO video_likes (video_url, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [video_url, user_id]
        );
        liked = true;
      }
      const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM video_likes WHERE video_url = $1', [video_url]);
      likesCount = countRes.rows[0]?.cnt || 0;
    } else {
      const id = Number(image_post_id);
      const existing = await pool.query(
        'SELECT 1 FROM image_post_likes WHERE image_post_id = $1 AND user_id = $2',
        [id, user_id]
      );

      if (existing.rows.length > 0) {
        await pool.query('DELETE FROM image_post_likes WHERE image_post_id = $1 AND user_id = $2', [id, user_id]);
        liked = false;
      } else {
        await pool.query(
          'INSERT INTO image_post_likes (image_post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, user_id]
        );
        liked = true;
      }
      const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM image_post_likes WHERE image_post_id = $1', [id]);
      likesCount = countRes.rows[0]?.cnt || 0;
    }

    res.json({ liked, likes_count: likesCount });
  } catch (error: any) {
    console.error('[Social] Like error:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

/**
 * POST /api/social/save
 * Body: { video_url?, image_post_id?, user_id }
 * Toggles a save: inserts if not present, deletes if present. Returns new state.
 */
socialRouter.post('/save', async (req, res) => {
  try {
    const { video_url, image_post_id, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    if (!video_url && !image_post_id) return res.status(400).json({ error: 'Provide video_url or image_post_id' });

    let saved: boolean;
    let savesCount: number;

    if (video_url) {
      const existing = await pool.query(
        'SELECT 1 FROM saves WHERE video_url = $1 AND user_id = $2',
        [video_url, user_id]
      );

      if (existing.rows.length > 0) {
        await pool.query('DELETE FROM saves WHERE video_url = $1 AND user_id = $2', [video_url, user_id]);
        saved = false;
      } else {
        await pool.query(
          'INSERT INTO saves (video_url, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [video_url, user_id]
        );
        saved = true;
      }
      const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM saves WHERE video_url = $1', [video_url]);
      savesCount = countRes.rows[0]?.cnt || 0;
    } else {
      const id = Number(image_post_id);
      const existing = await pool.query(
        'SELECT 1 FROM saves WHERE image_post_id = $1 AND user_id = $2',
        [id, user_id]
      );

      if (existing.rows.length > 0) {
        await pool.query('DELETE FROM saves WHERE image_post_id = $1 AND user_id = $2', [id, user_id]);
        saved = false;
      } else {
        await pool.query(
          'INSERT INTO saves (image_post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, user_id]
        );
        saved = true;
      }
      const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM saves WHERE image_post_id = $1', [id]);
      savesCount = countRes.rows[0]?.cnt || 0;
    }

    res.json({ saved, saves_count: savesCount });
  } catch (error: any) {
    console.error('[Social] Save error:', error);
    res.status(500).json({ error: 'Failed to toggle save' });
  }
});

export default socialRouter;
