import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/auth';
import { Text } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';
import { Image } from 'expo-image';

interface Comment {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    user?: {
        name: string;
        avatar: string;
    };
}

interface CommentSheetProps {
    videoUrl: string;
    onClose: () => void;
    visible: boolean;
}

export const CommentSheet = ({ videoUrl, onClose, visible }: CommentSheetProps) => {
    const { user, supabase, login } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [posting, setPosting] = useState(false);

    const fetchComments = useCallback(async () => {
        if (!visible) return;

        setLoading(true);
        try {
            // Fetch comments with user info
            const { data, error } = await supabase
                .from('comments')
                .select(`
                    id,
                    content,
                    user_id,
                    created_at
                `)
                .eq('video_url', videoUrl)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch user details for comments
            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(c => c.user_id))];
                const { data: users } = await supabase
                    .from('users')
                    .select('auth0_id, name, avatar')
                    .in('auth0_id', userIds);

                const userMap: Record<string, { name: string; avatar: string }> = {};
                users?.forEach(u => {
                    userMap[u.auth0_id] = { name: u.name || 'User', avatar: u.avatar || '' };
                });

                setComments(data.map(c => ({
                    ...c,
                    user: userMap[c.user_id] || { name: 'User', avatar: '' }
                })));
            } else {
                setComments([]);
            }
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setLoading(false);
        }
    }, [videoUrl, visible, supabase]);

    useEffect(() => {
        if (visible) {
            fetchComments();
        }
    }, [visible, fetchComments]);

    const postComment = async () => {
        if (!newComment.trim() || !user || posting) return;

        setPosting(true);
        const commentText = newComment.trim();
        setNewComment('');

        try {
            const { error } = await supabase
                .from('comments')
                .insert({
                    video_url: videoUrl,
                    user_id: user.sub,
                    content: commentText,
                });

            if (error) throw error;

            // Add to local state optimistically
            const newCommentItem: Comment = {
                id: Date.now().toString(),
                content: commentText,
                user_id: user.sub,
                created_at: new Date().toISOString(),
                user: { name: user.name || 'You', avatar: user.picture || '' },
            };
            setComments(prev => [newCommentItem, ...prev]);
        } catch (err) {
            console.error('Error posting comment:', err);
            setNewComment(commentText); // Restore on error
        } finally {
            setPosting(false);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return 'now';
    };

    if (!visible) return null;

    return (
        <View style={styles.container} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
                <Text variant="subtitle" style={styles.title}>
                    {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Comments List */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={comments}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.commentItem}>
                            {item.user?.avatar ? (
                                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarInitial}>
                                        {item.user?.name?.[0]?.toUpperCase() || 'U'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.commentContent}>
                                <View style={styles.commentHeader}>
                                    <Text variant="caption" style={styles.username}>
                                        {item.user?.name || 'User'}
                                    </Text>
                                    <Text variant="caption" color={colors.muted}>
                                        {formatTime(item.created_at)}
                                    </Text>
                                </View>
                                <Text variant="body" style={styles.commentText}>
                                    {item.content}
                                </Text>
                            </View>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text variant="body" color={colors.muted} center>
                                No comments yet
                            </Text>
                            <Text variant="caption" color={colors.muted} center>
                                Be the first to comment!
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={100}
            >
                <View style={styles.inputContainer}>
                    {user ? (
                        <>
                            <TextInput
                                style={styles.input}
                                value={newComment}
                                onChangeText={setNewComment}
                                placeholder="Add a comment..."
                                placeholderTextColor={colors.muted}
                                multiline
                                maxLength={500}
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
                                onPress={postComment}
                                disabled={!newComment.trim() || posting}
                            >
                                {posting ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <Ionicons
                                        name="send"
                                        size={20}
                                        color={newComment.trim() ? colors.primary : colors.muted}
                                    />
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity onPress={login} style={styles.loginHint}>
                            <Text variant="body" color={colors.muted}>
                                Sign in to comment
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
        backgroundColor: colors.card,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        overflow: 'hidden',
    },
    touchTrap: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    closeButton: {
        position: 'absolute',
        right: spacing.md,
        padding: spacing.xs,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: spacing.md,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: spacing.sm,
    },
    avatarPlaceholder: {
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 2,
    },
    username: {
        fontWeight: '600',
        color: colors.text,
    },
    commentText: {
        color: colors.text,
    },
    emptyContainer: {
        paddingVertical: spacing.xxl,
        alignItems: 'center',
        gap: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    input: {
        flex: 1,
        backgroundColor: colors.bg,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.text,
        maxHeight: 100,
    },
    sendButton: {
        marginLeft: spacing.sm,
        padding: spacing.sm,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    loginHint: {
        flex: 1,
        textAlign: 'center',
        paddingVertical: spacing.sm,
    },
});
