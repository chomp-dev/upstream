import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, ScrollView, ActivityIndicator, Button } from 'react-native';
import { useAuth } from '../src/context/auth';
import { VideoUpload } from '../components/VideoUpload';
import { router } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { LikeButton } from '../components/LikeButton';
import { CommentSection } from '../components/CommentSection';

interface UserProfile {
    name: string;
    email: string;
    bio: string;
    avatar: string;
}

interface VideoItem {
    video_url: string;
    title: string;
    description: string;
    likes_count: number;
}

export default function ProfileScreen() {
    const { user, logout, supabase: authSupabase } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            // Redirect or show login
            // router.replace('/'); 
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Profile
                const { data: userData, error: userError } = await authSupabase
                    .from('users')
                    .select('name, email, bio, avatar')
                    .eq('auth0_id', user.sub)
                    .single();

                if (userData) {
                    setProfile(userData);
                } else {
                    console.log("User fetch error:", userError);
                }

                // 2. Fetch Videos
                const { data: videoData, error: videoError } = await authSupabase
                    .from('videos')
                    .select('*')
                    .eq('user_id', user.sub)
                    .order('created_at', { ascending: false });

                if (videoData) {
                    setVideos(videoData);
                }

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (!user) {
        return (
            <View style={styles.container}>
                <Text>Please log in to view your profile.</Text>
                <Button title="Go Home" onPress={() => router.replace('/')} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            {loading ? (
                <ActivityIndicator size="large" />
            ) : (
                <>
                    <View style={styles.header}>
                        <Image
                            source={{ uri: profile?.avatar || user.picture }}
                            style={styles.avatar}
                        />
                        <Text style={styles.name}>{profile?.name || user.name}</Text>
                        <Text style={styles.email}>{profile?.email || user.email}</Text>
                        {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
                        <Button title="Sign Out" onPress={() => { logout(); router.replace('/'); }} color="red" />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Upload New Video</Text>
                        <VideoUpload onUploadComplete={() => { /* refresh videos needed */ }} />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>My Videos</Text>
                        {videos.length === 0 ? (
                            <Text style={{ textAlign: 'center', marginVertical: 20 }}>No videos yet.</Text>
                        ) : (
                            videos.map((vid) => (
                                <View key={vid.video_url} style={styles.videoCard}>
                                    <Video
                                        style={styles.video}
                                        source={{ uri: vid.video_url }}
                                        useNativeControls
                                        resizeMode={ResizeMode.CONTAIN}
                                        isLooping={false}
                                    />
                                    <View style={styles.videoMeta}>
                                        <Text style={styles.videoTitle}>{vid.title || 'Untitled'}</Text>
                                        <LikeButton videoUrl={vid.video_url} />
                                    </View>
                                    <Text style={styles.videoDesc}>{vid.description}</Text>

                                    {/* 
                            Note: showing full comments on profile might be too much, 
                            usually you'd tap to view details. But per request listing components/logic.
                        */}
                                    <View style={{ marginTop: 10 }}>
                                        <Text style={{ fontWeight: 'bold' }}>Comments</Text>
                                        <CommentSection videoUrl={vid.video_url} />
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 10,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    email: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
    },
    bio: {
        fontSize: 16,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    videoCard: {
        marginBottom: 30,
        backgroundColor: '#f9f9f9',
        borderRadius: 10,
        padding: 10,
    },
    video: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        backgroundColor: '#000',
    },
    videoMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    videoTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
    },
    videoDesc: {
        color: '#444',
        marginVertical: 5,
    },
});
