import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { sendModerationAlert } from '../services/moderationNotifications';

export const usersRouter = Router();

const UserSchema = z.object({
    auth0Id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    picture: z.string().optional(),
    emailVerified: z.boolean().optional(),
});

const ProfileUpdateSchema = z.object({
    name: z.string().optional(),
    bio: z.string().optional(),
    avatar: z.string().optional(),
});

const TermsAcceptanceSchema = z.object({
    version: z.string().min(1).max(64),
});

const BlockUserSchema = z.object({
    blockedUserId: z.string().min(1),
    reason: z.string().max(300).optional(),
});

function formatZodError(error: z.ZodError): string {
    return error.errors
        .map((entry) => {
            const path = entry.path?.length ? `${entry.path.join('.')}: ` : '';
            return `${path}${entry.message}`;
        })
        .join('; ');
}

function getActorAuth0Id(req: Request): string | null {
    const headerValue = req.header('x-auth0-id');
    if (!headerValue) return null;
    return String(headerValue).trim();
}

// Sync user from Auth0 to our database
usersRouter.post('/', async (req, res) => {
    try {
        const userData = UserSchema.parse(req.body);

        // Upsert user based on auth0_id
        // IMPORTANT: Preserve existing name/avatar (user edits) - only use Auth0 values as fallback for new users
        const query = `
      INSERT INTO users (auth0_id, email, name, avatar, email_verified)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (auth0_id) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        name = COALESCE(users.name, EXCLUDED.name),
        avatar = COALESCE(users.avatar, EXCLUDED.avatar),
        email_verified = EXCLUDED.email_verified,
        updated_at = NOW()
      RETURNING *;
    `;

        const values = [
            userData.auth0Id,
            userData.email,
            userData.name || null,
            userData.picture || null,
            userData.emailVerified || false
        ];

        const result = await pool.query(query, values);

        res.json({
            status: 'success',
            user: result.rows[0]
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: formatZodError(error) });
        }
        console.error('Error syncing user:', {
            message: error?.message,
            code: error?.code,
            detail: error?.detail,
            constraint: error?.constraint,
            stack: error?.stack?.slice(0, 500)
        });
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined
        });
    }
});

