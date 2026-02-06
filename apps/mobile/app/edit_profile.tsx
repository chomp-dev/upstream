
import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image as RNImage } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { Screen, Text } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';
import { useAuth } from '../src/context/auth';
import { getImageUploadUrl, uploadImageToCloudflare } from '../src/lib/api/media';

export default function EditProfileScreen() {
    const router = useRouter();
    const { user, supabase, accessToken } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;

        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth0_id', user.sub)
                    .maybeSingle();

                if (error) {
                    console.error('Error fetching profile:', error);
                    // Fallback to Auth0 data
                    setName(user.name || '');
                    setAvatarUrl(user.picture || null);
                } else if (data) {
                    setName(data.name || user.name || '');
                    setBio(data.bio || '');
                    setAvatarUrl(data.avatar || user.picture || null);
                }
            } catch (e) {
                console.error('Profile fetch error:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user, supabase]);

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                // Upload immediately or wait for save? 
                // Better to upload on "Save" to avoid orphaned images? 
                // Or upload now and show preview? 
                // Let's upload now and update state to the new URL, but only commit to DB on save.
                // Actually, for better UX, showing preview is good. 
                // We will store the local URI in a temp state or just handle it during save?
                // Let's try to upload immediately to get the URL, so "Save" is fast for text.
                // But if they cancel, we uploaded for nothing. 
                // Let's settle on: Upload immediately, update avatarUrl. If they don't save, DB isn't updated.

                await uploadNewAvatar(asset.uri);
            }
        } catch (e) {
            console.error('Image picker error:', e);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadNewAvatar = async (uri: string) => {
        try {
            setSaving(true); // blocking UI while uploading

            // 1. Get Upload URL
            const { uploadURL, deliveryUrl } = await getImageUploadUrl();

            // 2. Upload to Cloudflare
            await uploadImageToCloudflare(uploadURL, uri);

            // 3. Update local state with the new delivery URL
            setAvatarUrl(deliveryUrl);

        } catch (e) {
            console.error('Avatar upload failed:', e);
            Alert.alert('Error', 'Failed to upload image. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        try {
            setSaving(true);
            console.log('[Profile] Saving with auth0_id:', user.sub);
            console.log('[Profile] Has access token:', !!accessToken);
            console.log('[Profile] Token preview:', accessToken?.substring(0, 20) + '...');

            // Use upsert with onConflict to handle both create and update cases
            const { data, error } = await supabase
                .from('users')
                .upsert({
                    auth0_id: user.sub,
                    email: user.email || '',
                    name: name,
                    bio: bio,
                    avatar: avatarUrl,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'auth0_id',
                })
                .select();

            console.log('[Profile] Upsert response:', { data, error });

            if (error) {
                console.error('[Profile] Upsert error:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn('[Profile] No data returned from upsert - RLS might be blocking');
                // Even if no data returned, the operation may have succeeded
                // The RLS policy might block SELECT but allow INSERT/UPDATE
            }

            // Success - navigate back
            router.back();

        } catch (e) {
            console.error('[Profile] Save error:', e);
            Alert.alert('Error', 'Failed to save profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Screen safe>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen safe>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#eeb57e" />
                </TouchableOpacity>
                <Text variant="title">Edit Profile</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                {/* Avatar Section */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Ionicons name="person" size={40} color={colors.muted} />
                            </View>
                        )}
                        <View style={styles.cameraIcon}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePickImage}>
                        <Text variant="bodySmall" color={colors.primary} style={styles.changePhotoText}>
                            Change Photo
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Form Inputs */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text variant="label" color={colors.muted} style={styles.label}>
                            Username (Name)
                        </Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Your name"
                            placeholderTextColor={colors.muted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text variant="label" color={colors.muted} style={styles.label}>
                            Bio
                        </Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell us about yourself..."
                            placeholderTextColor={colors.muted}
                            multiline
                            textAlignVertical="top"
                            maxLength={150}
                        />
                        <Text variant="caption" color={colors.muted} style={styles.charCount}>
                            {bio.length}/150
                        </Text>
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.bg} />
                    ) : (
                        <Text variant="subtitle" color={colors.bg}>Save Profile</Text>
                    )}
                </TouchableOpacity>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Center the title
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: spacing.sm,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.bg,
    },
    changePhotoText: {
        fontWeight: '600',
    },
    form: {
        gap: spacing.lg,
    },
    inputGroup: {
        gap: spacing.xs,
    },
    label: {
        marginBottom: 4,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    textArea: {
        height: 100,
        paddingTop: spacing.md,
    },
    charCount: {
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    saveButton: {
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
});
