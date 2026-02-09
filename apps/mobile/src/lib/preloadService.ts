/**
 * Preload Service - Centralized data loading during splash screen
 * Loads feed and map data in parallel for instant navigation
 */

import { Platform } from 'react-native';
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

            console.log('[Preload] Cache check:', {
                hasCachedFeed: !!cachedFeed,
                feedLength: cachedFeed?.feed?.length || 0,
                hasCachedMap: !!cachedMap,
                mapLength: cachedMap?.restaurants?.length || 0,
                shouldRefetch: feedStore.shouldRefetch()
            });

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

            console.log('[Preload] Browser:', Platform.OS, 'Requesting location permission...');
            const { status } = await Location.requestForegroundPermissionsAsync();
            console.log('[Preload] Location permission status:', status);

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
                const locStart = Date.now();
                // Optimization: Add timeout to prevent hanging indefinitely
                try {
                    location = await Promise.race([
                        Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        }),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
                    ]) as Location.LocationObject;
                } catch (e) {
                    console.log('[Preload] Location fetch failed/timed out');
                    location = null;
                }
                console.log(`[Preload] Location fetch took ${Date.now() - locStart}ms`);
            } else {
                console.log('[Preload] Using last known location (fast)');
            }

            if (!location) {
                console.log('[Preload] Could not determine location');
                setStatus('Location unavailable');
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

            const { latitude, longitude } = location.coords;
            console.log(`[Preload] Got location: ${latitude}, ${longitude}`);

            setStatus('Finding nearby content...');
            onProgress(30);

            // Step 3: Fetch nearby restaurants for map AND feed in parallel
            const contentStart = Date.now();

            const [feedResult, searchResult] = await Promise.allSettled([
                // Load feed using new location-based API
                (async () => {
                    const feedStart = Date.now();
                    const response = await mediaApi.fetchNearbyFeedByLocation(
                        latitude,
                        longitude,
                        NEARBY_RADIUS,
                        50
                    );
                    console.log(`[Preload] Location feed took ${Date.now() - feedStart}ms. Found ${response.feed?.length || 0} items`);

                    // Validate feed items
                    const validFeed = (response.feed || []).filter((item: any) => {
                        if (item.type === 'video') {
                            // Allow processing videos, filter out error videos
                            return item.status !== 'error' && (item.playback_url || item.status !== 'ready');
                        }
                        return true;
                    });

                    return {
                        feed: validFeed,
                        placeIds: response.nearbyPlaceIds || [],
                        raw: response.feed?.length || 0
                    };
                })(),

                // Load nearby restaurants for map (still uses search API)
                (async () => {
                    const searchStart = Date.now();
                    const response = await searchApi.searchNearby(
                        latitude,
                        longitude,
                        NEARBY_RADIUS,
                        60
                    );
                    console.log(`[Preload] Nearby search took ${Date.now() - searchStart}ms. Found ${response.restaurants.length}`);
                    return response;
                })(),
            ]);

            setStatus('Loading content...');
            onProgress(50);

            // Process feed result
            let feedLoaded = false;
            let feedPlaceIds: string[] = [];
            if (feedResult.status === 'fulfilled') {
                const { feed, placeIds } = feedResult.value;
                feedPlaceIds = placeIds;
                await feedStore.setFeed(feed, placeIds, 'nearby');
                feedLoaded = true;
                console.log(`[Preload] Feed ready: ${feed.length} items from ${placeIds.length} restaurants`);
            }

            onProgress(70);

            // Process map result (get media summary for restaurants)
            let mapLoaded = false;
            let nearbyRestaurants: any[] = [];
            if (searchResult.status === 'fulfilled') {
                nearbyRestaurants = searchResult.value.restaurants;
                const allPlaceIds = nearbyRestaurants.map((r: any) => r.google_place_id);

                // Get media summary for map pins
                try {
                    const mapStart = Date.now();
                    const mediaSummary = await mediaApi.getMediaSummary(allPlaceIds);
                    console.log(`[Preload] Map summary took ${Date.now() - mapStart}ms`);

                    await mapStore.setRestaurants(
                        nearbyRestaurants,
                        mediaSummary,
                        latitude,
                        longitude,
                        2 // Default radius index (2 mi)
                    );
                    mapLoaded = true;
                    console.log(`[Preload] Map ready: ${nearbyRestaurants.length} restaurants`);
                } catch (e) {
                    console.warn('[Preload] Map media summary failed:', e);
                }
            }


            console.log(`[Preload] Content load took ${Date.now() - contentStart}ms total`);

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
