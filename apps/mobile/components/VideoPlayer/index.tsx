import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Platform, AppState } from 'react-native';
import { useContentDimensions } from '../../src/hooks/useContentDimensions';
import { Restaurant } from '../../src/lib/api/types';
import { MediaOverlay } from '../MediaOverlay';
import { Placeholder } from '../Placeholder';

interface VideoPlayerProps {
    videoId?: string;
    playbackUrl?: string;
    thumbnailUrl?: string;
    isActive: boolean;
    restaurant?: Restaurant | null;
    user?: {
        userId?: string;
        username: string;
        avatarUrl: string;
    };
    videoUrl?: string; // Database video_url for social features
    caption?: string; // Title/description to show in overlay
}

// Helper to detect iOS Mobile Web
// Helper to detect iOS Mobile Web
const isIOSMobileWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

export function VideoPlayer({
    videoId,
    playbackUrl,
    thumbnailUrl,
    isActive,
    restaurant,
    user,
    videoUrl,
    caption
}: VideoPlayerProps) {
    const { width, height } = useContentDimensions();

    // Setup player with expo-video hook
    // We only create the player if we have a playbackUrl
    const player = useVideoPlayer(playbackUrl ?? '', (player) => {
        player.loop = true;
        // Mute on Web to allow autoplay
        player.muted = Platform.OS === 'web';

        // On web we might want to start paused
        if (isActive) {
            player.play();
        }
    });

    const [isPlaying, setIsPlaying] = React.useState(false);

    useEffect(() => {
        const sub = player.addListener('playingChange', ({ isPlaying: newIsPlaying }) => {
            setIsPlaying(newIsPlaying);
        });
        return () => sub.remove();
    }, [player]);

    // Handle active state changes
    // Handle active state changes and AppState
    useEffect(() => {
        if (!player) return;

        const handlePlayback = () => {
            if (isActive) {
                // Only play if app is active
                if (AppState.currentState === 'active') {
                    if (!player.playing) {
                        player.play();
                    }
                } else {
                    player.pause();
                }
            } else {
                player.pause();
            }
        };

        // Initial check
        handlePlayback();

        // Listen for AppState changes
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            handlePlayback();
        });

        return () => {
            subscription.remove();
        };
    }, [isActive, player]);

    // If no playback URL is available yet, show thumbnail or placeholder
    if (!playbackUrl) {
        return (
            <View style={[styles.container, { width, height }]}>
                {thumbnailUrl ? (
                    <Image source={{ uri: thumbnailUrl }} style={[styles.thumbnail, { width, height }]} />
                ) : (
                    <Placeholder width={width} height={height} />
                )}
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.container, { width, height }]}
            activeOpacity={1}
            onPress={() => {
                if (player.playing) {
                    player.pause();
                } else {
                    player.play();
                }
            }}
        >
            <VideoView
                player={player}
                style={[styles.video, { width, height }]}
                contentFit="cover"
                nativeControls={false}
                allowsFullscreen={false}
                // @ts-ignore: playsInline is required for iOS Web inline playback
                playsInline
                // @ts-ignore: muted is required for iOS Web autoplay, but we want sound elsewhere
                muted={Platform.OS === 'web'}
            />

            {/* Loading Indicator for initial buffer */}
            {/* Loading Indicator or Play Button Fallback */}
            {isActive && !isPlaying && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    {isIOSMobileWeb ? (
                        <Ionicons name="play-circle-outline" size={64} color="#fff" />
                    ) : (
                        <Ionicons name="play" size={64} color="rgba(255,255,255,0.8)" />
                    )}
                </View>
            )}

            <MediaOverlay height={height} restaurant={restaurant} user={user} videoUrl={videoUrl} caption={caption} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {},
    thumbnail: {
        resizeMode: 'cover',
    },
    placeholder: {
        // backgroundColor: '#222', // Handled by Placeholder component
    },
});
