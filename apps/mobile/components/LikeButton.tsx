import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '../src/context/auth';

export const LikeButton = ({ postId }: { postId: number }) => {
    const { user, supabase: authSupabase } = useAuth();
    const [likesCount, setLikesCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);

    // Fetch initial state
    useEffect(() => {
        const fetchLikes = async () => {
            if (!postId) return;

            // Get count from posts table
            const { data: postData } = await authSupabase
                .from('posts')
                .select('likes_count')
                .eq('id', postId)
                .single();

            if (postData) {
                setLikesCount(postData.likes_count || 0);
            }

            // Check if user liked
            if (user) {
                const { data: likeData } = await authSupabase
                    .from('post_likes')
                    .select('*')
                    .eq('post_id', postId)
                    .eq('user_id', user.sub)
                    .single();

                setIsLiked(!!likeData);
            }
        };

        fetchLikes();
    }, [postId, user]);

    const toggleLike = async () => {
        if (!user || !postId) return; // Or show login prompt

        const previousLiked = isLiked;
        const previousCount = likesCount;

        // Optimistic update
        setIsLiked(!previousLiked);
        setLikesCount(previousLiked ? previousCount - 1 : previousCount + 1);

        if (previousLiked) {
            // Unlike
            const { error } = await authSupabase
                .from('post_likes')
                .delete()
                .eq('post_id', postId)
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
                .from('post_likes')
                .insert({
                    post_id: postId,
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

