/**
 * Feed Store - In-memory cache for feed data
 * Prevents unnecessary refetches when navigating within the app
 */

import type { FeedItem } from './api/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FeedCache {
    feed: FeedItem[];
    nearbyPlaceIds: string[];
    lastFetchedAt: number;
    highestViewedIndex: number;
    feedMode: 'nearby' | 'demo';
}


// Cache keys
const FEED_CACHE_KEY = 'chomp_feed_cache';

// Cache expires after 30 minutes (increased from 5 for better persistence)
const CACHE_TTL_MS = 30 * 60 * 1000;

let memoryCache: FeedCache | null = null;

export const feedStore = {
    /**
     * Hydrate cache from disk on startup
     */
    hydrate: async (): Promise<void> => {
        try {
            console.log('[FeedStore] Starting hydration from AsyncStorage...');
            const data = await AsyncStorage.getItem(FEED_CACHE_KEY);
            if (data) {
                memoryCache = JSON.parse(data);
                console.log('[FeedStore] Hydrated from disk:', memoryCache?.feed?.length || 0, 'items');
            } else {
                console.log('[FeedStore] No cached data found');
            }
        } catch (error) {
            console.error('[FeedStore] Failed to hydrate:', error);
            // Don't throw - just continue with empty cache
            memoryCache = null;
        }
    },

    /**
     * Get cached feed if available and not expired
     */
    getFeed: async (): Promise<FeedCache | null> => {
        // If no memory cache, try looking on disk if we haven't already
        if (!memoryCache) {
            await feedStore.hydrate();
        }

        if (!memoryCache) return null;

        // Check if cache is expired
        const now = Date.now();
        if (now - memoryCache.lastFetchedAt > CACHE_TTL_MS) {
            console.log('[FeedStore] Cache expired');
            await feedStore.clear();
            return null;
        }

        return memoryCache;
    },

    /**
     * Store feed data in cache
     */
    setFeed: async (
        feed: FeedItem[],
        nearbyPlaceIds: string[],
        feedMode: 'nearby' | 'demo'
    ) => {
        const newCache: FeedCache = {
            feed,
            nearbyPlaceIds,
            lastFetchedAt: Date.now(),
            highestViewedIndex: 0,
            feedMode,
        };

        memoryCache = newCache;

        // Persist to disk
        try {
            await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(newCache));
            console.log(`[FeedStore] Cached & Persisted ${feed.length} items`);
        } catch (error) {
            console.error('[FeedStore] Failed to persist:', error);
        }
    },

    /**
     * Mark an index as viewed (for scroll tracking)
     * We don't persist this on every scroll to avoid perf hit,
     * but we update the memory cache.
     */
    markViewed: (index: number) => {
        if (memoryCache && index > memoryCache.highestViewedIndex) {
            memoryCache.highestViewedIndex = index;
            // Only persist on multiples of 5 or end to save writes
            if (index % 5 === 0) {
                AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(memoryCache)).catch(e =>
                    console.error('[FeedStore] Failed to update scroll index:', e)
                );
            }
        }
    },

    /**
     * Check if we should refetch (user has viewed all items)
     */
    shouldRefetch: (): boolean => {
        if (!memoryCache) return true;

        // Check if expired
        const now = Date.now();
        if (now - memoryCache.lastFetchedAt > CACHE_TTL_MS) {
            return true;
        }

        // For small feeds (<=3 items), don't auto-refetch based on view position
        // This prevents the cache from constantly invalidating with limited content
        if (memoryCache.feed.length <= 3) {
            return false;
        }

        // Check if user has viewed all items (within 3 items of end)
        const hasViewedAll = memoryCache.highestViewedIndex >= memoryCache.feed.length - 3;
        return hasViewedAll;
    },

    /**
     * Clear the cache (force refetch on next load)
     */
    clear: async () => {
        memoryCache = null;
        try {
            await AsyncStorage.removeItem(FEED_CACHE_KEY);
            console.log('[FeedStore] Cache cleared');
        } catch (error) {
            console.error('[FeedStore] Failed to clear cache:', error);
        }
    },

    /**
     * Get current scroll index for restoration
     */
    getLastViewedIndex: (): number => {
        return memoryCache?.highestViewedIndex ?? 0;
    },
};
