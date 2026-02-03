import { View, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Restaurant } from '../src/lib/api/types';
import { colors, spacing, radius } from '../src/theme';
import { ratingColor, priceDisplay } from '../src/theme/styles';
import { Text } from '../src/ui';
import { useAuth } from '../src/context/auth';
import React, { useEffect, useState } from 'react';

interface MediaOverlayProps {
    height: number;
    user?: {
        userId?: string;
        username: string;
        avatarUrl: string;
    };
    caption?: string;
    restaurant?: Restaurant | null;
    postId: number;
}

export function MediaOverlay({
    height,
    user,
    caption,
    restaurant,
    postId
}: MediaOverlayProps) {
    const router = useRouter();
    const { user: authUser, supabase } = useAuth();
    const [likesCount, setLikesCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);

    // Fetch likes
    useEffect(() => {
        const fetchLikes = async () => {
            if (!postId) return;

            // Get count
            const { data: postData } = await supabase
                .from('posts')
                .select('likes_count')
                .eq('id', postId)
                .single();

            if (postData) {
                setLikesCount(postData.likes_count || 0);
            }

            // Check if user liked
            if (authUser) {
                const { data: likeData } = await supabase
                    .from('post_likes')
                    .select('*')
                    .eq('post_id', postId)
                    .eq('user_id', authUser.sub)
                    .single();

                setIsLiked(!!likeData);
            }
        };

        fetchLikes();
    }, [postId, authUser]);

    const toggleLike = async () => {
        if (!authUser) return; // Or show login prompt

        const previousLiked = isLiked;
        const previousCount = likesCount;

        // Optimistic update
        setIsLiked(!previousLiked);
        setLikesCount(previousLiked ? previousCount - 1 : previousCount + 1);

        if (previousLiked) {
            // Unlike
            const { error } = await supabase
                .from('post_likes')
                .delete()
                .eq('post_id', postId)
                .eq('user_id', authUser.sub);

            if (error) {
                console.error('Error unliking:', error);
                setIsLiked(previousLiked);
                setLikesCount(previousCount);
            }
        } else {
            // Like
            const { error } = await supabase
                .from('post_likes')
                .insert({
                    post_id: postId,
                    user_id: authUser.sub
                });

            if (error) {
                console.error('Error liking:', error);
                setIsLiked(previousLiked);
                setLikesCount(previousCount);
            }
        }
    };

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
            {/* Bottom gradient for readability */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
                style={[styles.bottomGradient, { height: height * 0.5 }]}
                pointerEvents="none"
            />

            {/* Right side action buttons */}
            <View style={styles.rightActions}>
                {user && (
                    <TouchableOpacity activeOpacity={0.8} onPress={handleProfilePress}>
                        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                    </TouchableOpacity>
                )}

                {/* Like button */}
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={toggleLike}>
                    <View style={styles.iconCircle}>
                        <Ionicons
                            name={isLiked ? "heart" : "heart-outline"}
                            size={28}
                            color={isLiked ? "#ff4040" : "#fff"}
                        />
                    </View>
                    <Text style={styles.actionCount}>{likesCount}</Text>
                </TouchableOpacity>

                {/* Share button */}
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="arrow-redo-outline" size={26} color="#fff" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Bottom content area */}
            <View style={styles.bottomContent}>

                {/* Restaurant Card (if available) - Integrated here instead of separate overlay */}
                {restaurant && (
                    <TouchableOpacity style={styles.restaurantCard} activeOpacity={0.9}>
                        <View style={styles.restaurantInfo}>
                            <Text variant="subtitle" numberOfLines={1} style={styles.restaurantName}>
                                {restaurant.name}
                            </Text>
                            <View style={styles.restaurantMeta}>
                                {restaurant.rating && (
                                    <View style={styles.ratingRow}>
                                        <Text style={[styles.star, { color: ratingColor(restaurant.rating) }]}>★</Text>
                                        <Text style={[styles.ratingText, { color: ratingColor(restaurant.rating) }]}>
                                            {restaurant.rating.toFixed(1)}
                                        </Text>
                                    </View>
                                )}
                                {restaurant.price_level !== null && (
                                    <View style={styles.priceBadge}>
                                        <Text style={styles.priceText}>{priceDisplay(restaurant.price_level)}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                    </TouchableOpacity>
                )}

                {/* User & Caption Info */}
                <View style={styles.userInfoContainer}>
                    {user && (
                        <TouchableOpacity style={styles.userRow} onPress={handleProfilePress}>
                            <Text style={styles.username}>@{user.username}</Text>
                        </TouchableOpacity>
                    )}
                    {caption && (
                        <Text style={styles.caption} numberOfLines={2}>
                            {caption}
                        </Text>
                    )}
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    rightActions: {
        position: 'absolute',
        right: 16,
        bottom: 180, // Higher to make room for restaurant card
        alignItems: 'center',
        gap: 20,
    },
    actionButton: {
        alignItems: 'center',
        gap: 4,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#fff',
        marginBottom: 8,
    },
    iconCircle: {
        // Removed background, just icon with shadow
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    actionCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    bottomContent: {
        position: 'absolute',
        bottom: 90, // Above tab bar
        left: 16,
        right: 80, // Leave room for right actions
        gap: 12,
    },
    restaurantCard: {
        backgroundColor: '#1A1614', // High opacity dark background
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        marginBottom: 8,
    },
    restaurantInfo: {
        flex: 1,
        gap: 4,
    },
    restaurantName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    restaurantMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    star: {
        fontSize: 14,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    priceBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
    },
    priceText: {
        color: '#ccc',
        fontSize: 12,
        fontWeight: '500',
    },
    userInfoContainer: {
        gap: 4,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    username: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    caption: {
        color: '#eee',
        fontSize: 14,
        lineHeight: 20,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});
