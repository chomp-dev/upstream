import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

type BadgeVariant = 'default' | 'price' | 'ai' | 'rating' | 'cached';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: colors.surface, text: colors.text },
  price: { bg: colors.terracotta, text: colors.cream },
  ai: { bg: colors.purple, text: colors.text },
  rating: { bg: colors.amber, text: colors.bg },
  cached: { bg: colors.sage, text: colors.cream },
};

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const { bg, text } = variantStyles[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text variant="caption" style={{ color: text, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
});
