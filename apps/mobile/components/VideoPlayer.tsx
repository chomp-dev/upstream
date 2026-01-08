import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

const { width, height } = Dimensions.get('window');

interface VideoPlayerProps {
  videoId?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  isActive: boolean;
}

export function VideoPlayer({ 
  playbackUrl, 
  thumbnailUrl, 
  isActive 
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive && playbackUrl) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isActive, playbackUrl]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
      setIsPlaying(status.isPlaying);
    }
  };

  const togglePlayPause = async () => {
    if (videoRef.current) {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await videoRef.current.pauseAsync();
        } else {
          await videoRef.current.playAsync();
        }
      }
    }
  };

  // If no playback URL is available yet, show thumbnail or placeholder
  if (!playbackUrl) {
    return (
      <View style={styles.container}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    );
  }

  // Web platform: use HTML5 video or show thumbnail
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={1}
      onPress={togglePlayPause}
    >
      <Video
        ref={videoRef}
        source={{ uri: playbackUrl }}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={isActive}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        useNativeControls={false}
      />
      
      {/* Show thumbnail + spinner while loading */}
      {!isLoaded && (
        <View style={styles.loadingOverlay}>
          {thumbnailUrl && (
            <Image 
              source={{ uri: thumbnailUrl }} 
              style={styles.thumbnail} 
            />
          )}
          <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width,
    height,
  },
  thumbnail: {
    width,
    height,
    resizeMode: 'cover',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    position: 'absolute',
  },
  placeholder: {
    width,
    height,
    backgroundColor: '#222',
  },
});
