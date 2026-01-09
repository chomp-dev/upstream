import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const IMAGES_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images`;

// Account hash for delivery URLs (from Cloudflare dashboard or .env)
const CLOUDFLARE_IMAGES_ACCOUNT_HASH = process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH || 'y_RzXNi27DJvx8_ljU2bIQ';

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.warn('Missing Cloudflare credentials - image uploads will fail');
}

interface DirectUploadResponse {
    result: {
        id: string;
        uploadURL: string;
    };
    success: boolean;
    errors?: any[];
}

interface ImageUploadResult {
    result: {
        id: string;
        filename: string;
        uploaded: string;
        requireSignedURLs: boolean;
        variants: string[];
    };
    success: boolean;
    errors?: any[];
}

/**
 * Create a direct upload URL for Cloudflare Images
 * The client can then upload directly to this URL
 */
export async function createImageUploadUrl(): Promise<{ id: string; uploadURL: string }> {
    try {
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('requireSignedURLs', 'false');
        formData.append('metadata', JSON.stringify({
            source: 'chomp-mobile',
            uploadedAt: new Date().toISOString(),
        }));

        const response = await fetch(`${IMAGES_API_BASE}/v2/direct_upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        console.log('[CloudflareImages] API Response status:', response.status);

        if (response.status === 401 || response.status === 403) {
            console.error('[CloudflareImages] Authentication failed. Check CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
            throw new Error('Authentication failed with Cloudflare Images');
        }

        const data = await response.json() as DirectUploadResponse;

        if (!data.success) {
            console.error('[CloudflareImages] API error:', JSON.stringify(data.errors));
            throw new Error(`Failed to create image upload URL: ${data.errors?.[0]?.message || 'Unknown error'}`);
        }

        if (!data.result || !data.result.id || !data.result.uploadURL) {
            console.error('[CloudflareImages] Invalid response:', data);
            throw new Error('Invalid upload URL response from Cloudflare');
        }

        console.log('[CloudflareImages] Created upload URL for image ID:', data.result.id);

        return {
            id: data.result.id,
            uploadURL: data.result.uploadURL,
        };
    } catch (error) {
        console.error('[CloudflareImages] Error creating upload URL:', error);
        throw error;
    }
}

/**
 * Get the public delivery URL for an uploaded image
 * @param imageId - The Cloudflare image ID
 * @param variant - The variant name (e.g., 'public', 'thumbnail')
 */
export function getImageDeliveryUrl(imageId: string, variant: string = 'public'): string {
    return `https://imagedelivery.net/${CLOUDFLARE_IMAGES_ACCOUNT_HASH}/${imageId}/${variant}`;
}

/**
 * Upload an image directly from base64 data (for server-side uploads)
 * This is useful if the mobile app can't do direct upload
 */
export async function uploadImageFromBase64(
    base64Data: string,
    filename: string = 'image.jpg'
): Promise<{ id: string; url: string }> {
    try {
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Create form data
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', buffer, { filename });

        const response = await fetch(`${IMAGES_API_BASE}/v1`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Authentication failed with Cloudflare Images');
        }

        const data = await response.json() as ImageUploadResult;

        if (!data.success) {
            console.error('[CloudflareImages] Upload error:', data.errors);
            throw new Error('Failed to upload image');
        }

        const imageId = data.result.id;
        const url = getImageDeliveryUrl(imageId);

        console.log('[CloudflareImages] Uploaded image:', imageId);

        return { id: imageId, url };
    } catch (error) {
        console.error('[CloudflareImages] Error uploading image:', error);
        throw error;
    }
}
