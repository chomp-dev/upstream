import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { sendModerationAlert } from '../services/moderationNotifications';

export const reportsRouter = Router();

const CreateReportSchema = z.object({
  reporterUserId: z.string().min(1),
  reportedUserId: z.string().min(1).optional(),
  contentType: z.enum(['video', 'image_post', 'comment', 'user']),
  contentId: z.string().min(1),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'hate', 'other']),
  description: z.string().max(1000).optional(),
});

reportsRouter.post('/', async (req, res) => {
  try {
    const body = CreateReportSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO reports (reporter_user_id, reported_user_id, content_type, content_id, reason, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        body.reporterUserId,
        body.reportedUserId || null,
        body.contentType,
        body.contentId,
        body.reason,
        body.description || null,
      ]
    );

    await sendModerationAlert({
      subject: 'Chomp moderation alert: content report',
      lines: [
        `Report ID: ${result.rows[0].id}`,
        `Reporter: ${body.reporterUserId}`,
        `Reported user: ${body.reportedUserId || 'unknown'}`,
        `Content: ${body.contentType}/${body.contentId}`,
        `Reason: ${body.reason}`,
        `Description: ${body.description || 'not provided'}`,
        `Timestamp: ${new Date().toISOString()}`,
      ],
    });

    res.json({ status: 'success', report: result.rows[0] });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('[Reports] Failed to create report:', error?.message);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

reportsRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, reporter_user_id, reported_user_id, content_type, content_id, reason, description, status, reviewed_by, reviewed_at, created_at
       FROM reports
       ORDER BY created_at DESC
       LIMIT 200`
    );
    res.json({ reports: result.rows });
  } catch (error: any) {
    console.error('[Reports] Failed to list reports:', error?.message);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

export default reportsRouter;
