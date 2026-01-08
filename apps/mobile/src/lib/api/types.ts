/**
 * Shared API types for Chomp app
 */

// ============================================================================
// Media API Types (from biteMVP)
// ============================================================================

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

export interface FeedResponse {
  feed: FeedItem[];
  hasMore: boolean;
}

export interface UploadVideoResponse {
  uploadUrl: string;
  videoId: string;
  dbRecord: {
    id: number;
    cloudflare_video_id: string;
    status: string;
    created_at: string;
  };
}

export interface UploadImagesResponse {
  post: {
    id: number;
    images: string[];
    created_at: string;
  };
}

export interface MediaSummaryResponse {
  [placeId: string]: {
    video_count: number;
    image_count: number;
    latest_thumbnail_url?: string;
  };
}

// ============================================================================
// Search API Types (from searchMVP)
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

export interface NearbySearchResponse {
  restaurants: Restaurant[];
  count: number;
  cached: boolean;
  cache_key: string | null;
  // optional diagnostics (from backend)
  requests_made?: number | null;
  max_requests?: number | null;
  raw_places?: number | null;
  unique_places?: number | null;
  truncated?: boolean | null;
}

export interface LocationInput {
  lat: number;
  lng: number;
}

export interface NearbySearchRequest {
  location: LocationInput;
  radius?: number;
  max_results?: number;
  included_types?: string[];
}
