/**
 * Explore Tab - Grid/collage of feed items + search
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { mediaApi } from '../../src/lib/api';
import type { FeedItem } from '../../src/lib/api/types';

import { useContentDimensions } from '../../src/hooks/useContentDimensions';

const GRID_GAP = 2;
const NUM_COLUMNS = 2;

export default function ExploreScreen() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [filteredFeed, setFilteredFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { width } = useContentDimensions();

  const ITEM_WIDTH = (width - GRID_GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
  const ITEM_HEIGHT = ITEM_WIDTH * 1.4;

  const loadFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await mediaApi.fetchFeed(50, 0);

      // Filter out error/deleted videos on client side
      const validFeed = (data.feed || []).filter(item => {
        if (item.type === 'video') {
          return item.status !== 'error' && item.playback_url;
        }
        return true;
      });

      setFeed(validFeed);
      setFilteredFeed(validFeed);
    } catch (error) {
      console.error('Error loading explore feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Simple client-side filter (placeholder for future search)
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFeed(feed);
    } else {
      // For now, just filter by type or status (placeholder)
      const query = searchQuery.toLowerCase();
      const filtered = feed.filter((item) => {
        // In future: filter by restaurant name, caption, etc.
        return item.type.includes(query);
      });
      setFilteredFeed(filtered);
    }
  }, [searchQuery, feed]);

  const getItemThumbnail = (item: FeedItem): string | undefined => {
    if (item.type === 'video') {
      return item.thumbnail_url;
    }
    // For image posts, use first image
    return item.images?.[0];
  };

  const handleItemPress = (item: FeedItem, index: number) => {
    // Navigate to home feed with item index to scroll to
    router.push({
      pathname: '/',
      params: { scrollToIndex: index.toString(), itemId: item.id.toString() },
    });
  };

  const renderItem = ({ item, index }: { item: FeedItem; index: number }) => {
    const thumbnail = getItemThumbnail(item);
    const isProcessing = item.type === 'video' && item.status !== 'ready';

    return (
      <TouchableOpacity
        style={[styles.gridItem, { width: ITEM_WIDTH, height: ITEM_HEIGHT }]}
        onPress={() => handleItemPress(item, index)}
        activeOpacity={0.8}
      >
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Text style={styles.placeholderIcon}>
              {item.type === 'video' ? '🎬' : '📷'}
            </Text>
          </View>
        )}

        {/* Type indicator */}
        <View style={styles.typeIndicator}>
          <Text style={styles.typeIcon}>
            {item.type === 'video' ? '▶' : '📷'}
          </Text>
        </View>

        {/* Processing overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* Image count for carousels */}
        {item.type === 'image_post' && item.images && item.images.length > 1 && (
          <View style={styles.imageCount}>
            <Text variant="caption" color={colors.text}>
              1/{item.images.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <Screen edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodySmall" color={colors.muted} style={{ marginTop: spacing.md }}>
            Loading...
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {/* Search header */}
      <View style={styles.header}>
        <Text variant="title" style={styles.title}>
          Explore
        </Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={colors.muted} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search (coming soon)"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Grid */}
      <FlatList
        data={filteredFeed}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderItem}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadFeed(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text variant="subtitle" center>
              No posts found
            </Text>
            <Text variant="bodySmall" color={colors.muted} center>
              Be the first to share!
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.text,
    fontSize: 16,
  },
  clearButton: {
    color: colors.muted,
    fontSize: 16,
    padding: spacing.xs,
  },
  gridContainer: {
    paddingHorizontal: GRID_GAP,
    paddingBottom: 120,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  placeholderIcon: {
    fontSize: 32,
    opacity: 0.5,
  },
  typeIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.overlay,
    borderRadius: radius.sm,
    padding: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  typeIcon: {
    fontSize: 12,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageCount: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.overlay,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
});
