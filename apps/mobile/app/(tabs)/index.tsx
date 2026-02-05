/**
 * Home (Watch) Tab - TikTok-style vertical feed
 * Supports location-based nearby feed and demo reels toggle
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Badge, Pill } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { VideoPlayer } from '../../components/VideoPlayer';
import { ImagePostViewer } from '../../components/ImagePostViewer';
import { TikTokEmbed } from '../../components/TikTokEmbed';
import { mediaApi, searchApi } from '../../src/lib/api';
import type { FeedItem, Restaurant } from '../../src/lib/api/types';

import { useContentDimensions } from '../../src/hooks/useContentDimensions';
import { feedStore } from '../../src/lib/feedStore';
import { navigationStore } from '../../src/lib/navigationStore';

// Feed mode types
type FeedMode = 'loading' | 'nearby' | 'demo';

// Default search radius for nearby restaurants (2 miles)
const NEARBY_RADIUS = 3200;

export default function HomeScreen() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [restaurantCache, setRestaurantCache] = useState<Record<string, Restaurant>>({});
  const flatListRef = useRef<FlatList>(null);
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ scrollToIndex?: string; itemId?: string; videoDataId?: string }>();
  const router = useRouter(); // Added router hook
  const lastScrolledRef = useRef<string | null>(null);
  const { width, height: SCREEN_HEIGHT } = useContentDimensions();

  // Loading state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');

  // Location-based feed state
  const [feedMode, setFeedMode] = useState<FeedMode>('loading');
  const [nearbyPlaceIds, setNearbyPlaceIds] = useState<string[]>([]);
  const [locationAvailable, setLocationAvailable] = useState<boolean>(false);
  const [nearbyRestaurantCount, setNearbyRestaurantCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ============================================================================
  // Handle videoDataId param (for navigating from profile/explore to specific post)
  // ============================================================================
  useEffect(() => {
    if (!params.videoDataId) return;

    const passedItem = navigationStore.get(params.videoDataId);
    if (!passedItem) return;

    if (__DEV__) console.log('[Feed] Received pending item:', {
      id: passedItem.id,
      title: passedItem.title,
      username: passedItem.username,
      avatar: passedItem.user_avatar,
      placeId: passedItem.google_place_id
    });

    // Clear from store immediately to prevent re-processing
    navigationStore.clear(params.videoDataId);

    if (feed.length === 0) {
      // Feed not loaded yet - set this as the initial feed item
      setFeed([passedItem]);
      setFeedMode('nearby'); // Assume nearby mode
      setLoading(false); // Stop loading since we have content
    } else {
      // Feed already loaded - check if item exists
      const existingIndex = feed.findIndex(item =>
        item.id === passedItem.id ||
        (item.video_url && item.video_url === passedItem.video_url)
      );

      if (existingIndex === -1) {
        // Prepend the item to feed
        setFeed(prev => [passedItem, ...prev]);
      } else if (existingIndex > 0) {
        // Move to front if not already there
        setFeed(prev => {
          const newFeed = [...prev];
          const [item] = newFeed.splice(existingIndex, 1);
          return [item, ...newFeed];
        });
      }
    }


    // Fetch restaurant data for this item if needed
    if (passedItem && passedItem.google_place_id) {
      // Optimistic check: do we have it in search store or cache?
      if (!restaurantCache[passedItem.google_place_id]) {
        searchApi.getRestaurant(passedItem.google_place_id).then(restaurant => {
          if (restaurant) {
            setRestaurantCache(prev => ({
              ...prev,
              [passedItem.google_place_id!]: restaurant
            }));
          }
        }).catch(err => console.error('[Feed] Failed to fetch linked restaurant:', err));
      }
    }

    // Scroll to top immediately
    // We use a small timeout to ensure FlatList has rendered the new data
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 50);

  }, [params.videoDataId, feed.length]);
  // ============================================================================
  // Location & Nearby Feed Logic
  // ============================================================================

  const loadNearbyFeed = useCallback(async (forceRefresh = false) => {
    // If we are deep linking to a pending video, skip loading nearby feed
    if (params.videoDataId) {
      if (__DEV__) console.log('[Feed] Skipping nearby load due to videoDataId param');
      return;
    }

    // Check cache first (unless force refresh)
    // Preload service should have already populated this during splash
    if (!forceRefresh) {
      // OPTIMIZATION: Check cache FIRST before waiting for any background process
      // This prevents the splash screen/preload from blocking the UI if we already have data on disk
      const cached = await feedStore.getFeed();

      // If we have cached data, use it IMMEDIATELY
      if (cached && cached.feed.length > 0) {
        if (__DEV__) console.log('[Feed] Using preloaded/cached feed:', cached.feed.length, 'items');
        setFeed(cached.feed);
        setNearbyPlaceIds(cached.nearbyPlaceIds);
        setFeedMode(cached.feedMode);
        setLoading(false);

        // Hydrate map logic (from previous fix)
        let mapHydrationSuccess = false;
        try {
          const { mapStore } = require('../../src/lib/mapStore');
          const mapData = await mapStore.getRestaurants();

          if (mapData && mapData.restaurants) {
            const newCache: Record<string, Restaurant> = {};
            mapData.restaurants.forEach((r: Restaurant) => {
              if (r.google_place_id) {
                newCache[r.google_place_id] = r;
              }
            });
            setRestaurantCache(prev => ({ ...prev, ...newCache }));

            // Use cached location for instant distance calculation
            if (mapData.lastLocation) {
              setUserLocation(mapData.lastLocation);
            }

            // UNCONDITIONAL LOG for debugging production issues
            console.log('[Feed] Hydrated restaurant cache from mapStore:', Object.keys(newCache).length, 'items');
            mapHydrationSuccess = true;
          } else {
            console.log('[Feed] mapStore cache miss/expired - will background fetch');
          }
        } catch (err) {
          console.error('[Feed] Failed to hydrate mapStore:', err);
        }

        // Only skip network load if we have both feed AND restaurant data
        if (mapHydrationSuccess) {
          return;
        }
        console.log('[Feed] Partial cache hit (Feed only) - proceeding to network fetch to repair missing info');
      }

      // If NO cache (or partial cache), we then wait for the preload to finish or do a fresh fetch
      const { preloadService } = require('../../src/lib/preloadService');
      if (preloadService.isLoading()) {
        if (__DEV__) console.log('[Feed] Waiting for background preload to complete...');
        // Only wait if we didn't already render cached data
        await preloadService.waitForCompletion();

        if (preloadService.isComplete()) {
          // Check cache AGAIN after preload finishes (in case it just populated)
          const freshCache = await feedStore.getFeed();
          if (freshCache && freshCache.feed.length > 0) {
            if (__DEV__) console.log('[Feed] Preload finished, using fresh cache:', freshCache.feed.length, 'items');
            setFeed(freshCache.feed);
            setNearbyPlaceIds(freshCache.nearbyPlaceIds);
            setFeedMode(freshCache.feedMode);
            setLoading(false);

            // Hydrate map for this new cache
            try {
              const { mapStore } = require('../../src/lib/mapStore');
              const mapData = await mapStore.getRestaurants();
              if (mapData && mapData.restaurants) {
                const newCache: Record<string, Restaurant> = {};
                mapData.restaurants.forEach((r: Restaurant) => {
                  if (r.google_place_id) newCache[r.google_place_id] = r;
                });
                setRestaurantCache(prev => ({ ...prev, ...newCache }));
                console.log('[Feed] Hydrated fresh map data after preload');
                return;
              }
            } catch (e) { console.error(e); }
          }
        }
      }

    }

    try {
      setLoading(true);
      setLoadingProgress(10);
      setLoadingStatus('Checking permissions...');

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (__DEV__) console.log('[Feed] Location permission denied, falling back to demo');
        setLocationAvailable(false);
        await loadDemoFeed();
        return;
      }

      // Get current location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationAvailable(true);

      if (__DEV__) console.log(`[Feed] Got location: ${loc.coords.latitude}, ${loc.coords.longitude}`);

      setLoadingProgress(30);
      setLoadingStatus('Finding nearby restaurants...');

      // Search for nearby restaurants
      const nearbyResponse = await searchApi.searchNearby(
        loc.coords.latitude,
        loc.coords.longitude,
        NEARBY_RADIUS,
        100 // Limit search to 100 max
      );

      let placeIds = nearbyResponse.restaurants.map(r => r.google_place_id);

      // Limit to top 50 closest to avoid massive wait times/timeouts
      if (placeIds.length > 50) {
        if (__DEV__) console.log(`[Feed] Limiting processing to top 50 of ${placeIds.length} restaurants`);
        placeIds = placeIds.slice(0, 50);
      }

      setNearbyPlaceIds(placeIds);
      setNearbyRestaurantCount(nearbyResponse.restaurants.length);

      // OPTIMIZATION: Seed restaurant cache immediately with the data we just got
      // This prevents the "missing info" delay by avoiding redundant fetches
      const newCache: Record<string, Restaurant> = {};
      nearbyResponse.restaurants.forEach(r => {
        if (r.google_place_id) {
          newCache[r.google_place_id] = r;
        }
      });
      setRestaurantCache(prev => ({ ...prev, ...newCache }));

      if (__DEV__) console.log(`[Feed] Found ${nearbyResponse.restaurants.length} nearby restaurants, checking ${placeIds.length}`);

      if (placeIds.length === 0) {
        if (__DEV__) console.log('[Feed] No nearby restaurants, staying in nearby mode with empty state');
        setFeed([]);
        setFeedMode('nearby');
        setLoading(false);
        return;
      }

      setLoadingProgress(60);
      setLoadingStatus(`Found ${placeIds.length} spots. Getting videos...`);

      // Chunk place IDs to show real progress
      const CHUNK_SIZE = 5;
      const chunks = [];
      for (let i = 0; i < placeIds.length; i += CHUNK_SIZE) {
        chunks.push(placeIds.slice(i, i + CHUNK_SIZE));
      }

      let allFeedItems: any[] = [];
      let processedCount = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          // Update status
          const percentComplete = 60 + Math.floor((i / chunks.length) * 30); // 60% -> 90%
          setLoadingProgress(percentComplete);
          setLoadingStatus(`Checking ${chunk.length} spots (${i + 1}/${chunks.length})...`);

          const response = await mediaApi.fetchNearbyFeed(chunk, 10); // Limit 10 per chunk
          if (response.feed && response.feed.length > 0) {
            allFeedItems = [...allFeedItems, ...response.feed];
          }
        } catch (err) {
          console.warn(`[Feed] Failed to fetch chunk ${i}:`, err);
        }
      }

      // Validating and deduplicating
      const validFeed = allFeedItems.filter(item => {
        if (item.type === 'video') {
          return item.status !== 'error' && item.playback_url;
        }
        return true;
      });

      // Simple deduplication by ID
      const uniqueFeed = validFeed.filter((item, index, self) =>
        index === self.findIndex((t) => (
          t.id === item.id && t.type === item.type
        ))
      );

      if (__DEV__) console.log(`[Feed] Nearby feed has ${uniqueFeed.length} items (from ${validFeed.length} raw)`);

      if (uniqueFeed.length === 0) {
        if (__DEV__) console.log('[Feed] No local content, staying in nearby mode with empty state');
        setFeed([]);
        setFeedMode('nearby');
        setLoading(false);
        return;
      }

      setLoadingProgress(100);
      setLoadingStatus('Preparing your feed...');

      // Give it a moment to show 100%
      await new Promise(r => setTimeout(r, 500));

      setFeed(uniqueFeed);
      setFeedMode('nearby');

      // Cache the feed for instant loading next time
      await feedStore.setFeed(uniqueFeed, placeIds, 'nearby');

      // Prefetch restaurant data
      const feedPlaceIds = uniqueFeed
        .filter(item => item.google_place_id)
        .map(item => item.google_place_id!)
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      if (feedPlaceIds.length > 0) {
        fetchRestaurants(feedPlaceIds);
      }
    } catch (error: any) {
      console.error('[Feed] Location/nearby error:', error.message);
      // On error, stay in nearby mode but show empty - user can choose to switch
      setFeed([]);
      setFeedMode('nearby');
    } finally {
      setLoading(false);
    }
  }, [params.videoDataId, feed.length]);

  const loadDemoFeed = useCallback(async () => {
    try {
      if (feedMode !== 'demo') {
        setLoading(true);
      }

      const data = await mediaApi.fetchFeed();

      // Filter out error/deleted videos
      const validFeed = (data.feed || []).filter(item => {
        if (item.type === 'video') {
          return item.status !== 'error' && item.playback_url;
        }
        return true;
      });

      setFeed(validFeed);
      setFeedMode('demo');

      // Prefetch restaurant data
      const placeIds = validFeed
        .filter(item => item.google_place_id)
        .map(item => item.google_place_id!)
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      if (placeIds.length > 0) {
        fetchRestaurants(placeIds);
      }
    } catch (error: any) {
      console.error('[Feed] Demo feed error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [feedMode]);

  const switchToNearby = useCallback(async () => {
    if (!locationAvailable || nearbyPlaceIds.length === 0) {
      // Try loading nearby again
      await loadNearbyFeed();
    } else {
      // We already have place IDs, just fetch the feed
      setLoading(true);
      try {
        const nearbyFeedResponse = await mediaApi.fetchNearbyFeed(nearbyPlaceIds);
        const validFeed = (nearbyFeedResponse.feed || []).filter(item => {
          if (item.type === 'video') {
            return item.status !== 'error' && item.playback_url;
          }
          return true;
        });

        if (validFeed.length > 0) {
          setFeed(validFeed);
          setFeedMode('nearby');
        } else {
          // Still no content, show message
          setFeedMode('nearby');
          setFeed([]);
        }
      } catch (error) {
        console.error('[Feed] Switch to nearby error:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [locationAvailable, nearbyPlaceIds, loadNearbyFeed]);

  const switchToDemo = useCallback(async () => {
    await loadDemoFeed();
  }, [loadDemoFeed]);

  // Initial load - only trigger if preload didn't provide data
  useEffect(() => {
    const init = async () => {
      // Check if preloadService already completed successfully
      const { preloadService } = require('../../src/lib/preloadService');

      // If preload is running, wait for it (don't start parallel load)
      if (preloadService.isLoading()) {
        if (__DEV__) console.log('[Feed] Waiting for preload to complete...');
        await preloadService.waitForCompletion();
      }

      // Check cache first - preload should have set this
      const cached = await feedStore.getFeed();
      if (cached && cached.feed.length > 0) {
        if (__DEV__) console.log('[Feed] Using preloaded/cached feed:', cached.feed.length, 'items');
        setFeed(cached.feed);
        setNearbyPlaceIds(cached.nearbyPlaceIds);
        setFeedMode(cached.feedMode);
        setLoading(false);
        return;
      }

      // Only load fresh if no cached data
      if (__DEV__) console.log('[Feed] No cached data, loading fresh...');
      loadNearbyFeed();
    };

    init();
  }, []); // Empty deps - only run on mount

  // Handle navigation from Explore - scroll to specific item AND inject if needed
  useEffect(() => {
    if (params.scrollToIndex && params.itemId) {
      const scrollKey = `${params.scrollToIndex}-${params.itemId}`;

      // Inject video if provided (allows playing out-of-area videos from Explore)
      // We retrieve the full item data from our memory store
      if (params.videoDataId && loading === false) {
        try {
          // @ts-ignore
          const navigationStore = require('../../src/lib/navigationStore').navigationStore;
          const injectedItem = navigationStore.get(params.videoDataId) as FeedItem;

          if (injectedItem) {
            // Check if already exists to avoid duplicates
            const exists = feed.find(i => i.id === injectedItem.id);

            if (!exists) {
              console.log('[Feed] Injecting out-of-area video from Explore:', injectedItem.id);
              // Prepend or insert at specific index? Prepending is safest for "just show me this"
              setFeed(prev => [injectedItem, ...prev]);

              // Reset scroll target to 0 since we put it at top
              // We need to wait for state update to reflect in FlatList
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: 0, animated: false });
                setCurrentIndex(0);
              }, 200);
              return;
            }
          }
        } catch (e) {
          console.error('[Feed] Failed to inject video data:', e);
        }
      }

      // Scroll to specific item if requested
      if (params.scrollToIndex && params.itemId && feed.length > 0 && lastScrolledRef.current !== scrollKey) {
        // const targetIndex = parseInt(params.scrollToIndex, 10);
        const itemIndex = feed.findIndex(item => item.id.toString() === params.itemId);

        // FIX: Do NOT fall back to targetIndex (from Explore grid) if item not found.
        const finalIndex = itemIndex;

        if (finalIndex >= 0 && finalIndex < feed.length) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: finalIndex,
              animated: false,
            });
            setCurrentIndex(finalIndex);
          }, 100);
          lastScrolledRef.current = scrollKey;
        } else if (params.videoDataId) {
          // If not found in feed but we have explicit video data, let the logic above handle injection
          if (__DEV__) console.log('[Feed] Deep link item not in current feed, relying on injection logic');
        }
      }
    }
  }, [params.scrollToIndex, params.itemId, params.videoDataId, feed, loading]);

  // Smart polling
  useEffect(() => {
    const hasPendingVideos = feed.some(
      item => item.type === 'video' && item.status !== 'ready'
    );
    const interval = hasPendingVideos ? 2000 : 15000;

    const pollInterval = setInterval(() => {
      if (feedMode === 'nearby' && nearbyPlaceIds.length > 0) {
        loadNearbyFeed();
      } else if (feedMode === 'demo') {
        loadDemoFeed();
      }
    }, interval);

    return () => clearInterval(pollInterval);
  }, [feed, feedMode, nearbyPlaceIds, loadNearbyFeed, loadDemoFeed]);

  const fetchRestaurants = useCallback(async (placeIds: string[]) => {
    const promises = placeIds.map(async (placeId) => {
      const restaurant = await searchApi.getRestaurant(placeId);
      return { placeId, restaurant };
    });

    const results = await Promise.all(promises);

    setRestaurantCache(prevCache => {
      const newCache = { ...prevCache };
      for (const { placeId, restaurant } of results) {
        if (restaurant && !newCache[placeId]) {
          newCache[placeId] = restaurant;
        }
      }
      return newCache;
    });
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index || 0;
      setCurrentIndex(index);
      // Track viewed items for cache refetch logic
      feedStore.markViewed(index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // ============================================================================
  // Render States
  // ============================================================================

  if (loading && feed.length === 0) {
    return (
      <Screen safe={false}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <Text variant="title" style={styles.loadingTitle}>
              Finding nearby content...
            </Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${loadingProgress}%` }]} />
            </View>

            <Text variant="bodySmall" color={colors.muted} style={styles.loadingText}>
              {loadingStatus}
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  // Empty state - show toggle to demo
  if (feed.length === 0) {
    return (
      <Screen safe={false}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyIcon}>
            {feedMode === 'nearby' ? '📍' : '🎬'}
          </Text>
          <Text variant="title" center style={{ marginBottom: spacing.sm }}>
            {feedMode === 'nearby' ? 'No local content yet' : 'No posts yet'}
          </Text>
          <Text variant="bodySmall" center color={colors.muted} style={{ marginBottom: spacing.lg }}>
            {feedMode === 'nearby'
              ? `Found ${nearbyRestaurantCount} restaurants nearby, but no videos yet`
              : 'Be the first to upload!'}
          </Text>

          {feedMode === 'nearby' ? (
            <TouchableOpacity style={styles.switchButton} onPress={switchToDemo}>
              <Text variant="body" color={colors.bg}>🎬 Watch Demo Reels</Text>
            </TouchableOpacity>
          ) : locationAvailable && nearbyPlaceIds.length > 0 ? (
            <TouchableOpacity style={styles.switchButton} onPress={switchToNearby}>
              <Text variant="body" color={colors.bg}>📍 Try Nearby Feed</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen safe={false}>


      <FlatList
        ref={flatListRef}
        extraData={restaurantCache} // FORCE UPDATE when cache changes
        data={feed}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        refreshing={loading}
        onRefresh={() => feedMode === 'nearby' ? loadNearbyFeed(true) : loadDemoFeed()}
        pagingEnabled={true} // Native: Handles strict paging
        bounces={Platform.OS !== 'web'} // Web: Disable bounce to prevent overscroll issues
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 200);
        }}
        // Web: Force strict CSS snapping via style injection
        {...(Platform.OS === 'web' ? {
          style: { height: '100%', scrollSnapType: 'y mandatory', overflowY: 'scroll' } as any
        } : {})}
        renderItem={({ item, index }) => {
          // DEBUG: Check why cache lookup fails
          if (__DEV__ && item.google_place_id && !restaurantCache[item.google_place_id]) {
            // console.log('[FeedDebug] Missing restaurant for:', item.google_place_id, 'Cache keys:', Object.keys(restaurantCache).length);
          }

          const restaurant = item.google_place_id
            ? restaurantCache[item.google_place_id]
            : null;

          return (
            <View style={[
              { width, height: SCREEN_HEIGHT },
              // Web: STRICT snapping on children (scrollSnapStop: always = strictly lock to this item)
              // @ts-ignore
              Platform.OS === 'web' ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' } : {}
            ]}>
              {item.type === 'video' ? (
                <>
                  <VideoPlayer
                    videoId={item.cloudflare_video_id}
                    playbackUrl={item.playback_url}
                    thumbnailUrl={item.thumbnail_url}
                    isActive={isFocused && index === currentIndex && item.status === 'ready'}
                    restaurant={restaurant}
                    user={{
                      userId: item.user_id,
                      username: item.username || 'User',
                      avatarUrl: item.user_avatar || undefined
                    }}
                    videoUrl={item.video_url}
                    caption={item.title || item.description}
                    userLocation={userLocation}
                  />
                  {item.status !== 'ready' && (
                    <View style={styles.processingOverlay}>
                      {item.status === 'error' ? (
                        <>
                          <Text style={styles.errorIcon}>⚠️</Text>
                          <Text variant="body" style={styles.processingText}>
                            Video unavailable
                          </Text>
                          <Text variant="bodySmall" style={[styles.processingText, { marginTop: spacing.xs }]}>
                            This video may have been deleted
                          </Text>
                        </>
                      ) : (
                        <>
                          <ActivityIndicator size="large" color={colors.primary} />
                          <Text variant="body" style={styles.processingText}>
                            {item.status === 'inprogress' || item.status === 'processing'
                              ? 'Almost ready...'
                              : 'Processing video...'}
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </>
              ) : item.type === 'tiktok_embed' ? (
                <TikTokEmbed
                  embedHtml={item.embed_html || ''}
                  thumbnailUrl={item.thumbnail_url}
                  title={item.title}
                  authorName={item.author_name}
                  tiktokUrl={item.tiktok_url}
                  isActive={isFocused && index === currentIndex}
                />
              ) : (
                <ImagePostViewer
                  images={item.images || []}
                  restaurant={restaurant}
                  user={{
                    userId: item.user_id,
                    username: item.username || 'User',
                    avatarUrl: item.user_avatar || undefined
                  }}
                  caption={item.title || item.description || ''}
                  imagePostId={item.id}
                />
              )}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  loadingContent: {
    width: '70%',
    alignItems: 'center',
  },
  loadingTitle: {
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  loadingText: {
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    marginTop: spacing.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  profileButton: {
    position: 'absolute',
    top: 50, // Safe area aware
    right: spacing.lg,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  toggleButton: {
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  restaurantInfo: {
    gap: spacing.xs,
  },
  restaurantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  star: {
    fontSize: 14,
  },
});
