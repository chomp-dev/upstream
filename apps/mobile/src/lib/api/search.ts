/**
 * Search API client
 * Communicates with the FastAPI backend (search-api)
 */

import { SEARCH_API_BASE } from '../env';
import type {
  Restaurant,
  NearbySearchResponse,
  NearbySearchRequest,
} from './types';

// All food & drink establishment types in Google Places API
export const FOOD_DRINK_TYPES = [
  'restaurant',
  'cafe',
  'coffee_shop',
  'fast_food_restaurant',
  'ice_cream_shop',
  'bakery',
  'bar',
  'sandwich_shop',
  'pizza_restaurant',
  'meal_takeaway',
  'meal_delivery',
  'juice_shop',
  'breakfast_restaurant',
  'brunch_restaurant',
  'hamburger_restaurant',
  'steak_house',
  'seafood_restaurant',
  'sushi_restaurant',
  'mexican_restaurant',
  'italian_restaurant',
  'american_restaurant',
  'chinese_restaurant',
  'japanese_restaurant',
  'indian_restaurant',
  'thai_restaurant',
  'vietnamese_restaurant',
  'korean_restaurant',
  'mediterranean_restaurant',
  'greek_restaurant',
  'french_restaurant',
  'spanish_restaurant',
  'middle_eastern_restaurant',
  'barbecue_restaurant',
  'ramen_restaurant',
  'vegan_restaurant',
  'vegetarian_restaurant',
];

/**
 * Search for nearby restaurants
 * NOTE: We don't send included_types so the backend uses its optimized
 * multiple-request type groups to get more comprehensive results (up to 60)
 */
export async function searchNearby(
  lat: number,
  lng: number,
  radius: number = 1500,
  maxResults: number = 200,
  skipCache: boolean = false
): Promise<NearbySearchResponse> {
  // If skipCache, add timestamp to bust any client-side caching
  const url = skipCache 
    ? `${SEARCH_API_BASE}/api/v1/nearby?_t=${Date.now()}`
    : `${SEARCH_API_BASE}/api/v1/nearby`;
    
  // Don't send included_types - let backend use its DEFAULT_TYPE_GROUPS
  // which makes multiple API requests to get more results
  const request: NearbySearchRequest = {
    location: { lat, lng },
    radius,
    max_results: maxResults,
    // included_types omitted intentionally - backend will use multiple type groups
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      // Tell server to skip cache if requested
      ...(skipCache ? { 'X-Skip-Cache': 'true' } : {}),
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Nearby search failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Clear all cached search results
 */
export async function clearSearchCache(): Promise<boolean> {
  try {
    const response = await fetch(`${SEARCH_API_BASE}/api/v1/admin/clear-all-cache`, {
      method: 'POST',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get a single restaurant by place ID
 */
export async function getRestaurant(placeId: string): Promise<Restaurant | null> {
  try {
    const response = await fetch(`${SEARCH_API_BASE}/api/v1/restaurants/${placeId}`);
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Restaurant fetch failed: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.warn('Failed to fetch restaurant:', error);
    return null;
  }
}

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SEARCH_API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
