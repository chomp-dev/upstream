/**
 * Map Tab - Nearby restaurants on map with List toggle
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  TouchableOpacity,
  Dimensions,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { Screen, Text, Card, Segmented, Badge, Pill } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { searchApi, mediaApi } from '../../src/lib/api';
import type { Restaurant, MediaSummaryResponse } from '../../src/lib/api/types';
import MapImpl from '../../components/Map';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Radius options in meters
const RADIUS_OPTIONS = [
  { label: '0.5 mi', value: 800 },
  { label: '1 mi', value: 1600 },
  { label: '2 mi', value: 3200 },
  { label: '5 mi', value: 8000 },
];

type ViewMode = 'map' | 'list';

export default function MapScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [mediaSummary, setMediaSummary] = useState<MediaSummaryResponse>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radiusIndex, setRadiusIndex] = useState(2);
  const [cached, setCached] = useState(false);
  const [fetchMeta, setFetchMeta] = useState<{
    requestsMade?: number | null;
    maxRequests?: number | null;
    uniquePlaces?: number | null;
    rawPlaces?: number | null;
    truncated?: boolean | null;
  } | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [estimatedCount, setEstimatedCount] = useState(0);

  const currentRadius = RADIUS_OPTIONS[radiusIndex].value;

  const loadLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enable in settings.');
        setLoading(false);
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
      return loc;
    } catch (err) {
      setError('Could not get your location. Please try again.');
      setLoading(false);
      return null;
    }
  }, []);

  const loadRestaurants = useCallback(
    async (loc: Location.LocationObject | null, radius: number, isRefresh = false, skipCache = false) => {
      if (!loc) return;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
          setLoadingProgress(0);
          setEstimatedCount(0);
        }
        setError(null);
        setFetchMeta(null);

        console.log(`[Map] Loading restaurants: radius=${radius}m, skipCache=${skipCache}`);

        // Simulate progress animation (15 API calls, ~200ms each)
        const progressInterval = setInterval(() => {
          setLoadingProgress((prev) => {
            if (prev >= 90) return prev; // Cap at 90% until real data arrives
            return prev + 10;
          });
          setEstimatedCount((prev) => {
            const next = prev + Math.floor(Math.random() * 15) + 10;
            return next > 300 ? 300 : next; // Cap at maxResults (300)
          });
        }, 200);

        const response = await searchApi.searchNearby(
          loc.coords.latitude,
          loc.coords.longitude,
          radius,
          300, // maxResults updated to 300
          skipCache
        );

        clearInterval(progressInterval);
        setLoadingProgress(100);

        console.log(`[Map] Got ${response.restaurants.length} restaurants, cached=${response.cached}`);

        setRestaurants(response.restaurants);
        setCached(response.cached);
        setFetchMeta({
          requestsMade: response.requests_made ?? null,
          maxRequests: response.max_requests ?? null,
          uniquePlaces: response.unique_places ?? null,
          rawPlaces: response.raw_places ?? null,
          truncated: response.truncated ?? null,
        });

        // Fetch media summary for all restaurants
        const placeIds = response.restaurants.map((r) => r.google_place_id);
        if (placeIds.length > 0) {
          const summary = await mediaApi.getMediaSummary(placeIds);
          setMediaSummary(summary);
        }
      } catch (err) {
        setError('Could not load restaurants. Check your connection.');
        console.error('API Error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingProgress(0);
        setEstimatedCount(0);
      }
    },
    []
  );

  // Initial load - runs once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const loc = await loadLocation();
      if (loc && mounted) {
        await loadRestaurants(loc, currentRadius);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Handle radius changes after initial load
  useEffect(() => {
    if (location) {
      loadRestaurants(location, currentRadius);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRadius]); // Only re-run when radius changes

  const handleRefresh = useCallback(async () => {
    const loc = await loadLocation();
    if (loc) {
      // Skip cache on manual refresh to get fresh results
      await loadRestaurants(loc, currentRadius, true, true);
    }
  }, [loadLocation, loadRestaurants, currentRadius]);

  const handleOpenMaps = useCallback((restaurant: Restaurant) => {
    if (restaurant.lat && restaurant.lng) {
      const url = Platform.select({
        ios: `maps:0,0?q=${restaurant.lat},${restaurant.lng}`,
        android: `geo:0,0?q=${restaurant.lat},${restaurant.lng}(${restaurant.name})`,
        default: `https://maps.google.com/?q=${restaurant.lat},${restaurant.lng}`,
      });
      if (url) Linking.openURL(url);
    }
  }, []);

  const renderRestaurantCard = ({ item }: { item: Restaurant }) => {
    const media = mediaSummary[item.google_place_id];
    const totalPosts = media ? media.video_count + media.image_count : 0;

    return (
      <Card
        style={styles.card}
        showAccent
        accentColor={ratingColor(item.rating)}
        onPress={() => handleOpenMaps(item)}
      >
        <View style={styles.cardHeader}>
          <Text variant="subtitle" numberOfLines={1} style={styles.cardName}>
            {item.name || 'Unknown Restaurant'}
          </Text>
          {item.price_level !== null && (
            <Badge label={priceDisplay(item.price_level)} variant="price" />
          )}
        </View>

        {item.rating !== null && (
          <View style={styles.ratingRow}>
            <Text style={[styles.star, { color: ratingColor(item.rating) }]}>★</Text>
            <Text variant="body" color={ratingColor(item.rating)}>
              {item.rating.toFixed(1)}
            </Text>
            {item.user_rating_count !== null && (
              <Text variant="bodySmall" color={colors.muted}>
                ({item.user_rating_count.toLocaleString()})
              </Text>
            )}
          </View>
        )}

        {item.primary_type && (
          <View style={styles.typeTag}>
            <Text variant="caption" color={colors.muted}>
              {item.primary_type.replace(/_/g, ' ')}
            </Text>
          </View>
        )}

        {item.formatted_address && (
          <Text variant="bodySmall" numberOfLines={2} style={styles.address}>
            {item.formatted_address}
          </Text>
        )}

        <View style={styles.cardFooter}>
          {totalPosts > 0 && (
            <Badge label={`${totalPosts} ${totalPosts === 1 ? 'post' : 'posts'}`} variant="default" />
          )}
          <Text variant="caption" color={colors.blue}>
            🗺️ Directions
          </Text>
        </View>
      </Card>
    );
  };

  // Error state
  if (error && !loading && restaurants.length === 0) {
    return (
      <Screen edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text variant="body" color={colors.coral} center>
            {error}
          </Text>
          <Pill label="Try Again" onPress={handleRefresh} style={styles.retryButton} />
        </View>
      </Screen>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Screen edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" style={styles.loadingText}>
            Finding restaurants near you...
          </Text>

          {/* Real-time progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${loadingProgress}%` }]} />
            </View>
            <Text variant="caption" color={colors.muted} style={{ marginTop: spacing.xs }}>
              {loadingProgress}% • ~{estimatedCount} places found so far...
            </Text>
          </View>

          <Text variant="caption" color={colors.muted} style={{ marginTop: spacing.sm }}>
            {currentRadius >= 1000 ? `${currentRadius / 1000}km` : `${currentRadius}m`} radius • Up to 15 API calls
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text variant="title">Nearby</Text>
          {cached && <Badge label="⚡ Cached" variant="cached" />}
        </View>

        <Text variant="caption" color={colors.muted} style={styles.headerCount}>
          {restaurants.length} restaurants found
        </Text>
        {fetchMeta?.requestsMade != null && (
          <View style={styles.fetchMetaContainer}>
            <Text variant="caption" style={styles.fetchMetaText}>
              🔄 Made {fetchMeta.requestsMade}/{fetchMeta.maxRequests} API calls
            </Text>
            <Text variant="caption" style={styles.fetchMetaText}>
              📍 Found {fetchMeta.uniquePlaces ?? restaurants.length} unique places
              {fetchMeta.rawPlaces != null ? ` from ${fetchMeta.rawPlaces} total` : ''}
            </Text>
            {fetchMeta.truncated && (
              <Text variant="caption" style={[styles.fetchMetaText, { color: colors.coral }]}>
                ⚠️ Results capped at {restaurants.length} (more available in this area)
              </Text>
            )}
          </View>
        )}

        {/* View mode toggle */}
        <Segmented
          options={[
            { key: 'map', label: '🗺️ Map' },
            { key: 'list', label: '📋 List' },
          ]}
          selected={viewMode}
          onSelect={(key) => setViewMode(key as ViewMode)}
          style={styles.viewToggle}
        />

        {/* Radius options */}
        <View style={styles.radiusContainer}>
          {RADIUS_OPTIONS.map((option, index) => (
            <Pill
              key={option.value}
              label={option.label}
              active={radiusIndex === index}
              onPress={() => setRadiusIndex(index)}
              size="sm"
            />
          ))}
        </View>
      </View>

      {/* Content */}
      {viewMode === 'map' ? (
        location ? (
          <MapImpl
            restaurants={restaurants}
            location={location}
            currentRadius={currentRadius}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        )
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          renderItem={renderRestaurantCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text variant="subtitle" center>
                No restaurants found
              </Text>
              <Text variant="bodySmall" color={colors.muted} center>
                Try increasing the search radius
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCount: {
    marginTop: spacing.xs,
  },
  fetchMetaContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.xxs,
  },
  fetchMetaText: {
    fontSize: 12,
    color: colors.muted,
  },
  viewToggle: {
    marginTop: spacing.md,
  },
  radiusContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardName: {
    flex: 1,
    marginRight: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  star: {
    fontSize: 14,
  },
  typeTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  address: {
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  progressContainer: {
    width: '80%',
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  retryButton: {
    marginTop: spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
});
