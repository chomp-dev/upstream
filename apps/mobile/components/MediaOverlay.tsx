import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Platform, Share, Alert, ActionSheetIOS } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Restaurant } from '../src/lib/api/types';
import { colors, spacing, radius } from '../src/theme';
import { Text } from '../src/ui';
import { useAuth } from '../src/context/auth';
import { useCommentSheet } from '../src/context/commentSheet';
import { BASE_URL, blockUser, reportContent } from '../src/lib/api/media';
import { blockedUsersStore } from '../src/lib/blockedUsersStore';

interface MediaOverlayProps {
    height: number;
    user?: {
        userId?: string;
        username: string;
        avatarUrl: string;
    };
    caption?: string;
    restaurant?: Restaurant | null;
    videoUrl?: string;
    imagePostId?: number;
    title?: string;
    userLocation?: { lat: number; lng: number } | null;
}

export function MediaOverlay({
    height,
    user,
    caption,
    restaurant,
    videoUrl,
    imagePostId,
    title,
    userLocation,
}: MediaOverlayProps) {
    const router = useRouter();
    const { user: authUser, login, isLoading } = useAuth();
    const { openCommentSheet, isOpen: commentSheetOpen } = useCommentSheet();
    const [distance, setDistance] = useState<string | null>(null);
    const prevCommentSheetOpen = useRef(false);

    // DEBUG: Log what props we receive
    useEffect(() => {
        console.log('[MediaOverlay] Props received:', {
            hasRestaurant: !!restaurant,
            restaurantName: restaurant?.name,
            hasUserLocation: !!userLocation,
            userLocationCoords: userLocation ? `${userLocation.lat},${userLocation.lng}` : 'none'
        });
    }, [restaurant, userLocation]);

    // Social state
    const [likesCount, setLikesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);
    const [savesCount, setSavesCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // Calculate distance on mount (or when location updates)
    useEffect(() => {
        if (!restaurant?.lat || !restaurant?.lng) return;

        const calculateDistance = (lat: number, lng: number) => {
            const distMeters = getDistanceMeters(
                lat,
                lng,
                restaurant.lat!,
                restaurant.lng!
            );

            const distMiles = distMeters * 0.000621371;

            if (distMiles < 0.1) {
                const distFeet = Math.round(distMeters * 3.28084);
                setDistance(`${distFeet} ft`);
            } else {
                setDistance(`${distMiles.toFixed(1)} mi`);
            }
        };

        // Use passed location first (Instant)
        if (userLocation) {
            calculateDistance(userLocation.lat, userLocation.lng);
            return;
        }

        // Fallback to async fetch if no prop
        (async () => {
            try {
                const location = await Location.getLastKnownPositionAsync({});
                if (location) {
                    calculateDistance(location.coords.latitude, location.coords.longitude);
                }
            } catch (e) {
                // Ignore location errors
            }
        })();
    }, [restaurant, userLocation]);

    const fetchSocialData = useCallback(async () => {
        if (!videoUrl && !imagePostId) return;

        try {
            const params = new URLSearchParams();
            if (videoUrl) params.set('video_url', videoUrl);
            if (imagePostId) params.set('image_post_id', String(imagePostId));
            if (authUser?.sub) params.set('user_id', authUser.sub);

            const response = await fetch(`${BASE_URL}/api/social/status?${params}`);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const data = await response.json();

            setLikesCount(data.likes_count ?? 0);
            setCommentsCount(data.comments_count ?? 0);
            setSavesCount(data.saves_count ?? 0);
            setIsLiked(data.is_liked ?? false);
            setIsSaved(data.is_saved ?? false);
        } catch (err) {
            console.error('[MediaOverlay] Failed to fetch social data:', err);
        }
    }, [videoUrl, imagePostId, authUser]);

    // Initial fetch
    useEffect(() => {
        if (isLoading) return;
        if (!authUser) {
            setIsLiked(false);
            setIsSaved(false);
        }
        fetchSocialData();
    }, [fetchSocialData, isLoading, authUser]);

    // Refresh counts when comment sheet closes (user may have posted)
    useEffect(() => {
        if (prevCommentSheetOpen.current && !commentSheetOpen) {
            fetchSocialData();
        }
        prevCommentSheetOpen.current = commentSheetOpen;
    }, [commentSheetOpen, fetchSocialData]);

    const handleProfilePress = () => {
        if (user?.userId) {
            router.push({
                pathname: '/profile',
                params: { userId: user.userId }
            });
        }
    };

    const handleLike = async () => {
        if (!authUser) {
            login();
            return;
        }
        if (!videoUrl && !imagePostId) return;

        const previousLiked = isLiked;
        const previousCount = likesCount;

        setIsLiked(!previousLiked);
        setLikesCount(previousLiked ? previousCount - 1 : previousCount + 1);

        try {
            const response = await fetch(`${BASE_URL}/api/social/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(videoUrl ? { video_url: videoUrl } : { image_post_id: imagePostId }),
                    user_id: authUser.sub,
                }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Status ${response.status}`);
            }
            const data = await response.json();
            setIsLiked(data.liked);
            setLikesCount(data.likes_count ?? likesCount);
        } catch (err) {
            console.error('[MediaOverlay] Failed to toggle like:', err);
            setIsLiked(previousLiked);
            setLikesCount(previousCount);
        }
    };

    const handleSave = async () => {
        if (!authUser) {
            login();
            return;
        }
        if (!videoUrl && !imagePostId) return;

        const previousSaved = isSaved;
        const previousCount = savesCount;

        setIsSaved(!previousSaved);
        setSavesCount(previousSaved ? previousCount - 1 : previousCount + 1);

        try {
            const response = await fetch(`${BASE_URL}/api/social/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(videoUrl ? { video_url: videoUrl } : { image_post_id: imagePostId }),
                    user_id: authUser.sub,
                }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Status ${response.status}`);
            }
            const data = await response.json();
            setIsSaved(data.saved);
            setSavesCount(data.saves_count ?? savesCount);
        } catch (err) {
            console.error('[MediaOverlay] Failed to toggle save:', err);
            setIsSaved(previousSaved);
            setSavesCount(previousCount);
        }
    };

    const handleComment = () => {
        if (videoUrl) {
            openCommentSheet({ type: 'video', videoUrl });
        } else if (imagePostId) {
            openCommentSheet({ type: 'image_post', imagePostId });
        }
    };

    const handleShare = async () => {
        try {
            // Create unique link based on post type
            let postUrl = 'https://usechomp.com';
            if (videoUrl) {
                const videoId = videoUrl.split('/').pop()?.split('.')[0] || 'video';
                postUrl = `https://usechomp.com/video/${videoId}`;
            } else if (imagePostId) {
                postUrl = `https://usechomp.com/post/${imagePostId}`;
            }

            const shareContent = {
                message: `Check out this spot on Chomp! ${restaurant?.name || title || 'Amazing food find!'}\n\n${postUrl}`,
            };
            await Share.share(shareContent);
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const submitReport = async (reason: string, description?: string) => {
        if (!authUser) return;
        const contentType = videoUrl ? 'video' : 'image_post';
        const contentId = videoUrl || imagePostId?.toString();
        if (!contentId) return;

        try {
            await reportContent({
                reporterUserId: authUser.sub,
                reportedUserId: user?.userId,
                contentType,
                contentId,
                reason: reason as any,
                description,
            });
            Alert.alert('Reported', 'Thanks. We review reports within 24 hours.');
        } catch (error: any) {
            console.error('[Report] Failed to submit report:', error);
            const message = error?.message && typeof error.message === 'string'
                ? error.message
                : 'Failed to submit report.';
            Alert.alert('Error', message);
        }
    };

    const handleReport = () => {
        if (!authUser) {
            login();
            return;
        }
        if (!videoUrl && !imagePostId) return;

        const reasons = [
            { key: 'spam', label: 'Spam' },
            { key: 'harassment', label: 'Harassment' },
            { key: 'inappropriate', label: 'Inappropriate content' },
            { key: 'hate', label: 'Hate speech' },
            { key: 'other', label: 'Other' },
        ];

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    title: 'Why are you reporting this?',
                    options: ['Cancel', ...reasons.map(r => r.label)],
                    cancelButtonIndex: 0,
                    destructiveButtonIndex: reasons.length,
                },
                (buttonIndex) => {
                    if (buttonIndex === 0) return;
                    const selected = reasons[buttonIndex - 1];
                    if (selected.key === 'other') {
                        Alert.prompt(
                            'Describe the issue',
                            'Please provide details about why you are reporting this content.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Submit',
                                    onPress: (text) => submitReport('other', text),
                                },
                            ],
                            'plain-text',
                            '',
                            'default'
                        );
                    } else {
                        submitReport(selected.key);
                    }
                }
            );
        } else {
            Alert.alert(
                'Why are you reporting this?',
                'Select a reason:',
                [
                    ...reasons.map(r => ({
                        text: r.label,
                        onPress: () => {
                            if (r.key === 'other') {
                                Alert.alert(
                                    'Describe the issue',
                                    'Please provide details.',
                                    [
                                        { text: 'Cancel', style: 'cancel' as const },
                                        {
                                            text: 'Submit without details',
                                            onPress: () => submitReport('other'),
                                        },
                                    ]
                                );
                            } else {
                                submitReport(r.key);
                            }
                        },
                    })),
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        }
    };

    const handleBlock = async () => {
        if (!authUser) {
            login();
            return;
        }
        if (!user?.userId || user.userId === authUser.sub) return;
        const blockedUserId = user.userId;
        const blockedUsername = user.username;

        Alert.alert(
            'Block user',
            `Block @${blockedUsername}? Their content will be removed from your feed immediately.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await blockUser(authUser.sub, blockedUserId, 'Blocked from media overlay');
                            await blockedUsersStore.add(authUser.sub, blockedUserId);
                            Alert.alert('Blocked', 'This user has been blocked and reported to moderation.');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to block user.');
                        }
                    }
                }
            ]
        );
    };

    const formatCount = (count: number): string => {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
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

                    {/* Title */}
                    {title && (
                        <Text style={styles.title} numberOfLines={1}>
                            {title}
                        </Text>
                    )}

                    {/* Caption */}
                    {caption && (
                        <Text style={styles.caption} numberOfLines={3}>
                            {caption}
                        </Text>
                    )}

                    {/* Restaurant Location Pill */}
                    {restaurant && (
                        <TouchableOpacity
                            style={styles.locationPill}
                            activeOpacity={0.9}
                            onPress={() => {
                                router.push({
                                    pathname: '/restaurant/[id]',
                                    params: {
                                        id: restaurant.google_place_id,
                                        name: restaurant.name || '',
                                        rating: restaurant.rating?.toString() || '',
                                        price_level: restaurant.price_level?.toString() || '',
                                        address: restaurant.formatted_address || '',
                                        type: restaurant.primary_type || '',
                                        lat: restaurant.lat?.toString() || '',
                                        lng: restaurant.lng?.toString() || '',
                                    },
                                });
                            }}
                        >
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
                    {/* Like */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleLike}>
                        <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={35}
                            color={isLiked ? "#FF4444" : "white"}
                            style={styles.shadowIcon}
                        />
                        <Text style={styles.actionCount}>{formatCount(likesCount)}</Text>
                    </TouchableOpacity>

                    {/* Comment */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleComment}>
                        <Ionicons name="chatbubble-ellipses" size={32} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>{formatCount(commentsCount)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleReport}>
                        <Ionicons name="flag-outline" size={30} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>Report</Text>
                    </TouchableOpacity>

                    {user?.userId && authUser?.sub !== user.userId && (
                        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleBlock}>
                            <Ionicons name="ban-outline" size={30} color="white" style={styles.shadowIcon} />
                            <Text style={styles.actionCount}>Block</Text>
                        </TouchableOpacity>
                    )}

                    {/* Bookmark - Hidden for now, will implement later
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleSave}>
                        <Ionicons
                            name={isSaved ? "bookmark" : "bookmark-outline"}
                            size={32}
                            color={isSaved ? "#FBBF24" : "white"}
                            style={styles.shadowIcon}
                        />
                        <Text style={styles.actionCount}>{formatCount(savesCount)}</Text>
                    </TouchableOpacity>
                    */}

                    {/* Share - Hidden until feature is complete */}
                    {/* <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleShare}>
                        <Ionicons name="arrow-redo" size={32} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>Share</Text>
                    </TouchableOpacity> */}
                </View>

            </View>
        </>
    );
}

// Haversine Helper
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
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
        paddingBottom: Platform.select({ web: 20, ios: 55, android: 50 }),
    },
    leftColumn: {
        flex: 1,
        marginRight: 60,
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
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 4,
        marginBottom: 4,
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
        borderLeftColor: '#4ADE80',
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
    rightColumn: {
        alignItems: 'center',
        gap: 20,
        paddingBottom: 12,
        width: 50,
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'transparent',
    },
    shadowIcon: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    actionCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
});
