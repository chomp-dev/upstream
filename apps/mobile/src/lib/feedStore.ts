/**
 * Feed Store - In-memory cache for feed data
 * Prevents unnecessary refetches when navigating within the app
 */

import type { FeedItem } from './api/types';

interface FeedCache {
    feed: FeedItem[];
    nearbyPlaceIds: string[];
    lastFetchedAt: number;
    highestViewedIndex: number;
    feedMode: 'nearby' | 'demo';
}

let cache: FeedCache | null = null;

// Cache expires after 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

export const feedStore = {
    /**
     * Get cached feed if available and not expired
     */
    getFeed: (): FeedCache | null => {
        if (!cache) return null;

        // Check if cache is expired
        const now = Date.now();
        if (now - cache.lastFetchedAt > CACHE_TTL_MS) {
            console.log('[FeedStore] Cache expired');
            cache = null;
            return null;
        }

        return cache;
    },

    /**
     * Store feed data in cache
     */
    setFeed: (
        feed: FeedItem[],
        nearbyPlaceIds: string[],
        feedMode: 'nearby' | 'demo'
    ) => {
        cache = {
            feed,
            nearbyPlaceIds,
            lastFetchedAt: Date.now(),
            highestViewedIndex: 0,
            feedMode,
        };
        console.log(`[FeedStore] Cached ${feed.length} items`);
    },

    /**
     * Mark an index as viewed (for scroll tracking)
     */
    markViewed: (index: number) => {
        if (cache && index > cache.highestViewedIndex) {
            cache.highestViewedIndex = index;
        }
    },

    /**
     * Check if we should refetch (user has viewed all items)
     */
    shouldRefetch: (): boolean => {
        if (!cache) return true;

        // Check if expired
        const now = Date.now();
        if (now - cache.lastFetchedAt > CACHE_TTL_MS) {
            return true;
        }

        // Check if user has viewed all items
        const hasViewedAll = cache.highestViewedIndex >= cache.feed.length - 1;
        return hasViewedAll;
    },

    /**
     * Clear the cache (force refetch on next load)
     */
    clear: () => {
        cache = null;
        console.log('[FeedStore] Cache cleared');
    },

    /**
     * Get current scroll index for restoration
     */
    getLastViewedIndex: (): number => {
        return cache?.highestViewedIndex ?? 0;
    },
};
