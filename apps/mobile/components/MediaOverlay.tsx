import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Restaurant } from '../src/lib/api/types';
import { colors, spacing, radius } from '../src/theme';
import { ratingColor, priceDisplay } from '../src/theme/styles';
import { Text } from '../src/ui';

interface MediaOverlayProps {
    height: number;
    user?: {
        userId?: string;
        username: string;
        avatarUrl: string;
    };
    caption?: string;
    restaurant?: Restaurant | null;
}

export function MediaOverlay({
    height,
    user,
    caption,
    restaurant,
}: MediaOverlayProps) {
    const router = useRouter();
    const [distance, setDistance] = useState<string | null>(null);

    // Calculate distance on mount
    useEffect(() => {
        if (!restaurant?.lat || !restaurant?.lng) return;

        (async () => {
            try {
                // Use last known position for speed, falling back to current
                const location = await Location.getLastKnownPositionAsync({});
                if (location) {
                    const distMeters = getDistanceMeters(
                        location.coords.latitude,
                        location.coords.longitude,
                        restaurant.lat!,
                        restaurant.lng!
                    );

                    // Convert to imperial units
                    const distMiles = distMeters * 0.000621371;

                    if (distMiles < 0.1) {
                        // Less than 0.1 miles (~500ft), show feet
                        // 1 meter = 3.28084 feet
                        const distFeet = Math.round(distMeters * 3.28084);
                        setDistance(`${distFeet} ft`);
                    } else {
                        setDistance(`${distMiles.toFixed(1)} mi`);
                    }
                }
            } catch (e) {
                // Ignore location errors for UI overlay
            }
        })();
    }, [restaurant]);

    const handleProfilePress = () => {
        if (user?.userId) {
            router.push({
                pathname: '/profile',
                params: { userId: user.userId }
            });
        }
    };

    return (
        <>
            {/* Extended Bottom Gradient for text readability */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                style={[styles.bottomGradient, { height: height * 0.5 }]}
                pointerEvents="none"
            />

            {/* Main Overlay Container */}
            <View style={styles.overlayContainer}>

                {/* Left Column: User Info & Captions */}
                <View style={styles.leftColumn}>
                    {/* User Header */}
                    {user && (
                        <TouchableOpacity style={styles.userRow} onPress={handleProfilePress} activeOpacity={0.8}>
                            <Image source={{ uri: user.avatarUrl }} style={styles.avatarSmall} />
                            <Text style={styles.username}>@{user.username}</Text>
                        </TouchableOpacity>
                    )}

                    {/* Caption */}
                    {caption && (
                        <Text style={styles.caption} numberOfLines={3}>
                            {caption}
                        </Text>
                    )}

                    {/* Restaurant Location Pill */}
                    {restaurant && (
                        <TouchableOpacity style={styles.locationPill} activeOpacity={0.9}>
                            <View style={styles.pillContent}>
                                <Ionicons name="location-sharp" size={14} color="#4ADE80" style={{ marginRight: 4 }} />
                                <Text style={styles.locationText} numberOfLines={1}>
                                    {restaurant.name}
                                </Text>
                                {distance && (
                                    <>
                                        <Text style={styles.dotSeparator}>•</Text>
                                        <Text style={styles.distanceText}>{distance}</Text>
                                    </>
                                )}
                                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Right Column: Actions */}
                <View style={styles.rightColumn}>
                    {/* Profile Follow Button (Optional, keeping simple for now) */}

                    {/* Like */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                        <Ionicons name="heart" size={35} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>87.4K</Text>
                    </TouchableOpacity>

                    {/* Comment */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                        <Ionicons name="chatbubble-ellipses" size={32} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>402</Text>
                    </TouchableOpacity>

                    {/* Bookmark */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                        <Ionicons name="bookmark" size={32} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>3.2K</Text>
                    </TouchableOpacity>

                    {/* Share */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                        <Ionicons name="arrow-redo" size={32} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>Share</Text>
                    </TouchableOpacity>
                </View>

            </View>
        </>
    );
}

// Haversine Helper
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

const styles = StyleSheet.create({
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    overlayContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingBottom: Platform.select({ web: 20, ios: 90, android: 80 }), // Safe area for tab bar
    },

    // Left Column
    leftColumn: {
        flex: 1,
        marginRight: 60, // Avoid overlapping right actions
        justifyContent: 'flex-end',
        gap: 8,
        paddingBottom: 12,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    avatarSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    username: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    caption: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '400',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
        marginBottom: 8,
    },
    locationPill: {
        backgroundColor: 'rgba(30, 30, 30, 0.6)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        alignSelf: 'flex-start',
        borderLeftWidth: 3,
        borderLeftColor: '#4ADE80', // Green accent
    },
    pillContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        maxWidth: 180,
    },
    dotSeparator: {
        color: 'rgba(255,255,255,0.6)',
        marginHorizontal: 6,
        fontSize: 10,
    },
    distanceText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
    },

    // Right Column
    rightColumn: {
        alignItems: 'center',
        gap: 20,
        paddingBottom: 12,
        width: 50,
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    shadowIcon: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    actionCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    discContainer: {
        marginTop: 20,
        width: 48,
        height: 48,
    },
    disc: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 8,
        borderColor: '#111',
    },
    discImage: {
        width: 24,
        height: 24,
        borderRadius: 12,
    }
});
