import React, { useEffect, useRef, useState, ReactElement } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Text as RNText,
    Platform,
    Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import Constants from 'expo-constants';
import { createRoot } from 'react-dom/client';

import { Text, Badge } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { getMarkerIcon } from './utils';
import { MapImplProps } from './types';

// Fallback key if not found in Constants (taken from app.json)
const GOOGLE_MAPS_API_KEY =
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
    Constants.expoConfig?.ios?.config?.googleMapsApiKey ||
    'AIzaSyAqq6mTFvn6DnnQkW9MUhjx59lcX5644n0';

const LIBRARIES: any[] = ['marker'];

const MapComponent = ({
    center,
    zoom,
    restaurants,
    onSelectRestaurant,
    selectedRestaurantId,
    currentRadius,
}: {
    center: google.maps.LatLngLiteral;
    zoom: number;
    restaurants: any[];
    onSelectRestaurant: (r: any) => void;
    selectedRestaurantId?: string;
    currentRadius: number;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();
    const markersRef = useRef<{ [key: string]: any }>({});
    const rootsRef = useRef<{ [key: string]: any }>({});
    const containersRef = useRef<{ [key: string]: HTMLDivElement }>({});
    const locationMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
    const radiusCircleRef = useRef<google.maps.Circle | null>(null);

    useEffect(() => {
        if (ref.current && !map) {
            setMap(new window.google.maps.Map(ref.current, {
                center,
                zoom,
                // styles: DARK_MAP_STYLES_WEB, // Conflict with mapId, removed to enable Advanced Markers
                disableDefaultUI: true,
                zoomControl: true,
                mapId: 'DEMO_MAP_ID', // Required for Advanced Markers
            }));
        }
    }, [ref, map]);

    // Note: We don't continuously reset center/zoom to allow user to pan/zoom freely
    // The initial center/zoom is set when the map is created above

    // Current location marker and radius circle
    useEffect(() => {
        if (!map) return;

        // Create or update radius circle
        if (!radiusCircleRef.current) {
            radiusCircleRef.current = new window.google.maps.Circle({
                map,
                center,
                radius: currentRadius,
                fillColor: '#4A90D9',
                fillOpacity: 0.1,
                strokeColor: '#4A90D9',
                strokeOpacity: 0.3,
                strokeWeight: 2,
            });
        } else {
            radiusCircleRef.current.setCenter(center);
            radiusCircleRef.current.setRadius(currentRadius);
        }

        // Create or update current location marker (blue dot)
        if (!locationMarkerRef.current) {
            // Create a blue dot element
            const dotContainer = document.createElement('div');
            Object.assign(dotContainer.style, {
                width: '16px',
                height: '16px',
                backgroundColor: '#4A90D9',
                borderRadius: '50%',
                border: '3px solid white',
                boxShadow: '0px 2px 6px rgba(0,0,0,0.3)',
            });

            if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                locationMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
                    position: center,
                    map,
                    content: dotContainer,
                    zIndex: 1000, // Above other markers
                });
            } else {
                // Fallback - use default marker with blue icon
                locationMarkerRef.current = new window.google.maps.Marker({
                    position: center,
                    map,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: '#4A90D9',
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 3,
                    },
                    zIndex: 1000,
                });
            }
        } else {
            // Update position
            if ('position' in locationMarkerRef.current && typeof locationMarkerRef.current.position !== 'function') {
                (locationMarkerRef.current as google.maps.marker.AdvancedMarkerElement).position = center;
            } else if ('setPosition' in locationMarkerRef.current) {
                (locationMarkerRef.current as google.maps.Marker).setPosition(center);
            }
        }

        return () => {
            // Cleanup on unmount
            if (radiusCircleRef.current) {
                radiusCircleRef.current.setMap(null);
                radiusCircleRef.current = null;
            }
            if (locationMarkerRef.current) {
                if ('map' in locationMarkerRef.current) {
                    (locationMarkerRef.current as any).map = null;
                } else if ('setMap' in locationMarkerRef.current) {
                    (locationMarkerRef.current as google.maps.Marker).setMap(null);
                }
                locationMarkerRef.current = null;
            }
        };
    }, [map, center, currentRadius]);

    // Handle Markers
    useEffect(() => {
        if (!map) return;

        // Create new markers
        restaurants.forEach((restaurant) => {
            if (!restaurant.lat || !restaurant.lng) return;

            const id = restaurant.id;
            if (markersRef.current[id]) {
                return;
            }

            // Custom Pin Container
            const container = document.createElement('div');
            // Basic styling for the container to center the icon
            Object.assign(container.style, {
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto', // Ensure clicks register
                backgroundColor: '#1C1C1E', // Dark background for contrast
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                border: '2px solid #3A3A3C',
                boxShadow: '0px 4px 8px rgba(0,0,0,0.3)',
                transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out',
            });

            // Store container reference for selection styling
            containersRef.current[id] = container;

            // Add hover/click animation
            container.onmouseenter = () => {
                container.style.transform = 'scale(1.1)';
                container.style.boxShadow = '0px 6px 12px rgba(0,0,0,0.4)';
            };
            container.onmouseleave = () => {
                container.style.transform = 'scale(1)';
                container.style.boxShadow = '0px 4px 8px rgba(0,0,0,0.3)';
            };
            container.onmousedown = () => {
                container.style.transform = 'scale(0.9)';
            };
            container.onmouseup = () => {
                container.style.transform = 'scale(1.1)';
            };

            // Initialize React Root
            const root = createRoot(container);

            // Render the existing utility icon
            root.render(getMarkerIcon(restaurant.primary_type, false));
            rootsRef.current[id] = root;

            // Check if AdvancedMarkerElement is available
            if (window.google?.maps?.marker?.AdvancedMarkerElement) {
                const marker = new window.google.maps.marker.AdvancedMarkerElement({
                    position: { lat: restaurant.lat, lng: restaurant.lng },
                    map,
                    title: restaurant.name,
                    content: container,
                });

                marker.addListener('click', () => {
                    onSelectRestaurant(restaurant);
                });

                markersRef.current[restaurant.id] = marker;
            } else {
                // Fallback to legacy Marker
                const marker = new window.google.maps.Marker({
                    position: { lat: restaurant.lat, lng: restaurant.lng },
                    map,
                    title: restaurant.name,
                    content: container,
                });
                marker.addListener('click', () => {
                    onSelectRestaurant(restaurant);
                });
                markersRef.current[restaurant.id] = marker;
            }
        });

        // Cleanup markers
        Object.keys(markersRef.current).forEach((id) => {
            if (!restaurants.find((r) => r.id === id)) {
                if (markersRef.current[id].map) {
                    markersRef.current[id].map = null;
                } else if (typeof markersRef.current[id].setMap === 'function') {
                    markersRef.current[id].setMap(null);
                }

                delete markersRef.current[id];
                delete containersRef.current[id];

                // Cleanup React Root
                if (rootsRef.current[id]) {
                    setTimeout(() => {
                        rootsRef.current[id]?.unmount();
                        delete rootsRef.current[id];
                    }, 0);
                }
            }
        });

    }, [map, restaurants, onSelectRestaurant]);

    // Handle selection styling
    useEffect(() => {
        Object.entries(containersRef.current).forEach(([id, container]) => {
            if (id === selectedRestaurantId) {
                // Selected - orange/coral border highlight
                container.style.borderColor = '#E85D4C';
                container.style.boxShadow = '0px 0px 0px 3px rgba(232, 93, 76, 0.4), 0px 4px 8px rgba(0,0,0,0.3)';
            } else {
                // Not selected - default border
                container.style.borderColor = '#3A3A3C';
                container.style.boxShadow = '0px 4px 8px rgba(0,0,0,0.3)';
            }
        });
    }, [selectedRestaurantId]);

    return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
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

    if (!location) return <ActivityIndicator />;

    const center = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
    };

    // Approximate zoom level based on radius
    // 16 ~ 500m, 15 ~ 1000m, 14 ~ 2000m
    // radius is in meters. Map view width approx 400px?
    // zoom = 16 - Math.log2(radius / 500)
    const zoom = Math.round(15 - Math.log2(currentRadius / 1000));

    const render = (status: Status) => {
        if (status === Status.FAILURE) return <RNText>Error loading maps</RNText>;
        return <ActivityIndicator />;
    };

    const handleOpenMaps = (restaurant: any) => {
        if (restaurant.lat && restaurant.lng) {
            window.open(`https://maps.google.com/?q=${restaurant.lat},${restaurant.lng}`, '_blank');
        }
    };

    return (
        <View style={styles.mapContainer}>
            <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={render} libraries={LIBRARIES}>
                <MapComponent
                    center={center}
                    zoom={zoom}
                    restaurants={restaurants}
                    onSelectRestaurant={onSelectRestaurant}
                    selectedRestaurantId={selectedRestaurant?.id}
                    currentRadius={currentRadius}
                />
            </Wrapper>

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

            {/* Bottom card for selected restaurant - REUSING SAME UI STRUCT */}
            {selectedRestaurant && (
                <View style={styles.selectedCard}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => onSelectRestaurant(null)}
                    >
                        <RNText style={styles.closeButtonText}>✕</RNText>
                    </TouchableOpacity>

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
                    </View>

                    {selectedRestaurant.formatted_address && (
                        <Text variant="bodySmall" numberOfLines={2} color={colors.muted} style={styles.selectedCardAddress}>
                            {selectedRestaurant.formatted_address}
                        </Text>
                    )}

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

// Reuse styles but simplified were appropriate
const styles = StyleSheet.create({
    mapContainer: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden', // Important for Web
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
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
        elevation: 8,
        maxWidth: 500, // Cap width on large screens
        alignSelf: 'center',
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
        marginBottom: spacing.sm,
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
        cursor: 'pointer', // Web Only
    } as any,
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
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)',
        elevation: 5,
        cursor: 'pointer', // Web Only
    } as any,
    refreshIcon: {
        fontSize: 22,
        color: colors.text,
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
        cursor: 'pointer',
    } as any,
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

const DARK_MAP_STYLES_WEB = [
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
