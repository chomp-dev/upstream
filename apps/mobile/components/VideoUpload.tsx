import React, { useState } from 'react';
import { View, Button, Image, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/context/auth';
import { supabase } from '../src/lib/supabase'; // Public client for type, or use from hook

export const VideoUpload = ({ onUploadComplete }: { onUploadComplete?: () => void }) => {
    const { user, supabase: authSupabase, accessToken } = useAuth();
    const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [uploading, setUploading] = useState(false);
    const [description, setDescription] = useState(''); // Could add a TextInput for this

    const pickVideo = async () => {
        // No permissions request is necessary for launching the image library
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            setVideo(result.assets[0]);
        }
    };

    const uploadVideo = async () => {
        if (!video || !user || !accessToken) return;

        setUploading(true);
        try {
            const fileExt = video.uri.split('.').pop();
            const fileName = `${user.sub}/${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Create FormData
            const formData = new FormData();
            formData.append('file', {
                uri: video.uri,
                name: fileName,
                type: video.mimeType || 'video/mp4',
            } as any);

            // 1. Upload to Storage
            // specific bucket 'videos'
            const { data: storageData, error: storageError } = await authSupabase.storage
                .from('videos')
                .upload(filePath, formData, {
                    contentType: video.mimeType || 'video/mp4',
                });

            if (storageError) throw storageError;

            // 2. Get Public URL
            const { data: { publicUrl } } = authSupabase.storage
                .from('videos')
                .getPublicUrl(filePath);

            // 3. Insert into Database
            const { error: dbError } = await authSupabase
                .from('posts')
                .insert({
                    playback_url: publicUrl,
                    user_id: user.sub, // Using Auth0 ID
                    description: description || 'No description',
                    title: 'My Video', // Could add title input
                    post_type: 'video',
                    status: 'ready' // Direct Supabase storage is ready immediately
                });

            if (dbError) throw dbError;

            Alert.alert('Success', 'Video uploaded successfully!');
            setVideo(null);
            if (onUploadComplete) onUploadComplete();

        } catch (error: any) {
            console.error('Upload Error:', error);
            Alert.alert('Upload Failed', error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Button title="Pick a Video" onPress={pickVideo} disabled={uploading} />
            {video && (
                <View style={styles.previewContainer}>
                    <Text style={styles.previewText}>Selected: {video.fileName || 'Video'}</Text>
                    {/* Could show thumbnail if generated */}
                    <Button title={uploading ? "Uploading..." : "Upload Video"} onPress={uploadVideo} disabled={uploading} />
                </View>
            )}
            {uploading && <ActivityIndicator size="small" color="#0000ff" />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
    },
    previewContainer: {
        marginTop: 20,
        alignItems: 'center',
        gap: 10,
    },
    previewText: {
        marginBottom: 10,
    },
});
