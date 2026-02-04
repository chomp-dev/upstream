/**
 * Map Tab - Nearby restaurants on map with List toggle
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  TextInput,
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
import { useAuth } from '../../src/context/auth';
import { mapStore } from '../../src/lib/mapStore';

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
  const { user, login } = useAuth();

  if (!user) {
    return (
      <Screen>
        <View style={styles.authContainer}>
          <Ionicons name="map-outline" size={64} color={colors.primary} />
          <Text variant="title" center style={{ marginTop: spacing.lg }}>
            Sign in to View Map
          </Text>
          <Text variant="body" color={colors.muted} center style={{ marginVertical: spacing.md }}>
            Explore food spots near you by signing in.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => login()}>
            <Text variant="subtitle" color={colors.bg}>Sign In / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

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



  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Client-side filtering of loaded restaurants
  const filteredRestaurants = useMemo(() => {
    if (!searchQuery.trim()) return restaurants;
    const q = searchQuery.toLowerCase();
    return restaurants.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.formatted_address?.toLowerCase().includes(q) ||
      r.primary_type?.toLowerCase().includes(q)
    );
  }, [restaurants, searchQuery]);

  const currentRadius = RADIUS_OPTIONS[radiusIndex].value;

  // NOTE: loadLocation and loadRestaurants are defined first, 
  // then performSearch is defined below them to avoid temporal dead zone

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

      // Check local cache first (unless force refresh)
      // Preload service should have already populated this during splash
      if (!isRefresh && !skipCache) {
        const cached = await mapStore.getRestaurants();
        if (cached && cached.restaurants.length > 0) {
          if (__DEV__) console.log('[Map] Using preloaded/cached restaurants:', cached.restaurants.length, 'items');
          setRestaurants(cached.restaurants);
          setMediaSummary(cached.mediaSummary);
          setCached(true);
          setLoading(false);
          return;
        }
      }

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

        if (__DEV__) console.log(`[Map] Loading restaurants: radius=${radius}m, skipCache=${skipCache}`);

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

        if (__DEV__) console.log(`[Map] Got ${response.restaurants.length} restaurants, cached=${response.cached}`);

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

          // Cache the results locally and persist
          await mapStore.setRestaurants(
            response.restaurants,
            summary,
            loc.coords.latitude,
            loc.coords.longitude,
            radiusIndex
          );
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

  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length <= 2) {
      if (query.trim().length === 0 && location) {
        // Reset to nearby if cleared
        loadRestaurants(location, currentRadius);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsSearching(true);

      const loc = location || await loadLocation();
      const lat = loc?.coords.latitude;
      const lng = loc?.coords.longitude;

      const response = await searchApi.searchRestaurants(query, lat, lng, currentRadius);

      setRestaurants(response.restaurants);
      setCached(response.cached);
      setFetchMeta(null); // Clear meta since this is a custom search

      // Fetch media summary
      const placeIds = response.restaurants.map((r) => r.google_place_id);
      if (placeIds.length > 0) {
        const summary = await mediaApi.getMediaSummary(placeIds);
        setMediaSummary(summary);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [location, loadLocation, loadRestaurants, currentRadius]);

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
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => handleOpenMaps(item)}
        activeOpacity={0.7}
      >
        <View style={styles.listItemContent}>
          <View style={styles.listItemHeader}>
            <Text variant="subtitle" numberOfLines={1} style={styles.listItemName}>
              {item.name || 'Unknown Restaurant'}
            </Text>
            {item.rating !== null && (
              <View style={styles.ratingBadge}>
                <Text style={styles.starText}>★</Text>
                <Text variant="caption" style={styles.ratingText}>
                  {item.rating.toFixed(1)}
                </Text>
                {item.user_rating_count !== null && (
                  <Text variant="caption" color={colors.muted} style={{ marginLeft: 2 }}>
                    ({item.user_rating_count})
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.listItemRow}>
            {item.price_level !== null && (
              <Text variant="caption" color={colors.text} style={{ marginRight: spacing.sm }}>
                {priceDisplay(item.price_level)}
              </Text>
            )}
            {item.primary_type && (
              <Text variant="caption" color={colors.muted} numberOfLines={1} style={{ flex: 1 }}>
                {item.primary_type.replace(/_/g, ' ')}
              </Text>
            )}
          </View>

          {item.formatted_address && (
            <Text variant="caption" color={colors.muted} numberOfLines={1} style={styles.listAddress}>
              {item.formatted_address}
            </Text>
          )}

          <View style={styles.listItemFooter}>
            {totalPosts > 0 && (
              <View style={styles.postCountBadge}>
                <Ionicons name="play-circle-outline" size={14} color={colors.primary} />
                <Text variant="caption" color={colors.primary} style={{ marginLeft: 4 }}>
                  {totalPosts} {totalPosts === 1 ? 'post' : 'posts'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Text variant="caption" color={colors.blue} style={styles.directionsText}>
              Directions
              <Ionicons name="chevron-forward" size={12} color={colors.blue} />
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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
          {cached && !isSearching && <Badge label="⚡ Cached" variant="cached" />}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search places..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => performSearch(searchQuery)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              performSearch('');
            }}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <Text variant="caption" color={colors.muted} style={styles.headerCount}>
          {filteredRestaurants.length} restaurants found{searchQuery.trim() ? ` (filtering "${searchQuery}")` : ''}
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
            restaurants={filteredRestaurants}
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
          data={filteredRestaurants}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 0,
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
  listItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listItemContent: {
    gap: 4,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  listItemName: {
    flex: 1,
    marginRight: spacing.sm,
    fontSize: 16,
    fontWeight: '600',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.overlay,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  starText: {
    fontSize: 12,
    color: '#FFD700',
    marginRight: 2,
  },
  ratingText: {
    fontWeight: '600',
    color: colors.text,
  },
  listAddress: {
    marginBottom: spacing.xs,
  },
  listItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  postCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  directionsText: {
    fontWeight: '500',
    flexDirection: 'row',
    alignItems: 'center',
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
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
});
