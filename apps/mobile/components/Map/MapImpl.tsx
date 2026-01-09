import React, { useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Pressable,
    Text as RNText,
    Animated,
    Platform,
    Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';

import { Text, Badge } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { getMarkerIcon } from './utils';
import { MapImplProps } from './types';

// Animated marker component for smooth interactions
const AnimatedMarkerContent = ({
    iconComponent,
    isSelected,
    onPress
}: {
    iconComponent: React.ReactNode;
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
        } catch { }
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
                    {iconComponent}
                </View>
            </Animated.View>
        </Pressable>
    );
};

export default function MapImpl({
    restaurants,
    location,
    currentRadius,
    selectedRestaurant,
    onSelectRestaurant,
    onRefresh,
    refreshing
}: MapImplProps) {
    const router = useRouter();
    const mapRef = useRef<MapView>(null);

    useEffect(() => {
        // If we have restaurants and location, we could fit to coordinates here
        // But currently the map is centered on user location with a fixed delta based on radius
        if (mapRef.current && location) {
            // Optional: Animate to region if location changes
        }
    }, [location]);

    const handleOpenMaps = (restaurant: any) => {
        if (restaurant.lat && restaurant.lng) {
            const url = Platform.select({
                ios: `maps:0,0?q=${restaurant.lat},${restaurant.lng}`,
                android: `geo:0,0?q=${restaurant.lat},${restaurant.lng}(${restaurant.name})`,
                default: `https://maps.google.com/?q=${restaurant.lat},${restaurant.lng}`,
            });
            if (url) Linking.openURL(url);
        }
    };

    return (
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
                onPress={() => onSelectRestaurant(null)}
            >
                {/* Radius circle visualization */}
                {location && (
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
                )}

                {restaurants
                    .filter((r) => r.lat != null && r.lng != null && !isNaN(r.lat) && !isNaN(r.lng))
                    .map((restaurant) => {
                        const isSelected = selectedRestaurant?.id === restaurant.id;
                        const iconComponent = getMarkerIcon(restaurant.primary_type, isSelected);

                        return (
                            <Marker
                                key={restaurant.id}
                                identifier={restaurant.id}
                                coordinate={{
                                    latitude: restaurant.lat!,
                                    longitude: restaurant.lng!,
                                }}
                                anchor={{ x: 0.5, y: 0.5 }}
                                tracksViewChanges={isSelected}
                            >
                                <AnimatedMarkerContent
                                    iconComponent={iconComponent}
                                    isSelected={isSelected}
                                    onPress={() => onSelectRestaurant(restaurant)}
                                />
                            </Marker>
                        );
                    })}
            </MapView>

            {/* Refresh button */}
            {onRefresh && (
                <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                    {refreshing ? (
                        <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                        <RNText style={styles.refreshIcon}>↻</RNText>
                    )}
                </TouchableOpacity>
            )}

            {/* Bottom card for selected restaurant */}
            {selectedRestaurant && (
                <View style={styles.selectedCard}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => onSelectRestaurant(null)}
                    >
                        <RNText style={styles.closeButtonText}>✕</RNText>
                    </TouchableOpacity>

                    {/* Header with icon and name */}
                    <View style={styles.selectedCardHeader}>
                        <View style={styles.selectedCardIcon}>
                            {getMarkerIcon(selectedRestaurant.primary_type, false)}
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
                        {/* Note: media summary passed via props or fetched? Original code accessed local state mediaSummary. 
                We might need to pass mediaCount or similar if we want to show it. 
                For now, omitting or we need to add it to props. 
                Let's omit for simplicity or add to props later if critical. */}
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
                            <Ionicons name="navigate-outline" size={18} color={colors.text} style={{ marginRight: 6 }} />
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
                            <Ionicons name="storefront-outline" size={18} color={colors.bg} style={{ marginRight: 6 }} />
                            <RNText style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>View Page</RNText>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
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
    selectedCardTitleArea: {
        flex: 1,
    },
    selectedCardAddress: {
        marginBottom: spacing.md,
    },
    selectedCardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
        marginBottom: spacing.sm, // Added margin since we removed it from address/header sometimes
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
    markerWrapper: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
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
    actionButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    actionButtonTextPrimary: {
        color: colors.cream,
    },
});

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
