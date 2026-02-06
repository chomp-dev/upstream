import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    TouchableWithoutFeedback,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/auth';
import { Text } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';
import { Image } from 'expo-image';
import { useKeyboardHeight, getBottomSafeInset } from '../src/hooks/useKeyboardHeight';
import { BASE_URL } from '../src/lib/api/media';

interface Comment {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    parent_id?: string | null;
    likes_count?: number;
    user?: {
        name: string;
        avatar: string;
    };
    replies?: Comment[];
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
    const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
    const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
    const keyboardHeight = useKeyboardHeight();
    const bottomSafeInset = getBottomSafeInset();

    // Calculate bottom padding for input container
    // When keyboard is visible, add keyboard height minus bottom safe area (since keyboard covers it)
    // When keyboard is hidden, add bottom safe area for home indicator
    const inputBottomPadding = keyboardHeight > 0
        ? keyboardHeight - bottomSafeInset + 8
        : bottomSafeInset + 8;

    const fetchComments = useCallback(async () => {
        if (!visible) return;

        setLoading(true);
        try {
            // Fetch top-level comments (no parent_id) with user info
            const { data, error } = await supabase
                .from('comments')
                .select(`
                    id,
                    content,
                    user_id,
                    created_at,
                    parent_id,
                    likes_count
                `)
                .eq('video_url', videoUrl)
                .is('parent_id', null)  // Only top-level comments
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
        const parentId = replyingTo?.id || null;
        setReplyingTo(null);

        try {
            // Use backend API to bypass RLS
            const response = await fetch(`${BASE_URL}/api/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    video_url: videoUrl,
                    user_id: user.sub,
                    content: commentText,
                    parent_id: parentId,
                }),
            });

            if (!response.ok) throw new Error('Failed to post comment');
            const data = await response.json();

            // Add to local state optimistically
            const newCommentItem: Comment = {
                id: data.comment?.id || Date.now().toString(),
                content: commentText,
                user_id: user.sub,
                created_at: new Date().toISOString(),
                parent_id: parentId,
                likes_count: 0,
                user: { name: user.name || 'You', avatar: user.picture || '' },
            };

            if (parentId) {
                // Add as reply - update parent's replies
                setComments(prev => prev.map(c =>
                    c.id === parentId
                        ? { ...c, replies: [...(c.replies || []), newCommentItem] }
                        : c
                ));
            } else {
                setComments(prev => [newCommentItem, ...prev]);
            }
        } catch (err) {
            console.error('Error posting comment:', err);
            setNewComment(commentText); // Restore on error
        } finally {
            setPosting(false);
        }
    };

    const handleReply = (commentId: string, username: string) => {
        setReplyingTo({ id: commentId, username });
    };

    const handleLike = async (commentId: string) => {
        if (!user) return;

        const isLiked = likedComments.has(commentId);

        // Optimistic update
        setLikedComments(prev => {
            const next = new Set(prev);
            if (isLiked) {
                next.delete(commentId);
            } else {
                next.add(commentId);
            }
            return next;
        });

        // Update local likes count
        setComments(prev => prev.map(c =>
            c.id === commentId
                ? { ...c, likes_count: (c.likes_count || 0) + (isLiked ? -1 : 1) }
                : c
        ));

        try {
            const method = isLiked ? 'DELETE' : 'POST';
            const response = await fetch(`${BASE_URL}/api/comments/${commentId}/like`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.sub }),
            });

            if (!response.ok) {
                throw new Error('Failed to update like');
            }
        } catch (err) {
            console.error('Error updating like:', err);
            // Revert optimistic update on error
            setLikedComments(prev => {
                const next = new Set(prev);
                if (isLiked) {
                    next.add(commentId);
                } else {
                    next.delete(commentId);
                }
                return next;
            });
            setComments(prev => prev.map(c =>
                c.id === commentId
                    ? { ...c, likes_count: (c.likes_count || 0) + (isLiked ? 1 : -1) }
                    : c
            ));
        }
    };

    const cancelReply = () => {
        setReplyingTo(null);
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
                    <View style={[styles.loadingContainer, { flex: 1 }]}>
                        <ActivityIndicator size="large" color="#fff" />
                    </View>
                ) : (
                    <FlatList
                        style={{ flex: 1 }}
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
                                        <TouchableOpacity activeOpacity={0.7} onPress={() => handleReply(item.id, item.user?.name || 'User')}>
                                            <Text style={styles.metaTextReply}>Reply</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Like Heart */}
                                <TouchableOpacity style={styles.likeButton} onPress={() => handleLike(item.id)}>
                                    <Ionicons
                                        name={likedComments.has(item.id) ? "heart" : "heart-outline"}
                                        size={14}
                                        color={likedComments.has(item.id) ? "#FF3B5C" : "#8E8E93"}
                                    />
                                    {(item.likes_count || 0) > 0 && (
                                        <Text style={styles.likesCount}>{item.likes_count}</Text>
                                    )}
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

                {/* Input Area - uses dynamic keyboard height for iOS, fixed for others */}
                <View style={[styles.inputContainer, { paddingBottom: Platform.OS === 'ios' ? inputBottomPadding : 12 }]}>
                    {/* Reply indicator */}
                    {replyingTo && (
                        <View style={styles.replyIndicator}>
                            <Text style={styles.replyIndicatorText}>
                                Replying to @{replyingTo.username}
                            </Text>
                            <TouchableOpacity onPress={cancelReply}>
                                <Ionicons name="close-circle" size={18} color="#8E8E93" />
                            </TouchableOpacity>
                        </View>
                    )}
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
                                    placeholder="Add a comment..."
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
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '75%', // Consistent height percentage for both platforms
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
        paddingVertical: 16,
        paddingHorizontal: 20,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    likesCount: {
        fontSize: 11,
        color: '#8E8E93',
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        gap: 8,
    },
    replyIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#2C2C2E',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.15)',
        position: 'absolute',
        top: -36,
        left: 0,
        right: 0,
    },
    replyIndicatorText: {
        fontSize: 13,
        color: colors.primary,
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
