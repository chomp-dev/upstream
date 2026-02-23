/**
 * Environment configuration for Chomp app
 * Supports two backend services: media-api and search-api
 */

const mediaApiFromEnv = process.env.EXPO_PUBLIC_MEDIA_API_BASE;
const searchApiFromEnv = process.env.EXPO_PUBLIC_SEARCH_API_BASE;

// Safer defaults for device testing:
// - Use deployed APIs when env vars are missing (localhost is unreachable from iPhone).
const mediaApiDefault = 'https://media-api-vq8j.onrender.com';
const searchApiDefault = 'https://search-api-cbp7.onrender.com';

// Media API (Express/TS) - handles video uploads, feed, etc.
export const MEDIA_API_BASE = mediaApiFromEnv || mediaApiDefault;

// Search API (FastAPI) - handles nearby restaurants, places
export const SEARCH_API_BASE = searchApiFromEnv || searchApiDefault;

// Log config in dev
if (__DEV__) {
  console.log('[Env] Media API:', MEDIA_API_BASE);
  console.log('[Env] Search API:', SEARCH_API_BASE);
  if (MEDIA_API_BASE.includes('localhost') || SEARCH_API_BASE.includes('localhost')) {
    console.warn('[Env] localhost URLs will not work on physical iOS devices. Use your LAN IP or tunnel URL.');
  }
  if (MEDIA_API_BASE.includes('onrender.com') || SEARCH_API_BASE.includes('onrender.com')) {
    console.warn('[Env] Using deployed APIs in dev. If you expect local backend logs, set EXPO_PUBLIC_*_API_BASE to your LAN/tunnel URLs before building the dev client.');
  }
}
