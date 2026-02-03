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

  // Location-based feed state
  const [feedMode, setFeedMode] = useState<FeedMode>('loading');
  const [nearbyPlaceIds, setNearbyPlaceIds] = useState<string[]>([]);
  const [locationAvailable, setLocationAvailable] = useState<boolean>(false);
  const [nearbyRestaurantCount, setNearbyRestaurantCount] = useState(0);

  // ============================================================================
  // Location & Nearby Feed Logic
  // ============================================================================

  const loadNearbyFeed = useCallback(async () => {
    try {
      setLoading(true);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[Feed] Location permission denied, falling back to demo');
        setLocationAvailable(false);
        await loadDemoFeed();
        return;
      }

      // Get current location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationAvailable(true);

      console.log(`[Feed] Got location: ${loc.coords.latitude}, ${loc.coords.longitude}`);

      // Search for nearby restaurants
      const nearbyResponse = await searchApi.searchNearby(
        loc.coords.latitude,
        loc.coords.longitude,
        NEARBY_RADIUS,
        200
      );

      const placeIds = nearbyResponse.restaurants.map(r => r.google_place_id);
      setNearbyPlaceIds(placeIds);
      setNearbyRestaurantCount(nearbyResponse.restaurants.length);

      console.log(`[Feed] Found ${placeIds.length} nearby restaurants`);

      if (placeIds.length === 0) {
        console.log('[Feed] No nearby restaurants, staying in nearby mode with empty state');
        setFeed([]);
        setFeedMode('nearby');
        setLoading(false);
        return;
      }

      // Fetch nearby feed
      const nearbyFeedResponse = await mediaApi.fetchNearbyFeed(placeIds);

      // Filter out invalid videos
      const validFeed = (nearbyFeedResponse.feed || []).filter(item => {
        if (item.type === 'video') {
          return item.status !== 'error' && item.playback_url;
        }
        return true;
      });

      console.log(`[Feed] Nearby feed has ${validFeed.length} items`);

      if (validFeed.length === 0) {
        console.log('[Feed] No local content, staying in nearby mode with empty state');
        setFeed([]);
        setFeedMode('nearby');
        setLoading(false);
        return;
      }

      setFeed(validFeed);
      setFeedMode('nearby');

      // Prefetch restaurant data
      const feedPlaceIds = validFeed
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
  }, []);

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

  // Initial load
  useEffect(() => {
    loadNearbyFeed();
  }, [loadNearbyFeed]);

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

      if (feed.length > 0 && lastScrolledRef.current !== scrollKey) {
        const targetIndex = parseInt(params.scrollToIndex, 10);
        const itemIndex = feed.findIndex(item => item.id.toString() === params.itemId);
        const finalIndex = itemIndex >= 0 ? itemIndex : targetIndex;

        if (finalIndex >= 0 && finalIndex < feed.length) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: finalIndex,
              animated: false,
            });
            setCurrentIndex(finalIndex);
          }, 100);

          lastScrolledRef.current = scrollKey;
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
      setCurrentIndex(viewableItems[0].index || 0);
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
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" style={styles.loadingText}>
            {feedMode === 'loading' ? 'Finding nearby content...' : 'Loading feed...'}
          </Text>
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
      {/* Profile Button (Top Right) */}
      <TouchableOpacity
        style={styles.profileButton}
        onPress={() => router.push('/social')}
        activeOpacity={0.8}
      >
        <Ionicons name="person-circle-outline" size={40} color="white" />
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={feed}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        refreshing={loading}
        onRefresh={() => feedMode === 'nearby' ? loadNearbyFeed() : loadDemoFeed()}
        renderItem={({ item, index }) => {
          const restaurant = item.google_place_id
            ? restaurantCache[item.google_place_id]
            : null;

          return (
            <View style={{ width, height: SCREEN_HEIGHT }}>
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
                />
              )}
            </View>
          );
        }}
        pagingEnabled
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
  loadingText: {
    marginTop: spacing.md,
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
