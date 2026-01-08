/**
 * Restaurant Detail Page - Placeholder
 * Shows restaurant info and posts from this location
 */

import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Badge } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { ratingColor, priceDisplay } from '../../src/theme/styles';

export default function RestaurantDetailScreen() {
  const { id, name, rating, price_level, address, type } = useLocalSearchParams<{
    id: string;
    name: string;
    rating: string;
    price_level: string;
    address: string;
    type: string;
  }>();
  const router = useRouter();

  const ratingNum = rating ? parseFloat(rating) : null;
  const priceNum = price_level ? parseInt(price_level, 10) : null;

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

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
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
            {ratingNum && (
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
            <Text variant="body" color={colors.textSecondary} style={styles.address}>
              📍 {address}
            </Text>
          )}
        </View>

        {/* Posts Section - Placeholder */}
        <View style={styles.section}>
          <Text variant="subtitle" style={styles.sectionTitle}>
            Posts from here
          </Text>
          
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>🎬</Text>
            <Text variant="body" center color={colors.muted}>
              No posts yet
            </Text>
            <Text variant="bodySmall" center color={colors.muted} style={styles.placeholderSubtext}>
              Be the first to share a video or photo from this place!
            </Text>
          </View>
        </View>

        {/* Actions Section - Placeholder */}
        <View style={styles.section}>
          <Text variant="subtitle" style={styles.sectionTitle}>
            Quick Actions
          </Text>
          
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="camera-outline" size={24} color={colors.primary} />
              <Text variant="bodySmall">Add Post</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="navigate-outline" size={24} color={colors.primary} />
              <Text variant="bodySmall">Directions</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="call-outline" size={24} color={colors.primary} />
              <Text variant="bodySmall">Call</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="globe-outline" size={24} color={colors.primary} />
              <Text variant="bodySmall">Website</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Coming Soon Notice */}
        <View style={styles.comingSoon}>
          <Ionicons name="construct-outline" size={16} color={colors.muted} style={{ marginBottom: 4 }} />
          <Text variant="caption" color={colors.muted} center>
            Full restaurant page coming soon
          </Text>
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
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
  address: {
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  placeholder: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  placeholderSubtext: {
    marginTop: spacing.xs,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  comingSoon: {
    paddingVertical: spacing.xl,
  },
});
