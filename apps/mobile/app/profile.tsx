import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Button } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../src/context/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';

interface UserProfile {
    name: string;
    email: string;
    bio: string;
    avatar: string;
}

interface VideoItem {
    id: number;
    playback_url?: string;
    thumbnail_url?: string;
    images?: string[]; // Add images for image posts
    post_type: 'video' | 'image' | 'tiktok_embed';
    title: string;
    description: string;
    likes_count: number;
    user_id?: string;
}

export default function ProfileScreen() {
    const { user, logout, supabase } = useAuth();
    const { userId } = useLocalSearchParams();
    const targetUserId = typeof userId === 'string' ? userId : user?.sub;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            // Redirect or show login
            // router.replace('/'); 
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                if (!targetUserId) return;

                // 1. Fetch Profile
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('name, email, bio, avatar')
                    .eq('auth0_id', targetUserId)
                    .single();

                if (userData) {
                    setProfile(userData);
                } else {
                    console.log("User fetch error:", userError);
                }

                // 2. Fetch Posts (videos + images)
                const { data: postData, error: postError } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('user_id', targetUserId)
                    .neq('status', 'error') // Exclude failed uploads
                    .order('created_at', { ascending: false });

                if (postData) {
                    setVideos(postData);
                }

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

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

                {user && user.sub === targetUserId && (
                    <TouchableOpacity style={styles.logoutButton} onPress={() => { logout(); router.replace('/'); }}>
                        <Text variant="caption" color={colors.muted}>Log Out</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text variant="title">{videos.length}</Text>
                    <Text variant="caption" color={colors.muted}>
                        Posts
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text variant="title">0</Text>
                    <Text variant="caption" color={colors.muted}>
                        Followers
                    </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text variant="title">0</Text>
                    <Text variant="caption" color={colors.muted}>
                        Following
                    </Text>
                </View>
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
                data={videos}
                keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                renderItem={({ item }) => {
                    const thumbnail = item.thumbnail_url || item.images?.[0];
                    return (
                        <View style={styles.videoItem}>
                            {/* Simple Video Item representation */}
                            {thumbnail ? (
                                <Image source={{ uri: thumbnail }} style={styles.videoThumbnail} />
                            ) : (
                                <View style={styles.videoPlaceholder}>
                                    <Ionicons
                                        name={item.post_type === 'image' ? "images" : "play"}
                                        size={24}
                                        color="white"
                                    />
                                </View>
                            )}
                            <Text numberOfLines={1} style={styles.videoTitle}>{item.title || 'Untitled'}</Text>
                        </View>
                    );
                }}
                ListHeaderComponent={renderProfileHeader}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text variant="bodySmall" color={colors.muted}>No posts yet</Text>
                    </View>
                }
                contentContainerStyle={styles.content}
                numColumns={3}
            />
        </Screen>
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
    logoutButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
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
        marginTop: spacing.xl,
    },
});
