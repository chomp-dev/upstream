import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import SplashAnimation from '../components/SplashAnimation';
import { Auth0Provider } from 'react-native-auth0';
import { colors } from '../src/theme';
import { AuthProvider } from '../src/context/auth';
import { CommentSheetProvider } from '../src/context/commentSheet';
import * as SplashScreen from 'expo-splash-screen';
import { preloadService } from '../src/lib/preloadService';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

export default function RootLayout() {
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [dataReady, setDataReady] = useState(false);
  const [statusText, setStatusText] = useState('Initializing...');

  // Start preload immediately on mount
  useEffect(() => {
    console.log('[Layout] Starting preload...');
    preloadService.preload(
      (progress) => setPreloadProgress(progress),
      (status) => setStatusText(status)
    ).then((result) => {
      console.log('[Layout] Preload complete:', result);
      setDataReady(true);
      // Hide native splash screen so our custom one can show
      SplashScreen.hideAsync();
    }).catch((error) => {
      console.error('[Layout] Preload error:', error);
      setDataReady(true); // Continue even on error
      SplashScreen.hideAsync();
    });
  }, []);

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

  // Web-specific Auth0 props for token persistence (not supported on native)
  const auth0Props = Platform.OS === 'web' ? {
    cacheLocation: 'localstorage' as const,
    useRefreshTokens: true,
  } : {};

  const wrappedContent = (
    <Auth0Provider
      domain={process.env.EXPO_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!}
      {...auth0Props}
    >
      <AuthProvider>
        <CommentSheetProvider>
          {content}
        </CommentSheetProvider>
      </AuthProvider>
    </Auth0Provider>
  );

  const appWithSplash = (
    <View style={{ flex: 1 }}>
      {wrappedContent}
      {!isSplashComplete && (
        <SplashAnimation
          onComplete={() => setIsSplashComplete(true)}
          progress={preloadProgress}
          dataReady={dataReady}
          minDisplayMs={1000}
          statusText={statusText}
        />
      )}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        {/* Hide Scrollbar Globally on Web */}
        <style type="text/css">{`
          ::-webkit-scrollbar { display: none; }
          body { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
        <View style={styles.mobileWrapper}>
          {appWithSplash}
        </View>
      </View>
    );
  }

  return appWithSplash;
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
