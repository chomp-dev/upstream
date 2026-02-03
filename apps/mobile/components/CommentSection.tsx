import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../src/context/auth';

interface Comment {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    // Could join user name if needed, but for now showing raw or fetching
}

export const CommentSection = ({ videoUrl }: { videoUrl: string }) => {
    const { user, supabase: authSupabase } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchComments = async () => {
        const { data, error } = await authSupabase
            .from('comments')
            .select('*')
            .eq('video_url', videoUrl)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching comments:', error);
        } else {
            setComments(data || []);
        }
    };

    useEffect(() => {
        fetchComments();

        // Optional: Realtime subscription could go here
    }, [videoUrl]);

    const postComment = async () => {
        if (!newComment.trim() || !user) return;
        setLoading(true);

        const { error } = await authSupabase
            .from('comments')
            .insert({
                video_url: videoUrl, // Make sure this matches the PK in videos table
                user_id: user.sub,
                content: newComment.trim(),
            });

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setNewComment('');
            fetchComments(); // Refresh comments
        }
        setLoading(false);
    };

    const deleteComment = async (commentId: string) => {
        const { error } = await authSupabase
            .from('comments')
            .delete()
            .eq('id', commentId);
        // RLS ensures only owner can delete, but we double check in UI too

        if (error) {
            // If RLS denies, Supabase returns error or empty array depending on policy (usually 401/403 equivalent)
            // With RLS "policy_check" it might silent fail or return error. 
            // Postgres triggers might raise exception.
            Alert.alert('Permission Denied', 'You cannot delete this comment.');
        } else {
            fetchComments();
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Comments</Text>

            {user ? (
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Add a comment..."
                        value={newComment}
                        onChangeText={setNewComment}
                    />
                    <Button title={loading ? "..." : "Post"} onPress={postComment} disabled={loading} />
                </View>
            ) : (
                <Text style={styles.loginHint}>Log in to comment</Text>
            )}

            <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                        <View style={styles.commentContent}>
                            <Text style={styles.commentText}>{item.content}</Text>
                            <Text style={styles.commentMeta}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
                        {user && user.sub === item.user_id && (
                            <TouchableOpacity onPress={() => deleteComment(item.id)}>
                                <Text style={styles.deleteText}>Delete</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    inputContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 8,
        marginRight: 8,
    },
    loginHint: {
        fontStyle: 'italic',
        color: '#666',
        marginBottom: 10,
    },
    commentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    commentContent: {
        flex: 1,
    },
    commentText: {
        fontSize: 14,
    },
    commentMeta: {
        fontSize: 10,
        color: '#999',
        marginTop: 4,
    },
    deleteText: {
        color: 'red',
        fontSize: 12,
        marginLeft: 8,
    },
});
