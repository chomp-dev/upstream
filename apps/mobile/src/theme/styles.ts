/**
 * Shared style helpers and utilities
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, radius, typography, shadows } from './tokens';

/**
 * Get rating color based on score
 */
export function ratingColor(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return colors.muted;
  if (rating >= 4.5) return colors.ratingExcellent;
  if (rating >= 4.0) return colors.ratingGood;
  if (rating >= 3.5) return colors.ratingAverage;
  return colors.ratingBelowAverage;
}

/**
 * Get price display string
 */
export function priceDisplay(level: number | null | undefined): string {
  if (level === null || level === undefined) return '';
  return '$'.repeat(Math.min(level + 1, 4));
}

/**
 * Format distance in miles
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return '';
  const miles = meters / 1609.34;
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Common layout styles
 */
export const layoutStyles = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { justifyContent: 'center', alignItems: 'center' },
  absolute: { position: 'absolute' },
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

/**
 * Common text styles
 */
export const textStyles = StyleSheet.create({
  heading: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: typography.letterSpacing.tight,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: typography.fontSize.md,
    color: colors.text,
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
  },
  bodySmall: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
  },
  caption: {
    fontSize: typography.fontSize.xs,
    color: colors.muted,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});

/**
 * Container styles
 */
export const containerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  padded: {
    padding: spacing.lg,
  },
  paddedHorizontal: {
    paddingHorizontal: spacing.lg,
  },
});

/**
 * Card base style
 */
export const cardStyle: ViewStyle = {
  backgroundColor: colors.card,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.border,
  ...shadows.md,
};
