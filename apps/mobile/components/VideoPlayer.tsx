import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image, Platform, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive && playbackUrl) {
        videoRef.current.playAsync().catch(() => {
          setHasError(true);
        });
      } else {
        videoRef.current.pauseAsync().catch(() => {});
      }
    }
  }, [isActive, playbackUrl]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
      setIsPlaying(status.isPlaying);
      setHasError(false);
    } else if ('error' in status && status.error) {
      // Silently mark as error - video likely deleted from Cloudflare
      setHasError(true);
      setIsLoaded(false);
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

  // Show error state if video failed to load
  if (hasError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Video Unavailable</Text>
          <Text style={styles.errorText}>This video may have been deleted or is no longer available</Text>
        </View>
      </View>
    );
  }

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

      {/* Reel Overlay UI */}
      {isLoaded && (
        <>
          {/* Bottom gradient for readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* Right side action buttons */}
          <View style={styles.rightActions}>
            {/* Profile picture */}
            <TouchableOpacity activeOpacity={0.8}>
              <Image 
                source={{ uri: 'https://i.pravatar.cc/100?img=12' }}
                style={styles.avatar}
              />
            </TouchableOpacity>

            {/* Like button */}
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <View style={styles.iconCircle}>
                <Text style={styles.actionIcon}>♥</Text>
              </View>
              <Text style={styles.actionCount}>24K</Text>
            </TouchableOpacity>

            {/* Comment button */}
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <View style={styles.iconCircle}>
                <Text style={styles.actionIcon}>💬</Text>
              </View>
              <Text style={styles.actionCount}>832</Text>
            </TouchableOpacity>

            {/* Bookmark button */}
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <View style={styles.iconCircle}>
                <Text style={styles.actionIcon}>⭐</Text>
              </View>
            </TouchableOpacity>

            {/* Share button */}
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <View style={styles.iconCircle}>
                <Text style={styles.actionIcon}>⤴</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom left content info */}
          <View style={styles.bottomContent}>
            {/* Username */}
            <View style={styles.userRow}>
              <Image 
                source={{ uri: 'https://i.pravatar.cc/100?img=12' }}
                style={styles.userAvatar}
              />
              <TouchableOpacity activeOpacity={0.8}>
                <Text style={styles.username}>@foodie_explorer</Text>
              </TouchableOpacity>
            </View>

            {/* Caption */}
            <Text style={styles.caption} numberOfLines={2}>
              Best burger in Chicago! 🍔 The vibes here are immaculate
            </Text>

            {/* Audio info */}
            <View style={styles.audioInfo}>
              <View style={styles.audioIcon}>
                <Text style={styles.audioEmoji}>♪</Text>
              </View>
              <Text style={styles.audioText} numberOfLines={1}>
                Original Audio
              </Text>
            </View>
          </View>
        </>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1a1a1a',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Overlay styles
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
    gap: 24,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 4,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  actionIcon: {
    fontSize: 22,
    color: '#fff',
  },
  actionCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 90,
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  username: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 19,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  audioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  audioIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioEmoji: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  audioText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
