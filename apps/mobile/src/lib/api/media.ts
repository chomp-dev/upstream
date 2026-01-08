/**
 * Media API client
 * Communicates with the Express/TS backend (media-api)
 */

import { MEDIA_API_BASE } from '../env';
import type {
  FeedResponse,
  UploadVideoResponse,
  UploadImagesResponse,
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
 * Upload images for an image post
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
  
  const response = await fetch(`${MEDIA_API_BASE}/api/restaurants/media-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ place_ids: placeIds }),
  });
  
  if (!response.ok) {
    console.warn('Media summary fetch failed:', response.status);
    return {};
  }
  
  return response.json();
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
