import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

type TextVariant = 'heading' | 'title' | 'subtitle' | 'body' | 'bodySmall' | 'caption' | 'label';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  center?: boolean;
  bold?: boolean;
  children: React.ReactNode;
}

export function Text({
  variant = 'body',
  color,
  center,
  bold,
  style,
  children,
  ...props
}: TextProps) {
  return (
    <RNText
      style={[
        styles[variant],
        color && { color },
        center && styles.center,
        bold && styles.bold,
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
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
  center: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: '700',
  },
});
