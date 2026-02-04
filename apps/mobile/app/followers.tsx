/**
 * Followers/Following List Screen
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Screen, Text, Segmented } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';
import { useAuth } from '../src/context/auth';

interface UserItem {
    auth0_id: string;
    name: string;
    avatar: string;
    bio?: string;
}

type TabType = 'followers' | 'following';

export default function FollowersScreen() {
    const router = useRouter();
    const { user, supabase } = useAuth();
    const { userId, tab } = useLocalSearchParams<{ userId: string; tab: string }>();
    const [activeTab, setActiveTab] = useState<TabType>((tab as TabType) || 'followers');
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchUsers = async () => {
            if (!userId) return;

            setLoading(true);
            try {
                if (activeTab === 'followers') {
                    // Get users who follow this profile
                    const { data: followsData } = await supabase
                        .from('follows')
                        .select('follower_id')
                        .eq('following_id', userId);

                    if (followsData && followsData.length > 0) {
                        const followerIds = followsData.map(f => f.follower_id);
                        const { data: usersData } = await supabase
                            .from('users')
                            .select('auth0_id, name, avatar, bio')
                            .in('auth0_id', followerIds);

                        setUsers(usersData || []);
                    } else {
                        setUsers([]);
                    }
                } else {
                    // Get users this profile follows
                    const { data: followsData } = await supabase
                        .from('follows')
                        .select('following_id')
                        .eq('follower_id', userId);

                    if (followsData && followsData.length > 0) {
                        const followingIds = followsData.map(f => f.following_id);
                        const { data: usersData } = await supabase
                            .from('users')
                            .select('auth0_id, name, avatar, bio')
                            .in('auth0_id', followingIds);

                        setUsers(usersData || []);
                    } else {
                        setUsers([]);
                    }
                }
            } catch (err) {
                console.error('Error fetching users:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [userId, activeTab, supabase]);

    // Check which users the current user is following (separate effect to avoid stale closure)
    useEffect(() => {
        const fetchFollowingStatus = async () => {
            if (!user || users.length === 0) return;

            const userIds = users.map(u => u.auth0_id);
            const { data: followingData } = await supabase
                .from('follows')
                .select('following_id')
                .eq('follower_id', user.sub)
                .in('following_id', userIds);

            const following: Record<string, boolean> = {};
            followingData?.forEach(f => {
                following[f.following_id] = true;
            });
            setFollowingMap(following);
        };

        fetchFollowingStatus();
    }, [users, user, supabase]);

    const handleFollow = async (targetUserId: string) => {
        if (!user) return;

        const isCurrentlyFollowing = followingMap[targetUserId];

        // Optimistic update
        setFollowingMap(prev => ({
            ...prev,
            [targetUserId]: !isCurrentlyFollowing,
        }));

        try {
            if (isCurrentlyFollowing) {
                await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', user.sub)
                    .eq('following_id', targetUserId);
            } else {
                await supabase
                    .from('follows')
                    .insert({
                        follower_id: user.sub,
                        following_id: targetUserId,
                    });
            }
        } catch (err) {
            // Revert on error
            setFollowingMap(prev => ({
                ...prev,
                [targetUserId]: isCurrentlyFollowing,
            }));
        }
    };

    const renderUserItem = ({ item }: { item: UserItem }) => {
        const isFollowing = followingMap[item.auth0_id];
        const isOwnProfile = user?.sub === item.auth0_id;

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => router.push({ pathname: '/profile', params: { userId: item.auth0_id } })}
                activeOpacity={0.7}
            >
                {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitial}>{item.name?.[0]?.toUpperCase() || 'U'}</Text>
                    </View>
                )}
                <View style={styles.userInfo}>
                    <Text variant="subtitle" numberOfLines={1}>{item.name || 'User'}</Text>
                    {item.bio && (
                        <Text variant="caption" color={colors.muted} numberOfLines={1}>{item.bio}</Text>
                    )}
                </View>
                {!isOwnProfile && user && (
                    <TouchableOpacity
                        style={[styles.followButton, isFollowing && styles.followingButton]}
                        onPress={() => handleFollow(item.auth0_id)}
                    >
                        <Text variant="caption" color={isFollowing ? colors.text : colors.bg}>
                            {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Screen safe edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text variant="subtitle">{activeTab === 'followers' ? 'Followers' : 'Following'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <Segmented
                options={[
                    { key: 'followers', label: 'Followers' },
                    { key: 'following', label: 'Following' },
                ]}
                selected={activeTab}
                onSelect={(key) => setActiveTab(key as TabType)}
                style={styles.tabs}
            />

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item.auth0_id}
                    renderItem={renderUserItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text variant="body" color={colors.muted} center>
                                {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
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
    tabs: {
        marginHorizontal: spacing.lg,
        marginVertical: spacing.md,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.lg,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 18,
    },
    userInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    followButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.primary,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    followingButton: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    emptyContainer: {
        paddingVertical: spacing.xxl,
        alignItems: 'center',
    },
});
