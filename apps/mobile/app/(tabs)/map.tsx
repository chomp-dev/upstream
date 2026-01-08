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
  Pressable,
  Dimensions,
  Text as RNText,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
// react-native-maps is included in Expo SDK - works in Expo Go with Apple Maps on iOS
import MapView, { Marker, Circle } from 'react-native-maps';

// Icon mapping based on restaurant type
const getMarkerIcon = (primaryType: string | null | undefined): string => {
  if (!primaryType) return '•';
  
  const type = primaryType.toLowerCase();
  
  if (type.includes('coffee') || type.includes('cafe')) return '☕';
  if (type.includes('ice_cream')) return '🍦';
  if (type.includes('bakery')) return '🥐';
  if (type.includes('pizza')) return '🍕';
  if (type.includes('burger') || type.includes('hamburger')) return '🍔';
  if (type.includes('sushi') || type.includes('japanese')) return '🍣';
  if (type.includes('chinese')) return '🥡';
  if (type.includes('mexican') || type.includes('taco')) return '🌮';
  if (type.includes('italian') || type.includes('pasta')) return '🍝';
  if (type.includes('indian')) return '🍛';
  if (type.includes('thai') || type.includes('vietnamese') || type.includes('asian')) return '🍜';
  if (type.includes('bar')) return '🍺';
  if (type.includes('sandwich') || type.includes('deli')) return '🥪';
  if (type.includes('breakfast') || type.includes('brunch')) return '🍳';
  if (type.includes('steak') || type.includes('bbq') || type.includes('barbecue')) return '🥩';
  if (type.includes('seafood') || type.includes('fish')) return '🐟';
  if (type.includes('chicken') || type.includes('wings')) return '🍗';
  if (type.includes('fast_food')) return '🍟';
  if (type.includes('juice') || type.includes('smoothie')) return '🧃';
  if (type.includes('dessert') || type.includes('sweet')) return '🍰';
  
  // Default restaurant icon
  return '🍽';
};
import * as Location from 'expo-location';
import { Screen, Text, Card, Segmented, Badge, Pill } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { searchApi, mediaApi } from '../../src/lib/api';
import type { Restaurant, MediaSummaryResponse } from '../../src/lib/api/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated marker component for smooth interactions
const AnimatedMarkerContent = ({ 
  icon, 
  isSelected, 
  onPress 
}: { 
  icon: string; 
  isSelected: boolean; 
  onPress: () => void;
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };
  
  const handlePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress();
  };
  
  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View 
        style={[
          styles.markerWrapper,
          { transform: [{ scale }] }
        ]}
      >
        <View style={[
          styles.markerBubble,
          isSelected && styles.markerBubbleSelected
        ]}>
          <RNText style={styles.markerEmoji}>{icon}</RNText>
        </View>
      </Animated.View>
    </Pressable>
  );
};

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
  const mapRef = useRef<MapView>(null);

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
        }
        setError(null);
        setFetchMeta(null);

        console.log(`[Map] Loading restaurants: radius=${radius}m, skipCache=${skipCache}`);
        
        const response = await searchApi.searchNearby(
          loc.coords.latitude,
          loc.coords.longitude,
          radius,
          200,
          skipCache
        );

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
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      const loc = await loadLocation();
      if (loc) {
        await loadRestaurants(loc, currentRadius);
      }
    })();
  }, [loadLocation, loadRestaurants, currentRadius]);

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
          <Text variant="caption" color={colors.muted} style={{ marginTop: spacing.sm }}>
            Fetching up to 10 Google calls (up to ~200 places)
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
          <Text variant="caption" color={colors.muted} style={styles.headerCount}>
            Retrieved {fetchMeta.uniquePlaces ?? restaurants.length}
            {fetchMeta.rawPlaces != null ? ` (${fetchMeta.rawPlaces} raw)` : ''}
            {fetchMeta.maxRequests != null
              ? ` — ${fetchMeta.requestsMade}/${fetchMeta.maxRequests} calls`
              : ''}
            {fetchMeta.truncated ? ' — capped' : ''}
          </Text>
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
      {viewMode === 'map' && Platform.OS === 'web' ? (
        <View style={styles.centered}>
          <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
          <Text variant="body" center>
            Map view available on iOS/Android only
          </Text>
          <Text variant="bodySmall" color={colors.muted} center>
            Switch to List view to see restaurants
          </Text>
        </View>
      ) : viewMode === 'map' && location ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: currentRadius / 50000,
              longitudeDelta: currentRadius / 50000,
            }}
            showsUserLocation
            showsMyLocationButton
            customMapStyle={darkMapStyle}
            // Disable Apple Maps native clustering
            clusteringEnabled={false}
            onPress={() => setSelectedRestaurant(null)}
          >
            {/* Radius circle visualization */}
            <Circle
              center={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              radius={currentRadius}
              strokeColor={colors.primary}
              strokeWidth={2}
              fillColor="rgba(232, 93, 76, 0.1)"
            />

            {restaurants
              .filter((r) => r.lat != null && r.lng != null && !isNaN(r.lat) && !isNaN(r.lng))
              .map((restaurant) => {
                const isSelected = selectedRestaurant?.id === restaurant.id;
                const icon = getMarkerIcon(restaurant.primary_type);
                
                return (
                  <Marker
                    key={restaurant.id}
                    identifier={restaurant.id}
                    coordinate={{
                      latitude: restaurant.lat,
                      longitude: restaurant.lng,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={isSelected}
                  >
                    <AnimatedMarkerContent
                      icon={icon}
                      isSelected={isSelected}
                      onPress={() => setSelectedRestaurant(restaurant)}
                    />
                  </Marker>
                );
              })}
          </MapView>

          {/* Refresh button */}
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <RNText style={styles.refreshIcon}>↻</RNText>
            )}
          </TouchableOpacity>

          {/* Bottom card for selected restaurant */}
          {selectedRestaurant && (
            <View style={styles.selectedCard}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setSelectedRestaurant(null)}
              >
                <RNText style={styles.closeButtonText}>✕</RNText>
              </TouchableOpacity>
              
              {/* Header with icon and name */}
              <View style={styles.selectedCardHeader}>
                <View style={styles.selectedCardIcon}>
                  <RNText style={styles.selectedCardEmoji}>
                    {getMarkerIcon(selectedRestaurant.primary_type)}
                  </RNText>
                </View>
                <View style={styles.selectedCardTitleArea}>
                  <Text variant="subtitle" numberOfLines={1}>
                    {selectedRestaurant.name}
                  </Text>
                  {selectedRestaurant.primary_type && (
                    <Text variant="caption" color={colors.muted}>
                      {selectedRestaurant.primary_type.replace(/_/g, ' ')}
                    </Text>
                  )}
                </View>
              </View>

              {/* Rating and meta row */}
              <View style={styles.selectedCardMeta}>
                {selectedRestaurant.rating && (
                  <View style={styles.ratingPill}>
                    <RNText style={styles.ratingPillStar}>★</RNText>
                    <RNText style={[styles.ratingPillText, { color: ratingColor(selectedRestaurant.rating) }]}>
                      {selectedRestaurant.rating.toFixed(1)}
                    </RNText>
                    {selectedRestaurant.user_rating_count && (
                      <RNText style={styles.ratingPillCount}>
                        ({selectedRestaurant.user_rating_count.toLocaleString()})
                      </RNText>
                    )}
                  </View>
                )}
                {selectedRestaurant.price_level !== null && (
                  <Badge label={priceDisplay(selectedRestaurant.price_level)} variant="price" />
                )}
                {mediaSummary[selectedRestaurant.google_place_id] && (
                  <Badge 
                    label={`${mediaSummary[selectedRestaurant.google_place_id].video_count + mediaSummary[selectedRestaurant.google_place_id].image_count} posts`} 
                    variant="default" 
                  />
                )}
              </View>

              {/* Address */}
              {selectedRestaurant.formatted_address && (
                <Text variant="bodySmall" numberOfLines={2} color={colors.muted} style={styles.selectedCardAddress}>
                  {selectedRestaurant.formatted_address}
                </Text>
              )}

              {/* Action buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenMaps(selectedRestaurant)}
                >
                  <RNText style={styles.actionButtonIcon}>🗺️</RNText>
                  <RNText style={styles.actionButtonText}>Directions</RNText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => {
                    router.push({
                      pathname: '/restaurant/[id]',
                      params: {
                        id: selectedRestaurant.google_place_id,
                        name: selectedRestaurant.name || '',
                        rating: selectedRestaurant.rating?.toString() || '',
                        price_level: selectedRestaurant.price_level?.toString() || '',
                        address: selectedRestaurant.formatted_address || '',
                        type: selectedRestaurant.primary_type || '',
                      },
                    });
                  }}
                >
                  <RNText style={styles.actionButtonIcon}>📍</RNText>
                  <RNText style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>View Page</RNText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
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
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  retryButton: {
    marginTop: spacing.lg,
  },
  mapPlaceholderIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  selectedCard: {
    position: 'absolute',
    bottom: 20,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  selectedCardContent: {
    gap: spacing.sm,
  },
  selectedCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 14,
    color: colors.muted,
  },
  directionsButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  refreshButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshIcon: {
    fontSize: 22,
    color: colors.text,
  },
  // Fixed-size wrapper prevents marker jumping
  markerWrapper: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Simple bubble marker
  markerBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  markerBubbleSelected: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: colors.elevated,
  },
  markerEmoji: {
    fontSize: 18,
    textAlign: 'center',
  },
  // Selected restaurant card
  selectedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectedCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  selectedCardEmoji: {
    fontSize: 22,
  },
  selectedCardTitleArea: {
    flex: 1,
  },
  selectedCardAddress: {
    marginBottom: spacing.md,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  ratingPillStar: {
    fontSize: 12,
    color: colors.amber,
    marginRight: 2,
  },
  ratingPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ratingPillCount: {
    fontSize: 11,
    color: colors.muted,
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonIcon: {
    fontSize: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  actionButtonTextPrimary: {
    color: colors.cream,
  },
});

// Warm dark map style - matches food app theme
const darkMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#1A1614' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#B8AFA6' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0D0B0A' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#2C2520' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#231E1B' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7A716A' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1E2A1E' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2C2520' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#231E1B' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3D3530' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#231E1B' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#141820' }],
  },
];
