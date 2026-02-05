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

// Sync user from Auth0 to our database
usersRouter.post('/', async (req, res) => {
    try {
        const userData = UserSchema.parse(req.body);

        // Upsert user based on auth0_id
        const query = `
      INSERT INTO users (auth0_id, email, name, avatar, email_verified)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (auth0_id) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, users.name),
        avatar = COALESCE(EXCLUDED.avatar, users.avatar),
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
