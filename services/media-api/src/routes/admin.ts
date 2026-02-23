import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { sendModerationAlert } from '../services/moderationNotifications';

export const adminRouter = Router();

const ResolveReportSchema = z.object({
  reviewedBy: z.string().min(1),
  action: z.enum(['remove_content', 'eject_user', 'dismiss']),
  targetUserId: z.string().optional(),
  contentType: z.enum(['video', 'image_post', 'comment', 'user']).optional(),
  contentId: z.string().optional(),
  note: z.string().max(1000).optional(),
});

adminRouter.post('/reports/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const body = ResolveReportSchema.parse(req.body);

    await pool.query('BEGIN');

    if (body.action === 'remove_content' && body.contentType && body.contentId) {
      if (body.contentType === 'video') {
        await pool.query(`DELETE FROM videos WHERE video_url = $1 OR id::text = $1`, [body.contentId]);
      } else if (body.contentType === 'image_post') {
        await pool.query(`DELETE FROM image_posts WHERE id::text = $1`, [body.contentId]);
      } else if (body.contentType === 'comment') {
        await pool.query(`DELETE FROM comments WHERE id::text = $1`, [body.contentId]);
      }
    }

    if (body.action === 'eject_user' && body.targetUserId) {
      await pool.query(
        `UPDATE users
         SET is_suspended = TRUE,
             is_removed = TRUE,
             suspended_reason = COALESCE($2, 'Moderation action'),
             updated_at = NOW()
         WHERE auth0_id = $1`,
        [body.targetUserId, body.note || null]
      );
      await pool.query(`DELETE FROM videos WHERE user_id = $1`, [body.targetUserId]);
      await pool.query(`DELETE FROM image_posts WHERE user_id = $1`, [body.targetUserId]);
      await pool.query(`DELETE FROM comments WHERE user_id = $1`, [body.targetUserId]);
      await pool.query(`DELETE FROM tiktok_embeds WHERE user_id = $1`, [body.targetUserId]);
    }

    const status = body.action === 'dismiss' ? 'dismissed' : 'resolved';
    const reportResult = await pool.query(
      `UPDATE reports
       SET status = $1, reviewed_by = $2, reviewed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, body.reviewedBy, id]
    );

    await pool.query('COMMIT');

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await sendModerationAlert({
      subject: 'Chomp moderation alert: report resolved',
      lines: [
        `Report ID: ${id}`,
        `Action: ${body.action}`,
        `Reviewer: ${body.reviewedBy}`,
        `Target user: ${body.targetUserId || 'n/a'}`,
        `Content: ${body.contentType || 'n/a'}/${body.contentId || 'n/a'}`,
        `Note: ${body.note || 'none'}`,
        `Timestamp: ${new Date().toISOString()}`,
      ],
    });

    res.json({ status: 'success', report: reportResult.rows[0] });
  } catch (error: any) {
    await pool.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('[Admin] Failed to resolve report:', error?.message);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

adminRouter.get('/reports/pending', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, reporter_user_id, reported_user_id, content_type, content_id, reason, description, created_at
       FROM reports
       WHERE status = 'pending'
       ORDER BY created_at ASC`
    );
    res.json({ reports: result.rows });
  } catch (error: any) {
    console.error('[Admin] Failed to fetch pending reports:', error?.message);
    res.status(500).json({ error: 'Failed to fetch pending reports' });
  }
});

export default adminRouter;
