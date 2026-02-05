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
    TouchableWithoutFeedback,
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
        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.container} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onTouchEnd={(e) => e.stopPropagation()}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>
                        Comments
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Comments List */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                ) : (
                    <FlatList
                        data={comments}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.commentItem}>
                                {/* Avatar */}
                                {item.user?.avatar ? (
                                    <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                        <Text style={styles.avatarInitial}>
                                            {item.user?.name?.[0]?.toUpperCase() || 'U'}
                                        </Text>
                                    </View>
                                )}

                                {/* Content */}
                                <View style={styles.commentContent}>
                                    <Text style={styles.commentTextLine}>
                                        <Text style={styles.username}>
                                            {item.user?.name || 'User'}{'  '}
                                        </Text>
                                        <Text style={styles.commentText}>
                                            {item.content}
                                        </Text>
                                    </Text>

                                    {/* Meta Row: Time | Reply */}
                                    <View style={styles.metaContainer}>
                                        <Text style={styles.metaText}>
                                            {formatTime(item.created_at)}
                                        </Text>
                                        <TouchableOpacity activeOpacity={0.7}>
                                            <Text style={styles.metaTextReply}>Reply</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Like Heart (Visual Only for now) */}
                                <TouchableOpacity style={styles.likeButton}>
                                    <Ionicons name="heart-outline" size={14} color="#8E8E93" />
                                </TouchableOpacity>
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
                                    Start the conversation.
                                </Text>
                            </View>
                        }
                    />
                )}

                {/* Input Area */}
                {Platform.OS === 'web' ? (
                    <View style={styles.inputContainer}>
                        {user ? (
                            <>
                                <Image
                                    source={{ uri: user.picture }}
                                    style={styles.inputAvatar}
                                />
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.input}
                                        value={newComment}
                                        onChangeText={setNewComment}
                                        placeholder={`Add a comment for ${user.name?.split(' ')[0] || '...'}`}
                                        placeholderTextColor="#8E8E93"
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
                                                name="arrow-up-circle"
                                                size={28}
                                                color={newComment.trim() ? colors.primary : "#555"}
                                            />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <TouchableOpacity onPress={login} style={styles.loginHint} activeOpacity={0.7}>
                                <Text variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
                                    Log in to comment
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    >
                        <View style={styles.inputContainer}>
                            {user ? (
                                <>
                                    <Image
                                        source={{ uri: user.picture }}
                                        style={styles.inputAvatar}
                                    />
                                    <View style={styles.inputWrapper}>
                                        <TextInput
                                            style={styles.input}
                                            value={newComment}
                                            onChangeText={setNewComment}
                                            placeholder={`Add a comment for ${user.name?.split(' ')[0] || '...'}`}
                                            placeholderTextColor="#8E8E93"
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
                                                    name="arrow-up-circle"
                                                    size={28}
                                                    color={newComment.trim() ? colors.primary : "#555"}
                                                />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <TouchableOpacity onPress={login} style={styles.loginHint} activeOpacity={0.7}>
                                    <Text variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
                                        Log in to comment
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        position: Platform.OS === 'web' ? 'fixed' : 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        // Web: slightly shorter to avoid browser chrome issues
        height: Platform.OS === 'web' ? '70vh' : '75%',
        zIndex: 9999,
        backgroundColor: '#1C1C1E', // Darker background
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.15)',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        padding: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 24,
        alignItems: 'flex-start',
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        marginRight: 12,
        backgroundColor: '#333',
    },
    avatarPlaceholder: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    commentContent: {
        flex: 1,
        marginRight: 8,
        marginTop: 2, // Slight alignment fix with avatar center
    },
    commentTextLine: {
        marginBottom: 4,
        lineHeight: 18,
    },
    username: {
        fontWeight: '700',
        color: '#fff',
        fontSize: 13,
    },
    commentText: {
        color: '#fff',
        fontSize: 14,
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    metaText: {
        color: '#8E8E93',
        fontSize: 12,
        marginRight: 16,
    },
    metaTextReply: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '600',
    },
    likeButton: {
        padding: 4,
        marginTop: 8, // Align with text block roughly
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#1C1C1E',
    },
    inputAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
        backgroundColor: '#333',
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 40,
        borderWidth: 1,
        borderColor: '#3A3A3C',
    },
    input: {
        flex: 1,
        fontSize: 14,
        color: '#fff',
        padding: 0,
        marginRight: 8,
    },
    sendButton: {
        padding: 4,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    loginHint: {
        flex: 1,
        textAlign: 'center',
        paddingVertical: 12,
    },
});
