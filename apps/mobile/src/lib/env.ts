/**
 * Environment configuration for Chomp app
 * Supports two backend services: media-api and search-api
 */

// Media API (Express/TS) - handles video uploads, feed, etc.
export const MEDIA_API_BASE = process.env.EXPO_PUBLIC_MEDIA_API_BASE || 'http://localhost:3000';

// Search API (FastAPI) - handles nearby restaurants, places
export const SEARCH_API_BASE = process.env.EXPO_PUBLIC_SEARCH_API_BASE || 'http://localhost:8000';

// Log config in dev
if (__DEV__) {
  console.log('[Env] Media API:', MEDIA_API_BASE);
  console.log('[Env] Search API:', SEARCH_API_BASE);
}
