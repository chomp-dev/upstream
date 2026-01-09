import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { colors } from '../src/theme';

export default function RootLayout() {
  const content = (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.mobileWrapper}>
          {content}
        </View>
      </View>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileWrapper: {
    width: '100%',
    maxWidth: 500,
    height: '100%',
    backgroundColor: colors.bg,
    // Add shadow for depth on desktop
    ...Platform.select({
      web: {
        boxShadow: '0 0 40px rgba(0,0,0,0.5)',
      },
    }),
  },
});
