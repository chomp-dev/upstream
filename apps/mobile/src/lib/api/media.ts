/**
 * Media API client
 * Communicates with the Express/TS backend (media-api)
 */

import { MEDIA_API_BASE } from '../env';
import type {
  FeedResponse,
  UploadVideoResponse,
  UploadImagesResponse,
  ImageUploadUrlResponse,
  MediaSummaryResponse,
} from './types';

/**
 * Fetch the feed of videos and image posts
 */
export async function fetchFeed(
  limit: number = 20,
  offset: number = 0
): Promise<FeedResponse> {
  const response = await fetch(
    `${MEDIA_API_BASE}/api/feed?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Request a video upload URL from Cloudflare Stream
 */
export async function requestVideoUpload(
  googlePlaceId?: string
): Promise<UploadVideoResponse> {
  const response = await fetch(`${MEDIA_API_BASE}/api/upload/video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      google_place_id: googlePlaceId || null,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to get upload URL');
  }

  return response.json();
}

/**
 * Get a direct upload URL for a single image (Cloudflare Images)
 * Call this for each image you want to upload
 */
export async function getImageUploadUrl(): Promise<ImageUploadUrlResponse> {
  const response = await fetch(`${MEDIA_API_BASE}/api/upload/image-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to get image upload URL');
  }

  return response.json();
}

/**
 * Upload an image file directly to Cloudflare
 * @param uploadUrl - The one-time upload URL from getImageUploadUrl()
 * @param imageUri - The local file URI to upload
 */
export async function uploadImageToCloudflare(
  uploadUrl: string,
  imageUri: string
): Promise<void> {
  // Create form data with the image
  const formData = new FormData();

  // For React Native, we need to create a file-like object
  const filename = imageUri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('file', {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Upload] Cloudflare upload failed:', text);
    throw new Error('Failed to upload image to Cloudflare');
  }
}

/**
 * Upload multiple images and create an image post
 * This handles the full flow: get URLs, upload to Cloudflare, create post
 */
export async function uploadImagesWithCloudflare(
  imageUris: string[],
  googlePlaceId?: string
): Promise<UploadImagesResponse> {
  const imageIds: string[] = [];

  // Upload each image
  for (const uri of imageUris) {
    // Get upload URL
    const { imageId, uploadURL } = await getImageUploadUrl();

    // Upload to Cloudflare
    await uploadImageToCloudflare(uploadURL, uri);

    // Store the image ID (will be converted to delivery URL on server)
    imageIds.push(imageId);
  }

  // Create the image post with the Cloudflare image IDs
  return uploadImages(imageIds, googlePlaceId);
}

/**
 * Upload images for an image post
 * Now accepts either local URIs (legacy) or Cloudflare image IDs
 */
export async function uploadImages(
  images: string[],
  googlePlaceId?: string
): Promise<UploadImagesResponse> {
  const response = await fetch(`${MEDIA_API_BASE}/api/upload/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images,
      google_place_id: googlePlaceId || null,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to upload images');
  }

  return response.json();
}

/**
 * Get media summary for multiple restaurants
 * Returns video/image counts per place_id
 */
export async function getMediaSummary(
  placeIds: string[]
): Promise<MediaSummaryResponse> {
  if (placeIds.length === 0) return {};

  // Chunk status to avoid 400 Payload Too Large/Request Entity Too Large on some servers
  const CHUNK_SIZE = 50;
  const chunks = [];

  for (let i = 0; i < placeIds.length; i += CHUNK_SIZE) {
    chunks.push(placeIds.slice(i, i + CHUNK_SIZE));
  }

  try {
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const response = await fetch(`${MEDIA_API_BASE}/api/restaurants/media-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place_ids: chunk }),
          });

          if (!response.ok) {
            console.warn('Media summary fetch failed for chunk:', response.status);
            return {};
          }

          return await response.json();
        } catch (e) {
          console.warn('Media summary chunk error:', e);
          return {};
        }
      })
    );

    // Merge results
    return results.reduce((acc, curr) => ({ ...acc, ...curr }), {});

  } catch (err) {
    console.error('getMediaSummary error:', err);
    return {};
  }
}

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${MEDIA_API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
