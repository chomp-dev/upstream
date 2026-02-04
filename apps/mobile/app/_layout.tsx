import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';
import SplashAnimation from '../components/SplashAnimation';
import { Auth0Provider } from 'react-native-auth0';
import { colors } from '../src/theme';
import { AuthProvider } from '../src/context/auth';

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

  const wrappedContent = (
    <Auth0Provider
      domain={process.env.EXPO_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!}
    >
      <AuthProvider>
        {content}
      </AuthProvider>
    </Auth0Provider>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.mobileWrapper}>
          {wrappedContent}
        </View>
      </View>
    );
  }

  const [isSplashComplete, setIsSplashComplete] = useState(false);

  // Mobile layout with splash screen overlay
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1 }}>
        {wrappedContent}
        {/* Splash Animation Overlay */}
        {!isSplashComplete && (
          <SplashAnimation onComplete={() => setIsSplashComplete(true)} />
        )}
      </View>
    );
  }

  return wrappedContent;
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
