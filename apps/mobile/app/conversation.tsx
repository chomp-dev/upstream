/**
 * Direct Message Conversation Screen
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Screen, Text } from '../src/ui';
import { colors, spacing, radius } from '../src/theme';
import { useAuth } from '../src/context/auth';

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    read_at?: string;
}

interface OtherUser {
    auth0_id: string;
    name: string;
    avatar: string;
}

export default function ConversationScreen() {
    const router = useRouter();
    const { user, supabase } = useAuth();
    const { userId: otherUserId } = useLocalSearchParams<{ userId: string }>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);

    // Fetch other user info and conversation
    useEffect(() => {
        const init = async () => {
            if (!user || !otherUserId) return;

            try {
                // Fetch other user info
                const { data: userData } = await supabase
                    .from('users')
                    .select('auth0_id, name, avatar')
                    .eq('auth0_id', otherUserId)
                    .maybeSingle();

                if (userData) {
                    setOtherUser(userData);
                }

                // Find or get conversation
                // Conversations have ordered participants (participant_1 < participant_2)
                const [p1, p2] = [user.sub, otherUserId].sort();

                const { data: convData } = await supabase
                    .from('conversations')
                    .select('id')
                    .eq('participant_1', p1)
                    .eq('participant_2', p2)
                    .maybeSingle();

                if (convData) {
                    setConversationId(convData.id);
                    await fetchMessages(convData.id);
                }
            } catch (err) {
                console.error('Error initializing conversation:', err);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [user, otherUserId, supabase]);

    const fetchMessages = async (convId: string) => {
        const { data: messagesData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

        if (messagesData) {
            setMessages(messagesData);
        }

        // Mark messages as read
        if (user) {
            await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('conversation_id', convId)
                .neq('sender_id', user.sub)
                .is('read_at', null);
        }
    };

    // Set up real-time subscription
    useEffect(() => {
        if (!conversationId) return;

        const subscription = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages(prev => {
                        // Prevent duplicates
                        const exists = prev.some(m => m.id === newMsg.id);
                        if (exists) {
                            console.log('[Conversation] Duplicate message from Realtime ignored:', newMsg.id);
                            return prev;
                        }
                        return [...prev, newMsg];
                    });
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [conversationId, supabase]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !user || !otherUserId || sending) return;

        const messageText = newMessage.trim();
        setNewMessage('');
        setSending(true);

        // Create optimistic message for immediate display
        const optimisticId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
            id: optimisticId,
            conversation_id: conversationId || '',
            sender_id: user.sub,
            content: messageText,
            created_at: new Date().toISOString(),
            read_at: undefined,
        };

        // Add optimistic message immediately
        setMessages(prev => [...prev, optimisticMessage]);

        try {
            let convId = conversationId;

            // Create conversation if it doesn't exist
            if (!convId) {
                const [p1, p2] = [user.sub, otherUserId].sort();
                const { data: newConv, error: convError } = await supabase
                    .from('conversations')
                    .insert({
                        participant_1: p1,
                        participant_2: p2,
                    })
                    .select('id')
                    .maybeSingle();

                if (convError) throw convError;
                convId = newConv?.id;
                setConversationId(convId!);
            }

            // Send message
            const { data: sentMsg, error: msgError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: convId,
                    sender_id: user.sub,
                    content: messageText,
                })
                .select()
                .maybeSingle();

            if (msgError) throw msgError;

            // Replace optimistic message with real one
            if (sentMsg) {
                setMessages(prev => {
                    // Check if the real message was already added by the subscription
                    const alreadyExists = prev.some(m => m.id === sentMsg.id);
                    if (alreadyExists) {
                        console.log('[Conversation] Message already added by subscription, removing optimistic:', optimisticId);
                        // If it exists, just remove the optimistic one
                        return prev.filter(m => m.id !== optimisticId);
                    }
                    console.log('[Conversation] Replacing optimistic message with real one:', sentMsg.id);
                    // Otherwise replace optimistic with real
                    return prev.map(m => m.id === optimisticId ? sentMsg : m);
                });
            }

            // Update conversation timestamp
            await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', convId);

        } catch (err) {
            console.error('Error sending message:', err);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            setNewMessage(messageText); // Restore on error
        } finally {
            setSending(false);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return date.toLocaleDateString();
        }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isOwn = item.sender_id === user?.sub;

        return (
            <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
                <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
                    <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
                        {item.content}
                    </Text>
                </View>
                <Text variant="caption" color={colors.muted} style={styles.messageTime}>
                    {formatTime(item.created_at)}
                </Text>
            </View>
        );
    };

    if (!user) {
        return (
            <Screen safe>
                <View style={styles.centerContainer}>
                    <Text>Please sign in to message</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen safe edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerUser}
                    onPress={() => otherUser && router.push({ pathname: '/profile', params: { userId: otherUser.auth0_id } })}
                >
                    {otherUser?.avatar ? (
                        <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
                    ) : (
                        <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
                            <Ionicons name="person" size={16} color={colors.muted} />
                        </View>
                    )}
                    <Text variant="subtitle">{otherUser?.name || 'User'}</Text>
                </TouchableOpacity>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messagesList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text variant="body" color={colors.muted} center>
                                No messages yet
                            </Text>
                            <Text variant="caption" color={colors.muted} center>
                                Say hi to start the conversation!
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={10}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.muted}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                        onPress={sendMessage}
                        disabled={!newMessage.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color={colors.bg} />
                        ) : (
                            <Ionicons name="send" size={20} color={colors.bg} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
    },
    headerUser: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: spacing.sm,
        gap: spacing.sm,
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    avatarPlaceholder: {
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messagesList: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
    },
    messageContainer: {
        marginBottom: spacing.md,
        alignItems: 'flex-start',
    },
    ownMessageContainer: {
        alignItems: 'flex-end',
    },
    messageBubble: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        maxWidth: '75%',
    },
    ownMessageBubble: {
        backgroundColor: colors.primary,
    },
    messageText: {
        color: colors.text,
        fontSize: 15,
    },
    ownMessageText: {
        color: colors.bg,
    },
    messageTime: {
        marginTop: 4,
    },
    emptyContainer: {
        paddingVertical: spacing.xxl,
        alignItems: 'center',
        gap: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md, // Add safe area padding
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.bg,
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.pill, // Rounder
        paddingHorizontal: spacing.lg,
        paddingVertical: 12, // Taller
        color: colors.text,
        maxHeight: 100,
        minHeight: 44, // Minimum touch target
        fontSize: 16,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});
