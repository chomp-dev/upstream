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

// Track if preload is in progress (prevents race conditions with tab mounts)
let isPreloading = false;
let preloadComplete = false;

export const preloadService = {
    /**
     * Check if preload is currently running
     */
    isLoading: () => isPreloading,

    /**
     * Check if preload has completed
     */
    isComplete: () => preloadComplete,

    /**
     * Wait for any active preload to complete
     */
    waitForCompletion: async () => {
        while (isPreloading) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return preloadComplete;
    },

    /**
     * Main preload function - loads all data during splash
     * Calls onProgress with 0-100 and onStatus with text description
     */
    preload: async (
        onProgress: (progress: number) => void,
        onStatus?: (status: string) => void
    ): Promise<PreloadResult> => {
        if (isPreloading) {
            console.log('[Preload] Already in progress, waiting...');
            // Wait for existing preload to complete
            while (isPreloading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return {
                success: preloadComplete,
                feedLoaded: preloadComplete,
                mapLoaded: preloadComplete,
                fromCache: true,
                durationMs: 0,
            };
        }

        isPreloading = true;
        preloadComplete = false;
        const setStatus = onStatus || (() => { });
        const startTime = Date.now();
        let feedLoaded = false;
        let mapLoaded = false;

        console.log('[Preload] Starting parallel load...');
        setStatus('Initializing...');
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
            setStatus('Getting location permission...');
            onProgress(15);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('[Preload] Location denied - will use demo/cached data');
                setStatus('Location denied');
                isPreloading = false;
                preloadComplete = true;
                onProgress(100);
                return {
                    success: true,
                    feedLoaded: false,
                    mapLoaded: false,
                    fromCache: false,
                    durationMs: Date.now() - startTime,
                };
            }

            setStatus('Getting your location...');
            onProgress(20);

            // Optimization: Try to get last known position first (much faster)
            let location = await Location.getLastKnownPositionAsync({});

            // If no last known position or it's too old (>5 mins), get fresh
            if (!location || (Date.now() - location.timestamp) > 5 * 60 * 1000) {
                console.log('[Preload] Last known location missing or stale, getting fresh...');
                location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
            } else {
                console.log('[Preload] Using last known location (fast)');
            }

            const { latitude, longitude } = location.coords;
            console.log(`[Preload] Got location: ${latitude}, ${longitude}`);

            setStatus('Finding nearby restaurants...');
            onProgress(30);

            // Step 3: Fetch nearby restaurants (shared between feed and map)
            const nearbyResponse = await searchApi.searchNearby(
                latitude,
                longitude,
                NEARBY_RADIUS,
                60 // Optimized to 60 (matches feed max + small buffer) for speed
            );

            console.log(`[Preload] Found ${nearbyResponse.restaurants.length} nearby restaurants`);
            setStatus('Loading content...');
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

            setStatus('Ready!');
            onProgress(100);
            const duration = Date.now() - startTime;
            console.log(`[Preload] Complete in ${duration}ms`);

            isPreloading = false;
            preloadComplete = true;

            return {
                success: true,
                feedLoaded,
                mapLoaded,
                fromCache: false,
                durationMs: duration,
            };

        } catch (error) {
            console.error('[Preload] Error:', error);
            setStatus('Error loading data');
            isPreloading = false;
            preloadComplete = true;
            onProgress(100); // Still complete the splash
            return {
                success: false,
                feedLoaded: false,
                mapLoaded: false,
                fromCache: false,
                durationMs: Date.now() - startTime,
            };
        } finally {
            isPreloading = false;
        }
    },
};