// Update user profile (bypasses RLS for iOS compatibility)
usersRouter.put('/:auth0Id', async (req, res) => {
    try {
        const { auth0Id } = req.params;
        const updates = ProfileUpdateSchema.parse(req.body);

        if (!auth0Id) {
            return res.status(400).json({ error: 'auth0Id is required' });
        }

        console.log('[Users] Updating profile for:', auth0Id, updates);

        // Build dynamic update query
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            setClauses.push(`name = $${paramIndex++}`);
            values.push(updates.name);
        }
        if (updates.bio !== undefined) {
            setClauses.push(`bio = $${paramIndex++}`);
            values.push(updates.bio);
        }
        if (updates.avatar !== undefined) {
            setClauses.push(`avatar = $${paramIndex++}`);
            values.push(updates.avatar);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        setClauses.push(`updated_at = NOW()`);
        values.push(auth0Id);

        const query = `
            UPDATE users 
            SET ${setClauses.join(', ')}
            WHERE auth0_id = $${paramIndex}
            RETURNING *;
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('[Users] Profile updated successfully');
        res.json({
            status: 'success',
            user: result.rows[0]
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: formatZodError(error) });
        }
        console.error('[Users] Error updating profile:', {
            message: error?.message,
            code: error?.code,
            detail: error?.detail
        });
        res.status(500).json({
            error: 'Failed to update profile',
            details: process.env.NODE_ENV === 'development' ? error?.message : undefined
        });
    }
});

usersRouter.get('/:auth0Id/compliance', async (req, res) => {
    try {
        const { auth0Id } = req.params;
        const result = await pool.query(
            `SELECT auth0_id, terms_accepted_at, terms_version, is_suspended, is_removed, account_deleted_at
             FROM users
             WHERE auth0_id = $1`,
            [auth0Id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            acceptedTerms: !!user.terms_accepted_at,
            termsAcceptedAt: user.terms_accepted_at,
            termsVersion: user.terms_version,
            isSuspended: !!user.is_suspended,
            isRemoved: !!user.is_removed,
            accountDeletedAt: user.account_deleted_at,
        });
    } catch (error: any) {
        console.error('[Users] Failed to fetch compliance status:', error?.message);
        res.status(500).json({ error: 'Failed to fetch compliance status' });
    }
});

usersRouter.post('/:auth0Id/accept-terms', async (req, res) => {
    try {
        const { auth0Id } = req.params;
        const actorAuth0Id = getActorAuth0Id(req);
        const body = TermsAcceptanceSchema.parse(req.body);

        if (actorAuth0Id && actorAuth0Id !== auth0Id) {
            return res.status(403).json({ error: 'Cannot accept terms for another user' });
        }

        const result = await pool.query(
            `UPDATE users
             SET terms_accepted_at = NOW(),
                 terms_version = $1,
                 updated_at = NOW()
             WHERE auth0_id = $2
             RETURNING auth0_id, terms_accepted_at, terms_version`,
            [body.version, auth0Id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ status: 'success', compliance: result.rows[0] });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: formatZodError(error) });
        }
        console.error('[Users] Failed to accept terms:', error?.message);
        res.status(500).json({ error: 'Failed to accept terms' });
    }
});

usersRouter.get('/:auth0Id/blocks', async (req, res) => {
    try {
        const { auth0Id } = req.params;
        const actorAuth0Id = getActorAuth0Id(req);

        if (actorAuth0Id && actorAuth0Id !== auth0Id) {
            return res.status(403).json({ error: 'Cannot read another user block list' });
        }

        const result = await pool.query(
            `SELECT blocked_user_id, created_at
             FROM user_blocks
             WHERE blocker_user_id = $1
             ORDER BY created_at DESC`,
            [auth0Id]
        );

        res.json({ blockedUsers: result.rows });
    } catch (error: any) {
        console.error('[Users] Failed to fetch blocked users:', error?.message);
        res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
});

usersRouter.post('/:auth0Id/block', async (req, res) => {
    try {
        const { auth0Id } = req.params;
        const actorAuth0Id = getActorAuth0Id(req);
        const body = BlockUserSchema.parse(req.body);

        if (actorAuth0Id && actorAuth0Id !== auth0Id) {
            return res.status(403).json({ error: 'Cannot block users for another account' });
        }
        if (auth0Id === body.blockedUserId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }

        await pool.query(
            `INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
             VALUES ($1, $2)
             ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING`,
            [auth0Id, body.blockedUserId]
        );

        await sendModerationAlert({
            subject: 'Chomp moderation alert: user block',
            lines: [
                `Blocker: ${auth0Id}`,
                `Blocked: ${body.blockedUserId}`,
                `Reason: ${body.reason || 'not provided'}`,
                `Timestamp: ${new Date().toISOString()}`,
            ],
        });

        res.json({ status: 'success' });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: formatZodError(error) });
        }
        console.error('[Users] Failed to block user:', error?.message);
        res.status(500).json({ error: 'Failed to block user' });
    }
});

usersRouter.delete('/:auth0Id/block/:blockedUserId', async (req, res) => {
    try {
        const { auth0Id, blockedUserId } = req.params;
        const actorAuth0Id = getActorAuth0Id(req);

        if (actorAuth0Id && actorAuth0Id !== auth0Id) {
            return res.status(403).json({ error: 'Cannot unblock users for another account' });
        }

        await pool.query(
            `DELETE FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
            [auth0Id, blockedUserId]
        );

        res.json({ status: 'success' });
    } catch (error: any) {
        console.error('[Users] Failed to unblock user:', error?.message);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
});

usersRouter.delete('/:auth0Id', async (req, res) => {
    try {
        const { auth0Id } = req.params;
        const actorAuth0Id = getActorAuth0Id(req);

        if (actorAuth0Id && actorAuth0Id !== auth0Id) {
            return res.status(403).json({ error: 'Cannot delete another account' });
        }

        await pool.query('BEGIN');

        await pool.query(`DELETE FROM user_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1`, [auth0Id]);
        await pool.query(`DELETE FROM reports WHERE reporter_user_id = $1 OR reported_user_id = $1`, [auth0Id]);
        await pool.query(`DELETE FROM comments WHERE user_id = $1`, [auth0Id]);
        await pool.query(`DELETE FROM video_likes WHERE user_id = $1`, [auth0Id]);
        await pool.query(`DELETE FROM image_posts WHERE user_id = $1`, [auth0Id]);
        await pool.query(`DELETE FROM videos WHERE user_id = $1`, [auth0Id]);
        await pool.query(`DELETE FROM tiktok_embeds WHERE user_id = $1`, [auth0Id]);

        const result = await pool.query(
            `UPDATE users
             SET is_removed = TRUE,
                 account_deleted_at = NOW(),
                 updated_at = NOW()
             WHERE auth0_id = $1
             RETURNING auth0_id, account_deleted_at`,
            [auth0Id]
        );

        await pool.query('COMMIT');

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ status: 'success', accountDeletedAt: result.rows[0].account_deleted_at });
    } catch (error: any) {
        await pool.query('ROLLBACK');
        console.error('[Users] Failed to delete account:', error?.message);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});
