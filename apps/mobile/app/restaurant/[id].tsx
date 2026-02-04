/**
 * Restaurant Detail Page
 * Shows restaurant info, action buttons, and posts from this location
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList, Linking, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Screen, Text, Badge } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';
import { useAuth } from '../../src/context/auth';

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

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const { supabase } = useAuth();
  const { id, name, rating, price_level, address, type, lat, lng } = useLocalSearchParams<{
    id: string;
    name: string;
    rating: string;
    price_level: string;
    address: string;
    type: string;
    lat: string;
    lng: string;
  }>();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const ratingNum = rating ? parseFloat(rating) : null;
  const priceNum = price_level ? parseInt(price_level, 10) : null;

  useEffect(() => {
    const fetchPosts = async () => {
      if (!id) return;

      try {
        // Fetch videos for this restaurant
        const { data: videoData } = await supabase
          .from('videos')
          .select('*')
          .eq('google_place_id', id)
          .neq('status', 'error')
          .order('created_at', { ascending: false });

        // Fetch image posts for this restaurant
        const { data: imageData } = await supabase
          .from('image_posts')
          .select('*')
          .eq('google_place_id', id)
          .order('created_at', { ascending: false });

        const combinedPosts: PostItem[] = [];

        if (videoData) {
          combinedPosts.push(...videoData.map((v: any) => ({ ...v, type: 'video' as const })));
        }
        if (imageData) {
          combinedPosts.push(...imageData.map((i: any) => ({ ...i, type: 'image' as const })));
        }

        // Sort by created_at desc
        combinedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setPosts(combinedPosts);
      } catch (err) {
        console.error('Error fetching posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [id, supabase]);

  const handleDirections = useCallback(() => {
    if (lat && lng) {
      const url = Platform.select({
        ios: `maps:0,0?q=${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(name || 'Restaurant')})`,
        default: `https://maps.google.com/?q=${lat},${lng}`,
      });
      if (url) Linking.openURL(url);
    } else if (address) {
      const url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(address)}`,
        android: `geo:0,0?q=${encodeURIComponent(address)}`,
        default: `https://maps.google.com/?q=${encodeURIComponent(address)}`,
      });
      if (url) Linking.openURL(url);
    }
  }, [lat, lng, address, name]);

  const handleAddPost = useCallback(() => {
    router.push({
      pathname: '/(tabs)/create',
      params: { google_place_id: id, restaurant_name: name },
    });
  }, [id, name, router]);

  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Restaurant Info Card */}
      <View style={styles.infoCard}>
        <Text variant="title" style={styles.name}>
          {name || 'Restaurant'}
        </Text>

        {type && (
          <Text variant="bodySmall" color={colors.muted} style={styles.type}>
            {type.replace(/_/g, ' ')}
          </Text>
        )}

        <View style={styles.metaRow}>
          {ratingNum !== null && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={[styles.ratingText, { color: ratingColor(ratingNum) }]}>
                {ratingNum.toFixed(1)}
              </Text>
            </View>
          )}
          {priceNum !== null && (
            <Badge label={priceDisplay(priceNum)} variant="price" />
          )}
        </View>

        {address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color={colors.muted} />
            <Text variant="body" color={colors.textSecondary} style={styles.addressText}>
              {address}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleDirections}>
          <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Ionicons name="navigate" size={22} color="#3B82F6" />
          </View>
          <Text variant="caption" style={styles.actionText}>Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleAddPost}>
          <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(255, 68, 68, 0.15)' }]}>
            <Ionicons name="add-circle" size={22} color={colors.primary} />
          </View>
          <Text variant="caption" style={styles.actionText}>Add Post</Text>
        </TouchableOpacity>
      </View>

      {/* Posts Section Header */}
      <View style={styles.sectionHeader}>
        <Ionicons name="grid-outline" size={18} color={colors.text} />
        <Text variant="label" style={styles.sectionTitle}>
          Posts from here
        </Text>
        <Text variant="caption" color={colors.muted}>
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </Text>
      </View>
    </View>
  );

  const renderPostItem = ({ item }: { item: PostItem }) => {
    const thumbnail = item.type === 'video'
      ? item.thumbnail_url
      : item.images && item.images.length > 0
        ? item.images[0]
        : null;

    return (
      <TouchableOpacity
        style={styles.postItem}
        onPress={() => {
          // Navigate to feed with this post
          router.push({
            pathname: '/',
            params: { itemId: item.id.toString() },
          });
        }}
        activeOpacity={0.8}
      >
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.postThumbnail} />
        ) : (
          <View style={styles.postPlaceholder}>
            <Ionicons name={item.type === 'image' ? 'images' : 'play'} size={24} color="white" />
          </View>
        )}
        <Text numberOfLines={1} style={styles.postTitle}>{item.title || 'Untitled'}</Text>
        {item.type === 'video' && (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={10} color="white" />
          </View>
        )}
        {item.type === 'image' && item.images && item.images.length > 1 && (
          <View style={styles.multiImageBadge}>
            <Ionicons name="copy" size={10} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text variant="subtitle" numberOfLines={1} style={styles.headerTitle}>
          {name || 'Restaurant'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderPostItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text variant="body" center color={colors.muted}>
                No posts yet
              </Text>
              <Text variant="bodySmall" center color={colors.muted} style={styles.emptySubtext}>
                Be the first to share a video or photo from this place!
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddPost}>
                <Ionicons name="add" size={18} color={colors.bg} />
                <Text variant="caption" color={colors.bg} style={{ marginLeft: 4 }}>Add Post</Text>
              </TouchableOpacity>
            </View>
          }
          numColumns={3}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 100,
  },
  headerContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  name: {
    marginBottom: spacing.xs,
  },
  type: {
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  ratingStar: {
    fontSize: 14,
    color: colors.amber,
    marginRight: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  addressText: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginBottom: spacing.xl,
  },
  actionButton: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    color: colors.text,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    flex: 1,
  },
  postItem: {
    flex: 1 / 3,
    aspectRatio: 0.8,
    margin: 1,
    position: 'relative',
  },
  postThumbnail: {
    width: '100%',
    height: '100%',
  },
  postPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postTitle: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    color: 'white',
    fontSize: 10,
    textShadowColor: 'black',
    textShadowRadius: 2,
  },
  playBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiImageBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptySubtext: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
