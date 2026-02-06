import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { useContentDimensions } from '../src/hooks/useContentDimensions';
import { Text } from '../src/ui';
import { colors, spacing } from '../src/theme';

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
 * Uses thumbnail + link approach on all platforms for stability.
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

    // Always use thumbnail approach for stability (no WebView crashes)
    return (
        <TouchableOpacity
            style={[styles.container, { width, height }]}
            onPress={openInTikTok}
            activeOpacity={0.9}
        >
            {thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} style={[styles.thumbnail, { width, height }]} />
            ) : (
                <View style={[styles.placeholder, { width, height }]}>
                    <Text style={styles.tiktokIconLarge}>🎵</Text>
                </View>
            )}

            {/* Dark gradient overlay */}
            <View style={styles.gradientOverlay} />

            {/* Centered Play Button with TikTok Logo */}
            <View style={styles.centerPlayContainer}>
                <View style={styles.playButton}>
                    <Text style={styles.playIcon}>▶</Text>
                </View>
                <View style={styles.tiktokLogoContainer}>
                    <Text style={styles.tiktokLogoText}>TikTok</Text>
                </View>
                <Text style={styles.watchText}>Tap to watch on TikTok</Text>
            </View>

            {/* Bottom info bar */}
            {(title || authorName) && (
                <View style={styles.bottomBar}>
                    <View style={styles.bottomContent}>
                        {authorName && (
                            <Text variant="body" style={styles.authorText}>
                                @{authorName}
                            </Text>
                        )}
                        {title && (
                            <Text variant="caption" numberOfLines={2} style={styles.titleText}>
                                {title}
                            </Text>
                        )}
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f7f6f1',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    webview: {
        backgroundColor: 'transparent',
    },
    thumbnail: {
        resizeMode: 'cover',
    },
    placeholder: {
        backgroundColor: '#121212',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tiktokIconLarge: {
        fontSize: 80,
    },
    gradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    centerPlayContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderWidth: 3,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    playIcon: {
        color: '#fff',
        fontSize: 32,
        marginLeft: 4, // Optical alignment for play icon
    },
    tiktokLogoContainer: {
        backgroundColor: '#f7f6f1',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        marginBottom: spacing.sm,
    },
    tiktokLogoText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    watchText: {
        color: '#fff',
        fontSize: 14,
        opacity: 0.9,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.lg,
    },
    bottomContent: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.xs,
    },
    authorText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    titleText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    brandingOverlay: {
        position: 'absolute',
        top: 80,
        right: spacing.lg,
    },
    tiktokBadgeSmall: {
        backgroundColor: '#f7f6f1',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#fff',
    },
    tiktokBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
});

export default TikTokEmbed;
