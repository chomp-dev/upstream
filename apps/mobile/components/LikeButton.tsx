import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '../src/context/auth';

export const LikeButton = ({ videoUrl }: { videoUrl: string }) => {
    const { user, supabase: authSupabase, login } = useAuth();
    const [likesCount, setLikesCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);

    // Fetch initial state
    useEffect(() => {
        const fetchLikes = async () => {
            // Get count
            const { data: videoData } = await authSupabase
                .from('videos')
                .select('likes_count')
                .eq('video_url', videoUrl)
                .maybeSingle();

            if (videoData) {
                setLikesCount(videoData.likes_count || 0);
            }

            // Check if user liked
            if (user) {
                const { data: likeData } = await authSupabase
                    .from('video_likes') // make sure this matches the table name
                    .select('*')
                    .eq('video_url', videoUrl)
                    .eq('user_id', user.sub)
                    .maybeSingle();

                setIsLiked(!!likeData);
            }
        };

        fetchLikes();
    }, [videoUrl, user]);

    const toggleLike = async () => {
        if (!user) {
            login();
            return;
        }

        const previousLiked = isLiked;
        const previousCount = likesCount;

        // Optimistic update
        setIsLiked(!previousLiked);
        setLikesCount(previousLiked ? previousCount - 1 : previousCount + 1);

        if (previousLiked) {
            // Unlike
            const { error } = await authSupabase
                .from('video_likes')
                .delete()
                .eq('video_url', videoUrl)
                .eq('user_id', user.sub);

            if (error) {
                console.error('Error unliking:', error);
                // Revert
                setIsLiked(previousLiked);
                setLikesCount(previousCount);
            }
        } else {
            // Like
            const { error } = await authSupabase
                .from('video_likes')
                .insert({
                    video_url: videoUrl,
                    user_id: user.sub
                });

            if (error) {
                console.error('Error liking:', error);
                // Revert
                setIsLiked(previousLiked);
                setLikesCount(previousCount);
            }
        }
    };

    return (
        <TouchableOpacity onPress={toggleLike} style={styles.container} disabled={!user}>
            <Text style={[styles.icon, isLiked && styles.liked]}>
                {isLiked ? '♥' : '♡'}
            </Text>
            <Text style={styles.count}>{likesCount}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    icon: {
        fontSize: 24,
        color: '#333',
        marginRight: 4,
    },
    liked: {
        color: 'red',
    },
    count: {
        fontSize: 16,
        color: '#666',
    },
});
