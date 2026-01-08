import React from 'react';
import { View, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Whether to use safe area insets */
  safe?: boolean;
  /** Which edges to apply safe area to */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Additional style */
  style?: ViewStyle;
  /** Background color override */
  backgroundColor?: string;
}

export function Screen({
  children,
  safe = true,
  edges = ['top'],
  style,
  backgroundColor = colors.bg,
}: ScreenProps) {
  const containerStyle = [styles.container, { backgroundColor }, style];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      {safe ? (
        <SafeAreaView style={containerStyle} edges={edges}>
          {children}
        </SafeAreaView>
      ) : (
        <View style={containerStyle}>
          {children}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
