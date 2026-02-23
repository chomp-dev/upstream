import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Platform, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Restaurant } from '../src/lib/api/types';
import { colors, spacing, radius } from '../src/theme';
import { Text } from '../src/ui';
import { useAuth } from '../src/context/auth';
import { useCommentSheet } from '../src/context/commentSheet';
import { blockUser, reportContent } from '../src/lib/api/media';
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
    const { user: authUser, supabase, login } = useAuth();
    const { openCommentSheet } = useCommentSheet();
    const [distance, setDistance] = useState<string | null>(null);

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

    // Fetch social data
    useEffect(() => {
        if (!videoUrl && !imagePostId) return;

        const fetchSocialData = async () => {
            try {
                // LIKE COUNT
                let likeCount = 0;
                if (videoUrl) {
                    const { count } = await supabase
                        .from('video_likes')
                        .select('*', { count: 'exact', head: true })
                        .eq('video_url', videoUrl);
                    likeCount = count || 0;
                } else if (imagePostId) {
                    const { count } = await supabase
                        .from('image_post_likes')
                        .select('*', { count: 'exact', head: true })
                        .eq('image_post_id', imagePostId);
                    likeCount = count || 0;
                }
                setLikesCount(likeCount);

                // COMMENT COUNT
                let commentCount = 0;
                if (videoUrl) {
                    const { count } = await supabase
                        .from('comments')
                        .select('id', { count: 'exact', head: true })
                        .eq('video_url', videoUrl);
                    commentCount = count || 0;
                } else if (imagePostId) {
                    const { count } = await supabase
                        .from('image_post_comments')
                        .select('id', { count: 'exact', head: true })
                        .eq('image_post_id', imagePostId);
                    commentCount = count || 0;
                }
                setCommentsCount(commentCount || 0);

                // USER LIKE STATUS
                if (authUser) {
                    let isLikedData = false;
                    if (videoUrl) {
                        const { data } = await supabase
                            .from('video_likes')
                            .select('*')
                            .eq('video_url', videoUrl)
                            .eq('user_id', authUser.sub)
                            .maybeSingle();
                        isLikedData = !!data;
                    } else if (imagePostId) {
                        const { data } = await supabase
                            .from('image_post_likes')
                            .select('*')
                            .eq('image_post_id', imagePostId)
                            .eq('user_id', authUser.sub)
                            .maybeSingle();
                        isLikedData = !!data;
                    }
                    setIsLiked(isLikedData);

                    // Saves (only video supported for now in original code, skipping for image post if unknown)
                    if (videoUrl) {
                        const { data: saveData } = await supabase
                            .from('saves')
                            .select('*')
                            .eq('video_url', videoUrl)
                            .eq('user_id', authUser.sub)
                            .maybeSingle();
                        setIsSaved(!!saveData);
                    }
                }

                // Saves Count (video only for now)
                if (videoUrl) {
                    const { count: saveCount } = await supabase
                        .from('saves')
                        .select('id', { count: 'exact', head: true })
                        .eq('video_url', videoUrl);
                    setSavesCount(saveCount || 0);
                }
            } catch (err) {
                // Silently handle errors
            }
        };

        fetchSocialData();
    }, [videoUrl, imagePostId, authUser, supabase]);

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

        // Optimistic update
        setIsLiked(!previousLiked);
        setLikesCount(previousLiked ? previousCount - 1 : previousCount + 1);

        try {
            if (previousLiked) {
                if (videoUrl) {
                    await supabase.from('video_likes').delete().eq('video_url', videoUrl).eq('user_id', authUser.sub);
                } else if (imagePostId) {
                    await supabase.from('image_post_likes').delete().eq('image_post_id', imagePostId).eq('user_id', authUser.sub);
                }
            } else {
                if (videoUrl) {
                    await supabase.from('video_likes').insert({ video_url: videoUrl, user_id: authUser.sub });
                } else if (imagePostId) {
                    await supabase.from('image_post_likes').insert({ image_post_id: imagePostId, user_id: authUser.sub });
                }
            }
        } catch (err) {
            // Revert on error
            setIsLiked(previousLiked);
            setLikesCount(previousCount);
        }
    };

    const handleSave = async () => {
        if (!authUser) {
            login();
            return;
        }
        if (!videoUrl) return;

        const previousSaved = isSaved;
        const previousCount = savesCount;

        setIsSaved(!previousSaved);
        setSavesCount(previousSaved ? previousCount - 1 : previousCount + 1);

        try {
            if (previousSaved) {
                await supabase
                    .from('saves')
                    .delete()
                    .eq('video_url', videoUrl)
                    .eq('user_id', authUser.sub);
            } else {
                await supabase
                    .from('saves')
                    .insert({
                        video_url: videoUrl,
                        user_id: authUser.sub
                    });
            }
        } catch (err) {
            setIsSaved(previousSaved);
            setSavesCount(previousCount);
        }
    };

    const handleComment = () => {
        if (videoUrl) {
            openCommentSheet(videoUrl);
        } else if (imagePostId) {
            // Pass explicitly as image post ID if comment sheet supports it, 
            // or pass a construct that the sheet understands.
            // Assuming openCommentSheet handles polymorphism via string ID or we need to update context.
            // For now, let's try passing ID as string with prefix if needed, or just ID.
            // The current context likely expects a string ID.
            openCommentSheet(imagePostId.toString());
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

    const handleReport = async () => {
        if (!authUser) {
            login();
            return;
        }
        const contentType = videoUrl ? 'video' : 'image_post';
        const contentId = videoUrl || imagePostId?.toString();
        if (!contentId) return;

        Alert.alert(
            'Report content',
            'Report this post for objectionable or abusive content?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Report',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await reportContent({
                                reporterUserId: authUser.sub,
                                reportedUserId: user?.userId,
                                contentType,
                                contentId,
                                reason: 'inappropriate',
                            });
                            Alert.alert('Reported', 'Thanks. We review reports within 24 hours.');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to submit report.');
                        }
                    }
                }
            ]
        );
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
