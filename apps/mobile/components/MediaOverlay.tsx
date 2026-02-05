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
import { CommentSheet } from './CommentSheet';

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
}

export function MediaOverlay({
    height,
    user,
    caption,
    restaurant,
    videoUrl,
    imagePostId,
    title,
}: MediaOverlayProps) {
    const router = useRouter();
    const { user: authUser, supabase } = useAuth();
    const [distance, setDistance] = useState<string | null>(null);

    // Social state
    const [likesCount, setLikesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);
    const [savesCount, setSavesCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [showComments, setShowComments] = useState(false);

    // Calculate distance on mount
    useEffect(() => {
        if (!restaurant?.lat || !restaurant?.lng) return;

        (async () => {
            try {
                const location = await Location.getLastKnownPositionAsync({});
                if (location) {
                    const distMeters = getDistanceMeters(
                        location.coords.latitude,
                        location.coords.longitude,
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
                }
            } catch (e) {
                // Ignore location errors
            }
        })();
    }, [restaurant]);

    // Fetch social data
    useEffect(() => {
        if (!videoUrl) return;

        const fetchSocialData = async () => {
            try {
                // Fetch like count
                const { data: videoData } = await supabase
                    .from('videos')
                    .select('likes_count')
                    .eq('video_url', videoUrl)
                    .single();

                if (videoData) {
                    setLikesCount(videoData.likes_count || 0);
                }

                // Fetch comment count
                const { count: commentCount } = await supabase
                    .from('comments')
                    .select('id', { count: 'exact', head: true })
                    .eq('video_url', videoUrl);

                setCommentsCount(commentCount || 0);

                // Check if current user liked
                if (authUser) {
                    const { data: likeData } = await supabase
                        .from('video_likes')
                        .select('*')
                        .eq('video_url', videoUrl)
                        .eq('user_id', authUser.sub)
                        .single();

                    setIsLiked(!!likeData);

                    // Check if saved
                    const { data: saveData } = await supabase
                        .from('saves')
                        .select('*')
                        .eq('video_url', videoUrl)
                        .eq('user_id', authUser.sub)
                        .single();

                    setIsSaved(!!saveData);
                }

                // Fetch saves count
                const { count: saveCount } = await supabase
                    .from('saves')
                    .select('id', { count: 'exact', head: true })
                    .eq('video_url', videoUrl);

                setSavesCount(saveCount || 0);
            } catch (err) {
                // Silently handle errors - data will show defaults
            }
        };

        fetchSocialData();
    }, [videoUrl, authUser, supabase]);

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
            Alert.alert('Sign In Required', 'Please sign in to like posts.');
            return;
        }
        if (!videoUrl) return;

        const previousLiked = isLiked;
        const previousCount = likesCount;

        // Optimistic update
        setIsLiked(!previousLiked);
        setLikesCount(previousLiked ? previousCount - 1 : previousCount + 1);

        try {
            if (previousLiked) {
                await supabase
                    .from('video_likes')
                    .delete()
                    .eq('video_url', videoUrl)
                    .eq('user_id', authUser.sub);
            } else {
                await supabase
                    .from('video_likes')
                    .insert({
                        video_url: videoUrl,
                        user_id: authUser.sub
                    });
            }
        } catch (err) {
            // Revert on error
            setIsLiked(previousLiked);
            setLikesCount(previousCount);
        }
    };

    const handleSave = async () => {
        if (!authUser) {
            Alert.alert('Sign In Required', 'Please sign in to save posts.');
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
        if (!videoUrl) return;
        setShowComments(true);
    };

    const handleShare = async () => {
        try {
            const shareContent = {
                message: `Check out this spot on Chomp! ${restaurant?.name || title || 'Amazing food find!'}\n\nhttps://usechomp.com`,
            };
            await Share.share(shareContent);
        } catch (error) {
            console.error('Error sharing:', error);
        }
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

                    {/* Bookmark */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleSave}>
                        <Ionicons
                            name={isSaved ? "bookmark" : "bookmark-outline"}
                            size={32}
                            color={isSaved ? "#FBBF24" : "white"}
                            style={styles.shadowIcon}
                        />
                        <Text style={styles.actionCount}>{formatCount(savesCount)}</Text>
                    </TouchableOpacity>

                    {/* Share */}
                    <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={handleShare}>
                        <Ionicons name="arrow-redo" size={32} color="white" style={styles.shadowIcon} />
                        <Text style={styles.actionCount}>Share</Text>
                    </TouchableOpacity>
                </View>

            </View>

            {/* Comment Sheet */}
            {videoUrl && (
                <CommentSheet
                    videoUrl={videoUrl}
                    visible={showComments}
                    onClose={() => setShowComments(false)}
                />
            )}
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
        paddingBottom: Platform.select({ web: 20, ios: 90, android: 80 }),
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4, // Android shadow
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
