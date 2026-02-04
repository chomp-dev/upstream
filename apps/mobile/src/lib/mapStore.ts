/**
 * Map Store - In-memory cache for restaurant/map data
 * Prevents unnecessary refetches when navigating within the app
 */

import type { Restaurant, MediaSummaryResponse } from './api/types';

interface MapCache {
    restaurants: Restaurant[];
    mediaSummary: MediaSummaryResponse;
    lastLocation: { lat: number; lng: number };
    lastRadiusIndex: number;
    lastFetchedAt: number;
}
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MapCache {
    restaurants: Restaurant[];
    mediaSummary: MediaSummaryResponse;
    lastLocation: { lat: number; lng: number };
    lastRadiusIndex: number;
    lastFetchedAt: number;
}

// Cache keys
const MAP_CACHE_KEY = 'chomp_map_cache';

// Cache expires after 60 minutes (increased for better persistence)
const CACHE_TTL_MS = 60 * 60 * 1000;

// Location deviation threshold in meters (~500m)
const LOCATION_THRESHOLD_M = 500;

let memoryCache: MapCache | null = null;

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
function getDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const mapStore = {
    /**
     * Hydrate cache from disk on startup
     */
    hydrate: async (): Promise<void> => {
        try {
            const data = await AsyncStorage.getItem(MAP_CACHE_KEY);
            if (data) {
                memoryCache = JSON.parse(data);
                console.log('[MapStore] Hydrated from disk:', memoryCache?.restaurants.length, 'restaurants');
            }
        } catch (error) {
            console.error('[MapStore] Failed to hydrate:', error);
        }
    },

    /**
     * Get cached restaurant data if available and not expired
     */
    getRestaurants: async (): Promise<MapCache | null> => {
        // If no memory cache, try looking on disk if we haven't already
        if (!memoryCache) {
            await mapStore.hydrate();
        }

        if (!memoryCache) return null;

        // Check if cache is expired
        const now = Date.now();
        if (now - memoryCache.lastFetchedAt > CACHE_TTL_MS) {
            console.log('[MapStore] Cache expired');
            await mapStore.clear();
            return null;
        }

        return memoryCache;
    },

    /**
     * Store restaurant data in cache
     */
    setRestaurants: async (
        restaurants: Restaurant[],
        mediaSummary: MediaSummaryResponse,
        lat: number,
        lng: number,
        radiusIndex: number
    ) => {
        const newCache: MapCache = {
            restaurants,
            mediaSummary,
            lastLocation: { lat, lng },
            lastRadiusIndex: radiusIndex,
            lastFetchedAt: Date.now(),
        };

        memoryCache = newCache;

        // Persist to disk
        try {
            await AsyncStorage.setItem(MAP_CACHE_KEY, JSON.stringify(newCache));
            console.log(`[MapStore] Cached & Persisted ${restaurants.length} restaurants`);
        } catch (error) {
            console.error('[MapStore] Failed to persist:', error);
        }
    },

    /**
     * Check if location has changed significantly
     */
    hasLocationChanged: (newLat: number, newLng: number, newRadiusIndex: number): boolean => {
        if (!memoryCache) return true;

        // Check if radius changed
        if (memoryCache.lastRadiusIndex !== newRadiusIndex) {
            console.log('[MapStore] Radius changed, need refetch');
            return true;
        }

        // Check if expired
        const now = Date.now();
        if (now - memoryCache.lastFetchedAt > CACHE_TTL_MS) {
            console.log('[MapStore] Cache expired');
            return true;
        }

        // Check location deviation
        const distance = getDistanceMeters(
            memoryCache.lastLocation.lat,
            memoryCache.lastLocation.lng,
            newLat,
            newLng
        );

        if (distance > LOCATION_THRESHOLD_M) {
            console.log(`[MapStore] Location changed by ${Math.round(distance)}m, need refetch`);
            return true;
        }

        return false;
    },

    /**
     * Clear the cache (force refetch on next load)
     */
    clear: async () => {
        memoryCache = null;
        try {
            await AsyncStorage.removeItem(MAP_CACHE_KEY);
            console.log('[MapStore] Cache cleared');
        } catch (error) {
            console.error('[MapStore] Failed to clear cache:', error);
        }
    },
};
