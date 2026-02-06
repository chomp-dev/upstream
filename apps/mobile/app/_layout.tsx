import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Auth0Provider } from 'react-native-auth0';
import { colors } from '../src/theme';
import { AuthProvider } from '../src/context/auth';
import { CommentSheetProvider } from '../src/context/commentSheet';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from 'react-error-boundary';

// Hide native splash immediately
SplashScreen.hideAsync().catch(() => { });

// Error fallback component
function ErrorFallback({ error }: { error: Error }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>⚠️ App Error</Text>
      <Text style={styles.errorMessage}>
        The app encountered an error but we caught it!
        {'\n\n'}
        Error: {error.message}
        {'\n\n'}
        Please close and reopen the app to try again.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const content = (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'none', // Disable all animations to avoid Reanimated
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
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('[ErrorBoundary] Caught error:', error);
      }}
    >
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
    </ErrorBoundary>
  );

  if (Platform.OS === 'web') {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
          <title>Chomp</title>
        </head>
        <body style={{ margin: 0, padding: 0 }}>
          <div id="root" style={{ height: '100vh', width: '100vw' }}>
            {wrappedContent}
          </div>
        </body>
      </html>
    );
  }

  return wrappedContent;
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
  },
});
