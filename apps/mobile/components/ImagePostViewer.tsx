import { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useContentDimensions } from '../src/hooks/useContentDimensions';
import { MediaOverlay } from './MediaOverlay';
import { Placeholder } from './Placeholder';

interface ImagePostViewerProps {
  images: string[];
}

export function ImagePostViewer({ images }: ImagePostViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const { width, height } = useContentDimensions();

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  if (images.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Placeholder width={width} height={height} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {images.map((imageUri, index) => {
          if (Platform.OS === 'web' && imageUri?.startsWith('file://')) {
            console.warn('[ImagePostViewer] Invalid Local URI detected on Web:', imageUri);
          }
          const isWebFileError = Platform.OS === 'web' && (imageUri?.startsWith('file://') || false);

          if (isWebFileError) {
            return (
              <View key={index} style={[styles.errorContainer, { width, height }]}>
                <Ionicons name="sad-outline" size={80} color="#444" />
                <Text style={styles.errorText}>Image Unavailable</Text>
              </View>
            );
          }

          return (
            <Image
              key={index}
              source={{ uri: imageUri }}
              style={{ width, height }}
              contentFit="cover"
              transition={200}
              onError={(e) => console.warn('[ImagePostViewer] Load Error:', e.error)}
            />
          );
        })}
      </ScrollView>

      <MediaOverlay height={height} />

      {/* Indicator dots */}
      <View style={styles.indicatorContainer}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              index === currentIndex && styles.indicatorActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  placeholder: {
    // backgroundColor: '#222', // Handled by Placeholder component
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  indicatorActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  errorContainer: {
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#444',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
