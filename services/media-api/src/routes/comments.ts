import { Router } from 'express';
import { pool } from '../db';

export const commentsRouter = Router();

function parseCommentTarget(input: { video_url?: unknown; image_post_id?: unknown }) {
    const videoUrl = typeof input.video_url === 'string' ? input.video_url.trim() : '';
    const rawImagePostId = typeof input.image_post_id === 'string' || typeof input.image_post_id === 'number'
        ? Number(input.image_post_id)
        : NaN;
    const imagePostId = Number.isFinite(rawImagePostId) && rawImagePostId > 0
        ? rawImagePostId
        : null;

    const hasVideoTarget = Boolean(videoUrl);
    const hasImageTarget = imagePostId !== null;
    if (hasVideoTarget === hasImageTarget) {
        return { error: 'Provide exactly one target: video_url or image_post_id' as const };
    }

    return {
        videoUrl: hasVideoTarget ? videoUrl : null,
        imagePostId,
    };
}

/**
 * GET /api/comments?video_url=... OR /api/comments?image_post_id=...
 * Fetch comments for a target, including user metadata and nested replies.
 */
commentsRouter.get('/', async (req, res) => {
    try {
        const target = parseCommentTarget({
            video_url: req.query.video_url,
            image_post_id: req.query.image_post_id,
        });
        if ('error' in target) {
            return res.status(400).json({ error: target.error });
        }

        const result = await pool.query(
            `SELECT
                c.id,
                c.content,
                c.user_id,
                c.created_at,
                c.parent_id,
                c.likes_count,
                u.name AS user_name,
                u.avatar AS user_avatar
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.auth0_id
             WHERE (
               ($1::text IS NOT NULL AND c.video_url = $1)
               OR
               ($2::int IS NOT NULL AND c.image_post_id = $2)
             )
             ORDER BY c.created_at ASC`,
            [target.videoUrl, target.imagePostId]
        );

        const rows = result.rows.map((row: any) => ({
            id: String(row.id),
            content: row.content,
            user_id: row.user_id,
            created_at: row.created_at,
            parent_id: row.parent_id ? String(row.parent_id) : null,
            likes_count: row.likes_count || 0,
            user: {
                name: row.user_name || 'User',
                avatar: row.user_avatar || '',
            },
            replies: [] as any[],
        }));

        const byId = new Map<string, any>();
        rows.forEach((row: any) => byId.set(row.id, row));

        const topLevel: any[] = [];
        rows.forEach((row: any) => {
            if (row.parent_id && byId.has(row.parent_id)) {
                byId.get(row.parent_id).replies.push(row);
            } else {
                topLevel.push(row);
            }
        });

        topLevel.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        res.json({ success: true, comments: topLevel });
    } catch (error: any) {
        console.error('[Comments] Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

/**
 * POST /api/comments
 * Create a new comment (optionally as a reply)
 * Body: { video_url?, image_post_id?, user_id, content, parent_id? }
 */
commentsRouter.post('/', async (req, res) => {
    try {
        const { user_id, content, parent_id } = req.body;
        const target = parseCommentTarget({
            video_url: req.body.video_url,
            image_post_id: req.body.image_post_id,
        });

        if ('error' in target) {
            return res.status(400).json({ error: target.error });
        }

        if (!user_id || !content) {
            return res.status(400).json({ error: 'user_id and content are required' });
        }

        const result = await pool.query(
            `INSERT INTO comments (video_url, image_post_id, user_id, content, parent_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, video_url, image_post_id, user_id, content, parent_id, likes_count, created_at`,
            [target.videoUrl, target.imagePostId, user_id, content.trim(), parent_id || null]
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
