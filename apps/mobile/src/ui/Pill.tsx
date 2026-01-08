import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Pill({
  label,
  active = false,
  onPress,
  color,
  size = 'md',
  style,
}: PillProps) {
  const backgroundColor = active
    ? colors.text
    : color || colors.surface;
  const textColor = active ? colors.bg : colors.text;

  return (
    <TouchableOpacity
      style={[
        styles.pill,
        size === 'sm' && styles.pillSm,
        { backgroundColor },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <Text
        variant={size === 'sm' ? 'caption' : 'bodySmall'}
        style={[styles.text, { color: textColor }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontWeight: '600',
  },
});
