import { Router } from 'express';
import { pool } from '../db';

export const commentsRouter = Router();

/**
 * POST /api/comments
 * Create a new comment (optionally as a reply)
 * Body: { video_url, user_id, content, parent_id? }
 */
commentsRouter.post('/', async (req, res) => {
    try {
        const { video_url, user_id, content, parent_id } = req.body;

        if (!video_url || !user_id || !content) {
            return res.status(400).json({ error: 'video_url, user_id, and content are required' });
        }

        const result = await pool.query(
            `INSERT INTO comments (video_url, user_id, content, parent_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, video_url, user_id, content, parent_id, likes_count, created_at`,
            [video_url, user_id, content.trim(), parent_id || null]
        );

        res.json({ success: true, comment: result.rows[0] });
    } catch (error: any) {
        console.error('[Comments] Create error:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

/**
 * POST /api/comments/:id/like
 * Like a comment
 * Body: { user_id }
 */
commentsRouter.post('/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Insert like (ignore if already exists)
        await pool.query(
            `INSERT INTO comment_likes (comment_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (comment_id, user_id) DO NOTHING`,
            [id, user_id]
        );

        // Update likes_count
        const result = await pool.query(
            `UPDATE comments 
             SET likes_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1)
             WHERE id = $1
             RETURNING likes_count`,
            [id]
        );

        res.json({
            success: true,
            liked: true,
            likes_count: result.rows[0]?.likes_count || 0
        });
    } catch (error: any) {
        console.error('[Comments] Like error:', error);
        res.status(500).json({ error: 'Failed to like comment' });
    }
});

/**
 * DELETE /api/comments/:id/like
 * Unlike a comment
 * Body: { user_id }
 */
commentsRouter.delete('/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        // Remove like
        await pool.query(
            `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
            [id, user_id]
        );

        // Update likes_count
        const result = await pool.query(
            `UPDATE comments 
             SET likes_count = (SELECT COUNT(*) FROM comment_likes WHERE comment_id = $1)
             WHERE id = $1
             RETURNING likes_count`,
            [id]
        );

        res.json({
            success: true,
            liked: false,
            likes_count: result.rows[0]?.likes_count || 0
        });
    } catch (error: any) {
        console.error('[Comments] Unlike error:', error);
        res.status(500).json({ error: 'Failed to unlike comment' });
    }
});

/**
 * GET /api/comments/:id/likes
 * Get user IDs who liked a comment (for checking if current user liked)
 * Query: ?user_id=xxx
 */
commentsRouter.get('/:id/likes', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.query;

        // Check if specific user liked
        if (user_id) {
            const result = await pool.query(
                `SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
                [id, user_id]
            );
            return res.json({ liked: result.rows.length > 0 });
        }

        // Get all likes count
        const result = await pool.query(
            `SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = $1`,
            [id]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error: any) {
        console.error('[Comments] Get likes error:', error);
        res.status(500).json({ error: 'Failed to get likes' });
    }
});

export default commentsRouter;
