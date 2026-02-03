import { Router } from 'express';
import { pool } from '../db';

export const tiktokRouter = Router();

// TikTok oEmbed API endpoint
const TIKTOK_OEMBED_URL = 'https://www.tiktok.com/oembed';

interface TikTokOEmbedResponse {
    version: string;
    type: string;
    title: string;
    author_url: string;
    author_name: string;
    width: string;
    height: string;
    html: string;
    thumbnail_width: number;
    thumbnail_height: number;
    thumbnail_url: string;
    provider_url: string;
    provider_name: string;
}

/**
 * POST /api/tiktok
 * Add a TikTok video to the feed by URL
 * 
 * Body: { tiktok_url: string, google_place_id?: string }
 */
tiktokRouter.post('/', async (req, res) => {
    try {
        const { tiktok_url, google_place_id } = req.body;

        if (!tiktok_url) {
            return res.status(400).json({ error: 'tiktok_url is required' });
        }

        // Validate it's a TikTok URL
        if (!tiktok_url.includes('tiktok.com')) {
            return res.status(400).json({ error: 'Invalid TikTok URL' });
        }

        console.log(`[TikTok] Fetching oEmbed for: ${tiktok_url}`);

        // Fetch oEmbed data from TikTok
        const oembedUrl = `${TIKTOK_OEMBED_URL}?url=${encodeURIComponent(tiktok_url)}`;
        const response = await fetch(oembedUrl);

        if (!response.ok) {
            console.error(`[TikTok] oEmbed failed: ${response.status}`);
            return res.status(400).json({
                error: 'Failed to fetch TikTok data',
                details: `TikTok returned ${response.status}`
            });
        }

        const oembed = await response.json() as TikTokOEmbedResponse;

        console.log(`[TikTok] Got oEmbed: "${oembed.title}" by ${oembed.author_name}`);

        // Store in database
        const result = await pool.query(
            `INSERT INTO tiktok_embeds 
       (tiktok_url, embed_html, title, author_name, author_url, thumbnail_url, thumbnail_width, thumbnail_height, google_place_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, tiktok_url, title, author_name, thumbnail_url, google_place_id, created_at`,
            [
                tiktok_url,
                oembed.html,
                oembed.title,
                oembed.author_name,
                oembed.author_url,
                oembed.thumbnail_url,
                oembed.thumbnail_width,
                oembed.thumbnail_height,
                google_place_id || null,
            ]
        );

        res.json({
            success: true,
            embed: result.rows[0],
        });
    } catch (error: any) {
        console.error('[TikTok] Error:', error);
        res.status(500).json({ error: 'Failed to add TikTok embed', details: error.message });
    }
});

/**
 * GET /api/tiktok
 * List all TikTok embeds (for debugging)
 */
tiktokRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, tiktok_url, title, author_name, thumbnail_url, google_place_id, created_at
       FROM tiktok_embeds
       ORDER BY created_at DESC
       LIMIT 50`
        );

        res.json({ embeds: result.rows });
    } catch (error: any) {
        console.error('[TikTok] List error:', error);
        res.status(500).json({ error: 'Failed to list TikTok embeds' });
    }
});

/**
 * DELETE /api/tiktok/:id
 * Remove a TikTok embed
 */
tiktokRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM tiktok_embeds WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error: any) {
        console.error('[TikTok] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete TikTok embed' });
    }
});

export default tiktokRouter;
