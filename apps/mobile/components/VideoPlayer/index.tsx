import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useContentDimensions } from '../../src/hooks/useContentDimensions';
import { MediaOverlay } from '../MediaOverlay';
import { Placeholder } from '../Placeholder';

interface VideoPlayerProps {
    videoId?: string;
    playbackUrl?: string;
    thumbnailUrl?: string;
    isActive: boolean;
}

// Helper to detect iOS Mobile Web
const isIOSMobileWeb = Platform.OS === 'web' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

export function VideoPlayer({
    playbackUrl,
    thumbnailUrl,
    isActive
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
    useEffect(() => {
        if (!player) return;

        if (isActive) {
            player.play();
        } else {
            player.pause();
        }
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
                // @ts-ignore: muted is required for iOS Web autoplay
                muted={true}
            />

            {/* Loading Indicator for initial buffer */}
            {/* Loading Indicator or Play Button Fallback */}
            {isActive && !isPlaying && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    {isIOSMobileWeb ? (
                        <Ionicons name="play-circle-outline" size={64} color="#fff" />
                    ) : (
                        <ActivityIndicator size="large" color="#fff" />
                    )}
                </View>
            )}

            <MediaOverlay height={height} />
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
