/**
 * Media API client
 * Communicates with the Express/TS backend (media-api)
 */

import { Platform } from 'react-native';
import { MEDIA_API_BASE } from '../env';
export const BASE_URL = MEDIA_API_BASE;
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
 * Fetch the feed of videos and image posts for nearby restaurants
 * @param placeIds - Array of google_place_ids for nearby restaurants
 */
export async function fetchNearbyFeed(
  placeIds: string[],
  limit: number = 20,
  offset: number = 0
): Promise<FeedResponse> {
  if (placeIds.length === 0) {
    return {
      feed: [],
      hasMore: false,
      feedMode: 'nearby',
      nearbyPlaceIds: [],
      totalNearbyRestaurants: 0,
    };
  }

  const response = await fetch(
    `${MEDIA_API_BASE}/api/feed/nearby?place_ids=${placeIds.join(',')}&limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error(`Nearby feed fetch failed: ${response.status}`);
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
 * Check the status of a video upload
 * Used to verify if the file actually reached Cloudflare
 */
export async function checkVideoUploadStatus(
  videoId: string
): Promise<{ status: string; uid: string }> {
  try {
    const response = await fetch(`${MEDIA_API_BASE}/api/upload/video/${videoId}/status`);

    if (!response.ok) {
      if (response.status === 404) {
        // This is actually expected if we check immediately after upload sometimes
        throw new Error('Video not found (upload likely failed)');
      }
      // Don't throw for other errors, just return unknown status so we retry
      console.warn(`[API] Check status failed: ${response.status}`);
      return { status: 'unknown', uid: videoId };
    }
    return response.json();
  } catch (error) {
    console.warn('[API] Error checking status:', error);
    return { status: 'unknown', uid: videoId };
  }
}

// Error reporting removed as per user request for backend-only handling

/**
 * Upload a video file directly to Cloudflare
 * Replaces unreliable FileSystem upload
 */
export async function uploadVideoToCloudflare(
  uploadUrl: string,
  videoUri: string
): Promise<void> {
  const formData = new FormData();
  console.log('[Upload] Starting video upload (V2 Fetch)...');

  if (Platform.OS === 'web') {
    console.log('[Upload] Web detected, fetching blob from:', videoUri);
    try {
      const blob = await fetch(videoUri).then(r => r.blob());
      console.log('[Upload] Video Blob created:', blob.size, blob.type);
      formData.append('file', blob, 'video.mp4');
    } catch (e) {
      console.error('[Upload] Failed to create video blob:', e);
      throw e;
    }
  } else {
    // Native
    const filename = videoUri.split('/').pop() || 'video.mp4';
    // react-native-blob-util or just standard FormData handling
    formData.append('file', {
      uri: videoUri,
      name: filename,
      type: 'video/mp4', // Explicitly set for video
    } as any);
  }

  console.log('[Upload] Sending video to Cloudflare:', uploadUrl);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Upload] Cloudflare video upload failed:', text);
    throw new Error(`Failed to upload video to Cloudflare: ${response.status}`);
  }
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
  const formData = new FormData();

  // Detect mobile Safari
  const isMobileSafari = Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod/i.test(navigator.userAgent);

  console.log('[Upload] Starting image upload...');
  console.log('[Upload] Platform:', Platform.OS);
  console.log('[Upload] Is Mobile Safari:', isMobileSafari);
  console.log('[Upload] Image URI:', imageUri);
  console.log('[Upload] Upload URL:', uploadUrl);

  try {
    if (Platform.OS === 'web') {
      // Web platform (includes Safari on macOS and iOS)
      console.log('[Upload] Web/Safari detected, fetching blob...');

      // Safari fix: Fetch blob immediately before it expires
      const response = await fetch(imageUri);
      console.log('[Upload] Fetch response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to fetch blob from picker: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('[Upload] Blob fetched - Size:', blob.size, 'bytes, Type:', blob.type);

      // CRITICAL: Check if blob is actually valid (Safari mobile may return empty blob)
      if (blob.size === 0) {
        throw new Error('Blob is empty - Safari/mobile may have failed to provide image data. Try selecting a different image or using a smaller file.');
      }

      // Safari fix: Ensure proper MIME type
      const mimeType = blob.type || 'image/jpeg';
      const extension = mimeType.split('/')[1] || 'jpg';
      const filename = `image.${extension}`;

      // Safari fix: Create new Blob with explicit type if missing
      const finalBlob = blob.type ? blob : new Blob([blob], { type: 'image/jpeg' });

      formData.append('file', finalBlob, filename);
      console.log('[Upload] FormData prepared with blob as:', filename);
    } else {
      // Native iOS/Android
      console.log('[Upload] Native platform, using URI directly');
      const filename = imageUri.split('/').pop() || 'image.jpg';
      const extension = filename.split('.').pop()?.toLowerCase() || 'jpg';

      // Proper MIME type detection
      const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'heic': 'image/heic',
      };
      const mimeType = mimeTypes[extension] || 'image/jpeg';

      formData.append('file', {
        uri: imageUri,
        name: filename,
        type: mimeType,
      } as any);

      console.log('[Upload] FormData prepared:', { filename, mimeType });
    }

    console.log('[Upload] Uploading to Cloudflare...');

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('[Upload] Response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Upload] Upload failed:', errorText);
      throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log('[Upload] Upload successful:', result);

  } catch (error) {
    console.error('[Upload] Error during image upload:', error);
    throw new Error(`Image upload failed: ${(error as Error).message}`);
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
 * Uses backend API to bypass RLS issues on iOS
 */
export async function uploadImages(
  images: string[],
  googlePlaceId?: string,
  title?: string,
  description?: string,
  tags?: string[],
  userId?: string
): Promise<UploadImagesResponse> {
  const response = await fetch(`${MEDIA_API_BASE}/api/upload/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images,
      google_place_id: googlePlaceId || null,
      title: title || null,
      description: description || null,
      tags: tags || [],
      user_id: userId || null,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to upload images');
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

/**
 * Add a TikTok embed to the feed
 * @param tiktokUrl - The TikTok video URL
 * @param googlePlaceId - Optional restaurant association
 * @param userId - User ID for ownership
 */
export async function addTikTokEmbed(
  tiktokUrl: string,
  googlePlaceId?: string,
  userId?: string
): Promise<{ success: boolean; embed?: any }> {
  const response = await fetch(`${MEDIA_API_BASE}/api/tiktok`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tiktok_url: tiktokUrl,
      google_place_id: googlePlaceId || null,
      user_id: userId || null,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to add TikTok embed');
  }

  return response.json();
}

/**
 * Update user profile via backend API
 * Bypasses RLS for iOS compatibility
 */
export async function updateUserProfile(
  auth0Id: string,
  updates: { name?: string; bio?: string; avatar?: string }
): Promise<{ status: string; user: any }> {
  const response = await fetch(`${MEDIA_API_BASE}/api/users/${encodeURIComponent(auth0Id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update profile');
  }

  return response.json();
}
