import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

interface SegmentedOption {
  key: string;
  label: string;
}

interface SegmentedProps {
  options: SegmentedOption[];
  selected: string;
  onSelect: (key: string) => void;
  style?: ViewStyle;
}

export function Segmented({
  options,
  selected,
  onSelect,
  style,
}: SegmentedProps) {
  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isActive = option.key === selected;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onSelect(option.key)}
            activeOpacity={0.8}
          >
            <Text
              variant="bodySmall"
              style={[styles.label, isActive && styles.labelActive]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.text,
  },
  label: {
    fontWeight: '600',
    color: colors.muted,
  },
  labelActive: {
    color: colors.bg,
  },
});
