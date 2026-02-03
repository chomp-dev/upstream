import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
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
 * TikTokEmbed component renders a TikTok video embed using WebView.
 * Falls back to thumbnail + link if WebView is unavailable.
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

    // If no embed HTML, show thumbnail fallback
    if (!embedHtml) {
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
                        <Text style={styles.tiktokIcon}>🎵</Text>
                    </View>
                )}
                <View style={styles.overlay}>
                    <View style={styles.tiktokBadge}>
                        <Text style={styles.tiktokLogo}>TikTok</Text>
                    </View>
                    {title && (
                        <Text variant="body" numberOfLines={2} style={styles.title}>
                            {title}
                        </Text>
                    )}
                    {authorName && (
                        <Text variant="caption" color={colors.muted}>
                            @{authorName}
                        </Text>
                    )}
                    <Text variant="caption" color={colors.primary} style={styles.tapHint}>
                        Tap to open in TikTok
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

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
                <TouchableOpacity style={styles.tiktokBadge} onPress={openInTikTok}>
                    <Text style={styles.tiktokLogo}>TikTok</Text>
                </TouchableOpacity>
            </View>

            {/* Author info at bottom */}
            {(title || authorName) && (
                <View style={styles.infoOverlay}>
                    {title && (
                        <Text variant="bodySmall" numberOfLines={2} style={styles.title}>
                            {title}
                        </Text>
                    )}
                    {authorName && (
                        <Text variant="caption" color={colors.muted}>
                            @{authorName}
                        </Text>
                    )}
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
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tiktokIcon: {
        fontSize: 64,
    },
    overlay: {
        position: 'absolute',
        bottom: 120,
        left: spacing.lg,
        right: spacing.lg,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.xs,
    },
    brandingOverlay: {
        position: 'absolute',
        top: 80,
        right: spacing.lg,
    },
    tiktokBadge: {
        backgroundColor: '#000',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#fff',
    },
    tiktokLogo: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    infoOverlay: {
        position: 'absolute',
        bottom: 120,
        left: spacing.lg,
        right: spacing.lg,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.xs,
    },
    title: {
        color: '#fff',
    },
    tapHint: {
        marginTop: spacing.sm,
    },
});

export default TikTokEmbed;
