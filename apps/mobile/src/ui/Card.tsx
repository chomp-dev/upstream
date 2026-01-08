import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, shadows } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  /** Left accent stripe color */
  accentColor?: string;
  /** Whether to show accent stripe */
  showAccent?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  accentColor,
  showAccent = false,
}: CardProps) {
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.8 } : {};

  return (
    <Container style={[styles.card, style]} {...containerProps}>
      {showAccent && (
        <View style={[styles.accent, { backgroundColor: accentColor || colors.primary }]} />
      )}
      <View style={[styles.content, showAccent && styles.contentWithAccent]}>
        {children}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.md,
  },
  accent: {
    width: 4,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  contentWithAccent: {
    paddingLeft: spacing.md,
  },
});
