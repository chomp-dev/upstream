/**
 * Home (Watch) Tab - TikTok-style vertical feed
 * Reuses existing VideoPlayer and ImagePostViewer components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Text, Badge } from '../../src/ui';
import { colors, spacing } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { VideoPlayer } from '../../components/VideoPlayer';
import { ImagePostViewer } from '../../components/ImagePostViewer';
import { mediaApi, searchApi } from '../../src/lib/api';
import type { FeedItem, Restaurant } from '../../src/lib/api/types';


import { useContentDimensions } from '../../src/hooks/useContentDimensions';

export default function HomeScreen() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [restaurantCache, setRestaurantCache] = useState<Record<string, Restaurant>>({});
  const flatListRef = useRef<FlatList>(null);
  const isFocused = useIsFocused(); // Pause video when tab loses focus
  const params = useLocalSearchParams<{ scrollToIndex?: string; itemId?: string }>();
  const lastScrolledRef = useRef<string | null>(null);
  const { width, height: SCREEN_HEIGHT } = useContentDimensions();

  useEffect(() => {
    loadFeed();
  }, []);

  // Handle navigation from Explore - scroll to specific item
  useEffect(() => {
    if (params.scrollToIndex && params.itemId && feed.length > 0) {
      const scrollKey = `${params.scrollToIndex}-${params.itemId}`;

      // Only scroll if this is a new navigation (not the same item)
      if (lastScrolledRef.current !== scrollKey) {
        const targetIndex = parseInt(params.scrollToIndex, 10);

        // First try to find by itemId in current feed
        const itemIndex = feed.findIndex(item => item.id.toString() === params.itemId);
        const finalIndex = itemIndex >= 0 ? itemIndex : targetIndex;

        if (finalIndex >= 0 && finalIndex < feed.length) {
          // Small delay to ensure list is ready
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
  }, [params.scrollToIndex, params.itemId, feed]);

  // Smart polling - faster when videos are processing
  useEffect(() => {
    const hasPendingVideos = feed.some(
      (item) => item.type === 'video' && item.status !== 'ready'
    );
    const interval = hasPendingVideos ? 2000 : 15000;

    const pollInterval = setInterval(() => {
      loadFeed(true);
    }, interval);

    return () => clearInterval(pollInterval);
  }, [feed]);

  const loadFeed = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const data = await mediaApi.fetchFeed();

      // Filter out error/deleted videos on client side as extra safety
      const validFeed = (data.feed || []).filter(item => {
        if (item.type === 'video') {
          return item.status !== 'error' && item.playback_url;
        }
        return true;
      });

      setFeed(validFeed);

      // Prefetch restaurant data for items with google_place_id
      const placeIds = validFeed
        .filter((item) => item.google_place_id)
        .map((item) => item.google_place_id!)
        .filter((id, idx, arr) => arr.indexOf(id) === idx); // Unique

      if (placeIds.length > 0) {
        fetchRestaurants(placeIds);
      }
    } catch (error: any) {
      console.error('[Feed] Error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRestaurants = useCallback(async (placeIds: string[]) => {
    // Fetch restaurants in parallel
    const promises = placeIds.map(async (placeId) => {
      const restaurant = await searchApi.getRestaurant(placeId);
      return { placeId, restaurant };
    });

    const results = await Promise.all(promises);

    setRestaurantCache((prevCache) => {
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

  if (loading) {
    return (
      <Screen safe={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" style={styles.loadingText}>
            Loading feed...
          </Text>
        </View>
      </Screen>
    );
  }

  if (feed.length === 0) {
    return (
      <Screen safe={false}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text variant="title" center style={{ marginBottom: spacing.sm }}>
            No posts yet
          </Text>
          <Text variant="bodySmall" center color={colors.muted}>
            Be the first to upload!
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen safe={false}>
      <FlatList
        ref={flatListRef}
        data={feed}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        refreshing={loading}
        onRefresh={() => loadFeed(false)}
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
              ) : (
                <ImagePostViewer images={item.images || []} />
              )}

              {/* Restaurant overlay */}
              {restaurant && (
                <TouchableOpacity style={styles.restaurantOverlay} activeOpacity={0.9}>
                  <View style={styles.restaurantInfo}>
                    <Text variant="subtitle" numberOfLines={1}>
                      {restaurant.name}
                    </Text>
                    <View style={styles.restaurantMeta}>
                      {restaurant.rating && (
                        <View style={styles.ratingRow}>
                          <Text style={[styles.star, { color: ratingColor(restaurant.rating) }]}>
                            ★
                          </Text>
                          <Text variant="bodySmall" color={ratingColor(restaurant.rating)}>
                            {restaurant.rating.toFixed(1)}
                          </Text>
                        </View>
                      )}
                      {restaurant.price_level !== null && (
                        <Badge
                          label={priceDisplay(restaurant.price_level)}
                          variant="price"
                        />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
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
          // Retry after a short delay if scroll fails
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
  itemContainer: {},
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
  restaurantOverlay: {
    position: 'absolute',
    bottom: 120,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.overlay,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
