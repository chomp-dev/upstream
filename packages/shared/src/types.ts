/**
 * Shared types between Chomp services
 */

// ============================================================================
// Media Types
// ============================================================================

export interface Video {
  id: number;
  cloudflare_video_id: string;
  playback_url: string | null;
  thumbnail_url: string | null;
  status: 'pending' | 'queued' | 'inprogress' | 'processing' | 'ready' | 'error';
  duration: number | null;
  google_place_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImagePost {
  id: number;
  images: string[];
  google_place_id: string | null;
  created_at: string;
}

export interface FeedItem {
  id: number;
  type: 'video' | 'image_post';
  cloudflare_video_id?: string;
  playback_url?: string;
  thumbnail_url?: string;
  status?: string;
  images?: string[];
  google_place_id?: string | null;
  created_at: string;
}

// ============================================================================
// Restaurant Types
// ============================================================================

export interface Restaurant {
  id: string;
  google_place_id: string;
  name: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  primary_type: string | null;
  types: string[] | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: number | null;
  phone: string | null;
  website: string | null;
  last_fetched_at?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface FeedResponse {
  feed: FeedItem[];
  hasMore: boolean;
}

export interface NearbySearchResponse {
  restaurants: Restaurant[];
  count: number;
  cached: boolean;
  cache_key: string | null;
}

export interface MediaSummary {
  video_count: number;
  image_count: number;
  latest_thumbnail_url: string | null;
}

export interface MediaSummaryResponse {
  [placeId: string]: MediaSummary;
}

// ============================================================================
// Location Types
// ============================================================================

export interface Location {
  lat: number;
  lng: number;
}

export interface NearbySearchRequest {
  location: Location;
  radius?: number;
  max_results?: number;
  included_types?: string[];
}
