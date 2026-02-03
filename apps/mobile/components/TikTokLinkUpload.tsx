import React, { useState } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
    Keyboard,
} from 'react-native';
import { Text } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';
import { mediaApi } from '../src/lib/api';

interface TikTokLinkUploadProps {
    onUploadComplete?: () => void;
    googlePlaceId?: string;
}

/**
 * TikTokLinkUpload - Simple UI for pasting a TikTok link to add to the feed.
 */
export function TikTokLinkUpload({ onUploadComplete, googlePlaceId }: TikTokLinkUploadProps) {
    const [tiktokUrl, setTiktokUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!tiktokUrl.trim()) {
            Alert.alert('Error', 'Please paste a TikTok link');
            return;
        }

        if (!tiktokUrl.includes('tiktok.com')) {
            Alert.alert('Error', 'Please enter a valid TikTok URL');
            return;
        }

        Keyboard.dismiss();
        setLoading(true);

        try {
            const response = await mediaApi.addTikTokEmbed(tiktokUrl, googlePlaceId);

            if (response.success) {
                Alert.alert('Success!', 'TikTok video added to feed');
                setTiktokUrl('');
                onUploadComplete?.();
            } else {
                throw new Error('Failed to add TikTok');
            }
        } catch (error: any) {
            console.error('[TikTokUpload] Error:', error);
            Alert.alert('Error', error.message || 'Failed to add TikTok video');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text variant="subtitle" style={styles.title}>
                🎵 Share a TikTok
            </Text>
            <Text variant="caption" color={colors.muted} style={styles.subtitle}>
                Paste any TikTok video link to add it to the feed
            </Text>

            <TextInput
                style={styles.input}
                placeholder="https://www.tiktok.com/@user/video/..."
                placeholderTextColor={colors.muted}
                value={tiktokUrl}
                onChangeText={setTiktokUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!loading}
            />

            <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size="small" color={colors.bg} />
                ) : (
                    <Text variant="body" color={colors.bg} style={styles.buttonText}>
                        Add to Feed
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: spacing.lg,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        margin: spacing.md,
    },
    title: {
        marginBottom: spacing.xs,
    },
    subtitle: {
        marginBottom: spacing.md,
    },
    input: {
        backgroundColor: colors.bg,
        borderRadius: radius.md,
        padding: spacing.md,
        color: colors.text,
        fontSize: 14,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontWeight: '600',
    },
});

export default TikTokLinkUpload;
