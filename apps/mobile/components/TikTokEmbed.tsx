import React, { useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking, Platform, AppState } from 'react-native';
import { useContentDimensions } from '../src/hooks/useContentDimensions';
import { Text } from '../src/ui';
import { colors, spacing } from '../src/theme';

// Only import WebView on native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
    WebView = require('react-native-webview').WebView;
}

interface TikTokEmbedProps {
    embedHtml: string;
    thumbnailUrl?: string;
    title?: string;
    authorName?: string;
    tiktokUrl?: string;
    isActive?: boolean;
}

/**
 * TikTokEmbed component renders a TikTok video embed.
 * - Native (iOS/Android): Uses WebView to render the TikTok embed
 * - Web: Shows thumbnail with link to open in TikTok
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

    // Wrap the TikTok embed HTML in a full HTML document for WebView
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { 
            width: 100%; 
            height: 100%; 
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
          }
          .tiktok-embed {
            max-width: 100% !important;
            min-width: 100% !important;
          }
          blockquote {
            max-width: 100% !important;
            min-width: 100% !important;
          }
        </style>
      </head>
      <body>
        ${embedHtml}
      </body>
    </html>
  `;

    const openInTikTok = () => {
        if (tiktokUrl) {
            Linking.openURL(tiktokUrl);
        }
    };

    // Web platform OR no embed HTML: show thumbnail with link to TikTok
    if (Platform.OS === 'web' || !embedHtml) {
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
                    <Text style={styles.watchText}>Watch on TikTok</Text>
                </View>

                {/* Bottom info bar */}
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
            </TouchableOpacity>
        );
    }

    // Native platforms with WebView
    return (
        <View style={[styles.container, { width, height }]}>
            <WebView
                source={{ html: htmlContent }}
                style={[styles.webview, { width, height }]}
                scrollEnabled={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                onError={(e: { nativeEvent: { description?: string } }) => console.log('[TikTokEmbed] WebView error:', e.nativeEvent)}
            />

            {/* TikTok branding overlay */}
            <View style={styles.brandingOverlay}>
                <TouchableOpacity style={styles.tiktokBadgeSmall} onPress={openInTikTok}>
                    <Text style={styles.tiktokBadgeText}>TikTok</Text>
                </TouchableOpacity>
            </View>

            {/* Author info at bottom */}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
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
        backgroundColor: '#000',
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
        backgroundColor: '#000',
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
