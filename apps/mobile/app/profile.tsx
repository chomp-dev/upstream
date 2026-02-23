import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Button, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../src/context/auth';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';

interface UserProfile {
    name: string;
    email: string;
    bio: string;
    avatar: string;
}

interface PostItem {
    id: number;
    type: 'video' | 'image';
    video_url?: string;
    playback_url?: string;
    thumbnail_url?: string;
    images?: string[];
    title: string;
    description: string;
    likes_count: number;
    user_id?: string;
    created_at: string;
}

import { navigationStore } from '../src/lib/navigationStore';
import { blockUser } from '../src/lib/api/media';
import { blockedUsersStore } from '../src/lib/blockedUsersStore';

export default function ProfileScreen() {
    const { user, logout, supabase, login } = useAuth();
    const { userId } = useLocalSearchParams();
    const targetUserId = typeof userId === 'string' ? userId : user?.sub;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<PostItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    const isOwnProfile = user?.sub === targetUserId;

    useFocusEffect(
        useCallback(() => {
            if (!user) {
                setLoading(false);
                return;
            }

            const fetchData = async () => {
                if (!profile) setLoading(true);

                try {
                    if (!targetUserId) return;

                    // 1. Fetch Profile
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('name, email, bio, avatar')
                        .eq('auth0_id', targetUserId)
                        .maybeSingle();

                    if (userData) {
                        setProfile(userData);
                    } else {
                        console.log("User fetch error:", userError);
                    }

                    // 2. Fetch Videos
                    const { data: videoData, error: videoError } = await supabase
                        .from('videos')
                        .select('*')
                        .eq('user_id', targetUserId)
                        .neq('status', 'error') // Exclude error videos
                        .order('created_at', { ascending: false });

                    // 3. Fetch Image Posts
                    const { data: imageData, error: imageError } = await supabase
                        .from('image_posts')
                        .select('*')
                        .eq('user_id', targetUserId)
                        .order('created_at', { ascending: false });

                    // Combine and Sort
                    const combinedPosts: PostItem[] = [];

                    if (videoData) {
                        combinedPosts.push(...videoData.map((v: any) => ({
                            ...v,
                            type: 'video',
                            username: userData?.name || 'User',
                            user_avatar: userData?.avatar,
                            user_id: targetUserId
                        })));
                    }
                    if (imageData) {
                        combinedPosts.push(...imageData.map((i: any) => ({
                            ...i,
                            type: 'image',
                            username: userData?.name || 'User',
                            user_avatar: userData?.avatar,
                            user_id: targetUserId
                        })));
                    }

                    // Sort by created_at desc
                    combinedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    setPosts(combinedPosts);

                    // 4. Fetch Follower Count
                    const { count: followerCount } = await supabase
                        .from('follows')
                        .select('id', { count: 'exact', head: true })
                        .eq('following_id', targetUserId);
                    setFollowersCount(followerCount || 0);

                    // 5. Fetch Following Count
                    const { count: followingCountResult } = await supabase
                        .from('follows')
                        .select('id', { count: 'exact', head: true })
                        .eq('follower_id', targetUserId);
                    setFollowingCount(followingCountResult || 0);

                    // 6. Check if current user follows this profile
                    if (user && user.sub !== targetUserId) {
                        const { data: followData } = await supabase
                            .from('follows')
                            .select('id')
                            .eq('follower_id', user.sub)
                            .eq('following_id', targetUserId)
                            .limit(1);

                        setIsFollowing(!!(followData && followData.length > 0));
                    }

                } catch (err) {
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        }, [user, targetUserId])
    );

    const handleFollowToggle = async () => {
        if (!user) {
            login();
            return;
        }
        if (!targetUserId || followLoading) return;

        const previousFollowing = isFollowing;
        const previousCount = followersCount;

        // Optimistic update
        setIsFollowing(!previousFollowing);
        setFollowersCount(previousFollowing ? previousCount - 1 : previousCount + 1);
        setFollowLoading(true);

        try {
            if (previousFollowing) {
                // Unfollow
                await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', user.sub)
                    .eq('following_id', targetUserId);
            } else {
                // Follow
                await supabase
                    .from('follows')
                    .insert({
                        follower_id: user.sub,
                        following_id: targetUserId,
                    });
            }
        } catch (err) {
            // Revert on error
            setIsFollowing(previousFollowing);
            setFollowersCount(previousCount);
            console.error('Follow toggle error:', err);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleBlockUser = async () => {
        if (!user || !targetUserId || user.sub === targetUserId) return;
        Alert.alert(
            'Block user',
            'This will immediately remove their content from your feed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await blockUser(user.sub, targetUserId, 'Blocked from profile');
                            await blockedUsersStore.add(user.sub, targetUserId);
                            Alert.alert('Blocked', 'User blocked. Their content will no longer appear in your feed.');
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to block user.');
                        }
                    },
                },
            ]
        );
    };

    const renderProfileHeader = () => (
        <View style={styles.section}>
            {/* Profile header */}
            <View style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                    {profile?.avatar ? (
                        <Image
                            source={{ uri: profile.avatar }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={48} color={colors.primary} />
                        </View>
                    )}
                </View>
                <Text variant="title" style={styles.name}>
                    {profile?.name || 'User'}
                </Text>
                {profile?.email && (
                    <Text variant="bodySmall" color={colors.muted}>
                        {profile.email}
                    </Text>
                )}
                {profile?.bio && (
                    <Text variant="body" style={styles.bio}>
                        {profile.bio}
                    </Text>
                )}

                {isOwnProfile ? (
                    <TouchableOpacity style={styles.editProfileButton} onPress={() => router.push('/edit_profile')}>
                        <Text variant="caption" color={'#000'}>Edit Profile</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                            style={[styles.followButton, isFollowing && styles.followingButton]}
                            onPress={handleFollowToggle}
                            disabled={followLoading}
                        >
                            <Text variant="caption" color={isFollowing ? colors.text : '#000'}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={() => {
                                if (!user) {
                                    login();
                                    return;
                                }
                                router.push({ pathname: '/conversation', params: { userId: targetUserId } });
                            }}
                        >
                            <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={handleBlockUser}
                        >
                            <Ionicons name="ban-outline" size={18} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text variant="title">{posts.length}</Text>
                    <Text variant="caption" color={colors.muted}>
                        Posts
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <TouchableOpacity
                    style={styles.stat}
                    onPress={() => router.push({ pathname: '/followers', params: { userId: targetUserId, tab: 'followers' } })}
                >
                    <Text variant="title">{followersCount}</Text>
                    <Text variant="caption" color={colors.muted}>
                        Followers
                    </Text>
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <TouchableOpacity
                    style={styles.stat}
                    onPress={() => router.push({ pathname: '/followers', params: { userId: targetUserId, tab: 'following' } })}
                >
                    <Text variant="title">{followingCount}</Text>
                    <Text variant="caption" color={colors.muted}>
                        Following
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Videos Header */}
            <View style={styles.videosHeader}>
                <Ionicons name="grid-outline" size={18} color={colors.text} />
                <Text variant="label">Posts</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <Screen safe>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </Screen>
        );
    }

    if (!targetUserId) {
        return (
            <Screen safe>
                <View style={styles.loginContainer}>
                    <Text>Please log in to view this profile.</Text>
                    <Button title="Go Home" onPress={() => router.replace('/')} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen safe edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text variant="subtitle">Profile</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={posts}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                // Performance optimizations
                windowSize={10}
                maxToRenderPerBatch={6}
                removeClippedSubviews={true}
                renderItem={({ item, index }) => {
                    const handlePress = () => {
                        // Navigation similar to explore.tsx
                        const dataId = `video-${Date.now()}`;
                        // We need to map PostItem to FeedItem (they are similar enough for this)
                        // @ts-ignore
                        // @ts-ignore
                        console.log('[Profile] Setting nav store item:', JSON.stringify(item, null, 2));
                        navigationStore.set(dataId, item);

                        router.push({
                            pathname: '/',
                            params: {
                                scrollToIndex: index.toString(),
                                itemId: item.id.toString(),
                                videoDataId: dataId
                            },
                        });
                    };

                    return (
                        <TouchableOpacity
                            style={styles.videoItem}
                            onPress={handlePress}
                            activeOpacity={0.8}
                        >
                            {item.type === 'video' && item.thumbnail_url ? (
                                <Image source={{ uri: item.thumbnail_url }} style={styles.videoThumbnail} />
                            ) : item.type === 'image' && item.images && item.images.length > 0 ? (
                                <Image source={{ uri: item.images[0] }} style={styles.videoThumbnail} />
                            ) : (
                                <View style={styles.videoPlaceholder}>
                                    <Ionicons name={item.type === 'image' ? "images" : "play"} size={24} color="white" />
                                </View>
                            )}
                            <Text numberOfLines={1} style={styles.videoTitle}>{item.title || 'Untitled'}</Text>
                            {item.type === 'image' && (
                                <View style={{ position: 'absolute', top: 4, right: 4 }}>
                                    <Ionicons name="images" size={12} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListHeaderComponent={renderProfileHeader}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="grid-outline" size={40} color={colors.text} />
                        </View>
                        <Text variant="title" style={{ marginTop: spacing.sm, fontSize: 18 }}>No Posts Yet</Text>
                        <Text variant="bodySmall" color={colors.muted} style={{ marginTop: 4, textAlign: 'center' }}>
                            Your posted photos and videos will{'\n'}appear here.
                        </Text>
                    </View>
                }
                contentContainerStyle={styles.content}
                numColumns={3}
                showsVerticalScrollIndicator={false}
            />
        </Screen >
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
    },
    section: {
        marginBottom: spacing.lg,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: spacing.xl,
        marginTop: spacing.lg,
    },
    avatarContainer: {
        marginBottom: spacing.md,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: colors.primary,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.primary,
    },
    name: {
        marginBottom: spacing.xs,
    },
    bio: {
        marginTop: spacing.sm,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    editProfileButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        borderWidth: 1,
        borderColor: colors.primary,
        marginTop: spacing.md,
    },
    logoutButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    followButton: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    followingButton: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    messageButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        marginHorizontal: spacing.lg,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: colors.border,
        marginHorizontal: spacing.md,
    },
    videosHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    content: {
        paddingBottom: 40,
    },
    videoItem: {
        flex: 1 / 3,
        aspectRatio: 0.8,
        margin: 1,
        position: 'relative',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoTitle: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        right: 4,
        color: 'white',
        fontSize: 10,
        textShadowColor: 'black',
        textShadowRadius: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: spacing.xxl,
        paddingBottom: spacing.xxl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1.5,
        borderColor: colors.text, // or colors.border
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
        // Remove background color for outlined look
    },
});
