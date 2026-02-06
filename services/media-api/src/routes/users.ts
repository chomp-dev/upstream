import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';

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
            return res.status(400).json({ error: error.errors });
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
            return res.status(400).json({ error: error.errors });
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
