/**
 * Preload Service - Centralized data loading during splash screen
 * Loads feed and map data in parallel for instant navigation
 */

import * as Location from 'expo-location';
import { feedStore } from './feedStore';
import { mapStore } from './mapStore';
import { searchApi, mediaApi } from './api';

// Radius for nearby search (2 miles)
const NEARBY_RADIUS = 3200;

export interface PreloadState {
    status: 'idle' | 'loading' | 'complete' | 'error';
    progress: number; // 0-100
    feedReady: boolean;
    mapReady: boolean;
    error?: string;
}

interface PreloadResult {
    success: boolean;
    feedLoaded: boolean;
    mapLoaded: boolean;
    fromCache: boolean;
    durationMs: number;
}

export const preloadService = {
    /**
     * Main preload function - loads all data during splash
     * Calls onProgress with 0-100 as loading progresses
     */
    preload: async (
        onProgress: (progress: number) => void
    ): Promise<PreloadResult> => {
        const startTime = Date.now();
        let feedLoaded = false;
        let mapLoaded = false;
        let fromCache = false;

        console.log('[Preload] Starting parallel load...');
        onProgress(5);

        try {
            // Step 1: Hydrate caches from disk (fast)
            await Promise.all([
                feedStore.hydrate(),
                mapStore.hydrate(),
            ]);
            onProgress(10);

            // Check if we have valid cached data
            const cachedFeed = await feedStore.getFeed();
            const cachedMap = await mapStore.getRestaurants();

            if (cachedFeed && cachedMap && !feedStore.shouldRefetch()) {
                console.log('[Preload] Using cached data - feed:', cachedFeed.feed.length, 'items, map:', cachedMap.restaurants.length, 'restaurants');
                onProgress(100);
                return {
                    success: true,
                    feedLoaded: true,
                    mapLoaded: true,
                    fromCache: true,
                    durationMs: Date.now() - startTime,
                };
            }

            // Step 2: Get location permission and coords
            onProgress(15);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('[Preload] Location denied - will use demo/cached data');
                onProgress(100);
                return {
                    success: true,
                    feedLoaded: false,
                    mapLoaded: false,
                    fromCache: false,
                    durationMs: Date.now() - startTime,
                };
            }

            onProgress(20);
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const { latitude, longitude } = location.coords;
            console.log(`[Preload] Got location: ${latitude}, ${longitude}`);

            onProgress(30);

            // Step 3: Fetch nearby restaurants (shared between feed and map)
            const nearbyResponse = await searchApi.searchNearby(
                latitude,
                longitude,
                NEARBY_RADIUS,
                200 // Get enough for both feed and map
            );

            console.log(`[Preload] Found ${nearbyResponse.restaurants.length} nearby restaurants`);
            onProgress(50);

            // Step 4: Load feed and map data in parallel
            const placeIds = nearbyResponse.restaurants.map(r => r.google_place_id);
            const limitedPlaceIds = placeIds.slice(0, 50); // Limit for feed

            const [feedResult, mapResult] = await Promise.allSettled([
                // Load feed
                (async () => {
                    if (limitedPlaceIds.length === 0) return { feed: [], raw: 0 };

                    // Fetch all chunks in parallel for speed
                    const CHUNK_SIZE = 10;
                    const chunks = [];
                    for (let i = 0; i < limitedPlaceIds.length; i += CHUNK_SIZE) {
                        chunks.push(limitedPlaceIds.slice(i, i + CHUNK_SIZE));
                    }

                    // Load all chunks in parallel
                    const chunkResults = await Promise.allSettled(
                        chunks.map(chunk => mediaApi.fetchNearbyFeed(chunk, 10))
                    );

                    let allFeedItems: any[] = [];
                    for (const result of chunkResults) {
                        if (result.status === 'fulfilled' && result.value.feed?.length > 0) {
                            allFeedItems = [...allFeedItems, ...result.value.feed];
                        }
                    }

                    // Validate and deduplicate
                    const validFeed = allFeedItems.filter(item => {
                        if (item.type === 'video') {
                            return item.status !== 'error' && item.playback_url;
                        }
                        return true;
                    });

                    const seenIds = new Set<string>();
                    const uniqueFeed = validFeed.filter(item => {
                        const id = item.id?.toString() || item.cloudflare_video_id || JSON.stringify(item);
                        if (seenIds.has(id)) return false;
                        seenIds.add(id);
                        return true;
                    });

                    return { feed: uniqueFeed, raw: allFeedItems.length };
                })(),

                // Load map media summary
                (async () => {
                    if (placeIds.length === 0) return {};
                    return await mediaApi.getMediaSummary(placeIds);
                })(),
            ]);

            onProgress(85);

            // Process feed result
            if (feedResult.status === 'fulfilled') {
                const { feed } = feedResult.value;
                await feedStore.setFeed(feed, limitedPlaceIds, 'nearby');
                feedLoaded = true;
                console.log(`[Preload] Feed ready: ${feed.length} items`);
            }

            // Process map result
            if (mapResult.status === 'fulfilled') {
                const mediaSummary = mapResult.value;
                await mapStore.setRestaurants(
                    nearbyResponse.restaurants,
                    mediaSummary,
                    latitude,
                    longitude,
                    2 // Default radius index (2 mi)
                );
                mapLoaded = true;
                console.log(`[Preload] Map ready: ${nearbyResponse.restaurants.length} restaurants`);
            }

            onProgress(100);
            const duration = Date.now() - startTime;
            console.log(`[Preload] Complete in ${duration}ms`);

            return {
                success: true,
                feedLoaded,
                mapLoaded,
                fromCache: false,
                durationMs: duration,
            };

        } catch (error) {
            console.error('[Preload] Error:', error);
            onProgress(100); // Still complete the splash
            return {
                success: false,
                feedLoaded: false,
                mapLoaded: false,
                fromCache: false,
                durationMs: Date.now() - startTime,
            };
        }
    },
};
