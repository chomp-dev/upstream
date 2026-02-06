import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useContentDimensions } from '../src/hooks/useContentDimensions';
import { Text } from '../src/ui';
import { Ionicons } from '@expo/vector-icons';

interface TikTokEmbedProps {
    embedHtml: string;
    thumbnailUrl?: string;
    title?: string;
    authorName?: string;
    tiktokUrl?: string;
    isActive?: boolean;
}

/**
 * TikTokEmbed component renders a TikTok video preview.
 * Uses thumbnail + minimal overlay approach for stability.
 * Opens TikTok app/browser on tap.
 */
export function TikTokEmbed({
    embedHtml,
    thumbnailUrl,
    title,
    authorName,
    tiktokUrl,
    isActive = true,
}: TikTokEmbedProps) {
    const { width, height } = useContentDimensions();

    const openInTikTok = () => {
        if (tiktokUrl) {
            Linking.openURL(tiktokUrl);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, { width, height }]}
            onPress={openInTikTok}
            activeOpacity={0.95}
        >
            {/* Background Thumbnail */}
            {thumbnailUrl ? (
                <Image
                    source={{ uri: thumbnailUrl }}
                    style={[styles.thumbnail, { width, height }]}
                />
            ) : (
                <View style={[styles.placeholder, { width, height }]}>
                    <Ionicons name="musical-notes" size={60} color="#555" />
                </View>
            )}

            {/* Top TikTok branding badge */}
            <View style={styles.topBadge}>
                <View style={styles.tiktokBadge}>
                    <Ionicons name="musical-notes" size={14} color="#fff" />
                    <Text style={styles.tiktokBadgeText}>TikTok</Text>
                </View>
            </View>

            {/* Centered play button - clean, minimal */}
            <View style={styles.playButtonContainer}>
                <View style={styles.playButton}>
                    <Ionicons name="play" size={36} color="#000" style={{ marginLeft: 4 }} />
                </View>
            </View>

            {/* Bottom gradient for text readability */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)']}
                style={styles.bottomGradient}
            />

            {/* Bottom info - author and title */}
            <View style={styles.bottomInfo}>
                {authorName && (
                    <Text style={styles.authorText} numberOfLines={1}>
                        @{authorName}
                    </Text>
                )}
                {title && (
                    <Text style={styles.titleText} numberOfLines={2}>
                        {title}
                    </Text>
                )}
                <View style={styles.tapHint}>
                    <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.tapHintText}>Tap to watch on TikTok</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    thumbnail: {
        resizeMode: 'cover',
        position: 'absolute',
    },
    placeholder: {
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBadge: {
        position: 'absolute',
        top: 60,
        left: 16,
        zIndex: 10,
    },
    tiktokBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 6,
    },
    tiktokBadgeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    playButtonContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
    },
    bottomInfo: {
        position: 'absolute',
        bottom: 60, // Reduced from 100 to be closer to nav bar
        left: 16,
        right: 70,
    },
    authorText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    titleText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        lineHeight: 18,
        marginBottom: 8,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tapHintText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
});

export default TikTokEmbed;

