import React, { useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/auth';
import { Text } from '../src/ui';

interface SaveButtonProps {
    videoUrl?: string;
    imagePostId?: number;
    size?: number;
    showCount?: boolean;
    style?: object;
}

export const SaveButton = ({
    videoUrl,
    imagePostId,
    size = 32,
    showCount = true,
    style
}: SaveButtonProps) => {
    const { user, supabase, login } = useAuth();
    const [isSaved, setIsSaved] = useState(false);
    const [savesCount, setSavesCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // Fetch initial state
    useEffect(() => {
        const fetchSaveState = async () => {
            if (!user) return;

            try {
                // Check if user saved this item
                let query = supabase
                    .from('saves')
                    .select('*')
                    .eq('user_id', user.sub);

                if (videoUrl) {
                    query = query.eq('video_url', videoUrl);
                } else if (imagePostId) {
                    query = query.eq('image_post_id', imagePostId);
                } else {
                    return;
                }

                const { data } = await query.maybeSingle();
                setIsSaved(!!data);

                // Get total saves count
                let countQuery = supabase
                    .from('saves')
                    .select('id', { count: 'exact', head: true });

                if (videoUrl) {
                    countQuery = countQuery.eq('video_url', videoUrl);
                } else if (imagePostId) {
                    countQuery = countQuery.eq('image_post_id', imagePostId);
                }

                const { count } = await countQuery;
                setSavesCount(count || 0);
            } catch (err) {
                // Save might not exist yet, that's fine
            }
        };

        fetchSaveState();
    }, [videoUrl, imagePostId, user, supabase]);

    const toggleSave = async () => {
        console.log('SaveButton pressed, user:', user?.sub);
        if (!user) {
            console.log('User not logged in, triggering login');
            login();
            return;
        }

        if (loading) return;
        setLoading(true);

        const previousSaved = isSaved;
        const previousCount = savesCount;

        // Optimistic update
        setIsSaved(!previousSaved);
        setSavesCount(previousSaved ? previousCount - 1 : previousCount + 1);

        try {
            if (previousSaved) {
                // Unsave
                let query = supabase
                    .from('saves')
                    .delete()
                    .eq('user_id', user.sub);

                if (videoUrl) {
                    query = query.eq('video_url', videoUrl);
                } else if (imagePostId) {
                    query = query.eq('image_post_id', imagePostId);
                }

                const { error } = await query;
                if (error) throw error;
            } else {
                // Save
                const insertData: any = { user_id: user.sub };
                if (videoUrl) {
                    insertData.video_url = videoUrl;
                } else if (imagePostId) {
                    insertData.image_post_id = imagePostId;
                }

                const { error } = await supabase
                    .from('saves')
                    .insert(insertData);

                if (error) throw error;
            }
        } catch (err) {
            console.error('Error toggling save:', err);
            // Revert
            setIsSaved(previousSaved);
            setSavesCount(previousCount);
        } finally {
            setLoading(false);
        }
    };

    const formatCount = (count: number): string => {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    };

    return (
        <TouchableOpacity
            onPress={toggleSave}
            style={[styles.container, style]}
            disabled={loading}
            activeOpacity={0.7}
        >
            <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={size}
                color={isSaved ? '#FBBF24' : 'white'}
                style={styles.shadowIcon}
            />
            {showCount && (
                <Text style={styles.count}>{formatCount(savesCount)}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        gap: 4,
    },
    shadowIcon: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4, // Android shadow
    },
    count: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
});
