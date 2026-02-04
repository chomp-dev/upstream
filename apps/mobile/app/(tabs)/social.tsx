/**
 * Social Tab - Profile/Messages hub
 */

import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Segmented, Card } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/context/auth';
import { Image } from 'expo-image';
import { Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

type SocialSection = 'profile' | 'messages';

interface PostItem {
  id: number;
  type: 'video' | 'image';
  thumbnail_url?: string;
  images?: string[];
  title: string;
  created_at: string;
}

interface Conversation {
  id: string;
  other_user: {
    auth0_id: string;
    name: string;
    avatar: string;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
}

export default function SocialScreen() {
  const [activeSection, setActiveSection] = useState<SocialSection>('profile');
  const { user, login } = useAuth();

  if (!user && activeSection === 'profile') {
    return (
      <Screen edges={['top']} safe>
        <View style={styles.loginContainer}>
          <Text variant="title" center style={{ marginBottom: spacing.xxl }}>
            Login to Chomp
          </Text>
          <Pressable style={styles.loginButton} onPress={login}>
            <Text variant="subtitle" color={colors.bg}>Sign In / Sign Up</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="title">Social</Text>
        <Segmented
          options={[
            { key: 'profile', label: 'Profile' },
            { key: 'messages', label: 'Messages' },
          ]}
          selected={activeSection}
          onSelect={(key) => setActiveSection(key as SocialSection)}
          style={styles.segmented}
        />
      </View>

      {activeSection === 'profile' && <ProfileSection />}
      {activeSection === 'messages' && <MessagesSection />}
    </Screen>
  );
}

function ProfileSection() {
  const { user, logout, supabase } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.sub) {
        setLoading(false);
        return;
      }

      const fetchData = async () => {
        try {
          // Fetch profile
          const { data: profileData } = await supabase
            .from('users')
            .select('*')
            .eq('auth0_id', user.sub)
            .single();

          if (profileData) setProfile(profileData);

          // Fetch posts
          const { data: videoData } = await supabase
            .from('videos')
            .select('id, thumbnail_url, title, created_at')
            .eq('user_id', user.sub)
            .neq('status', 'error')
            .order('created_at', { ascending: false });

          const { data: imageData } = await supabase
            .from('image_posts')
            .select('id, images, title, created_at')
            .eq('user_id', user.sub)
            .order('created_at', { ascending: false });

          const combined: PostItem[] = [];
          if (videoData) combined.push(...videoData.map((v: any) => ({ ...v, type: 'video' as const })));
          if (imageData) combined.push(...imageData.map((i: any) => ({ ...i, type: 'image' as const })));
          combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setPosts(combined);

          // Fetch follower/following counts
          const { count: followerCount } = await supabase
            .from('follows')
            .select('id', { count: 'exact', head: true })
            .eq('following_id', user.sub);
          setFollowersCount(followerCount || 0);

          const { count: followingCountResult } = await supabase
            .from('follows')
            .select('id', { count: 'exact', head: true })
            .eq('follower_id', user.sub);
          setFollowingCount(followingCountResult || 0);

        } catch (err) {
          console.error('Error fetching profile data:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [user, supabase])
  );

  if (!user) return null;

  const displayName = profile?.name || user.name || user.email;
  const displayAvatar = profile?.avatar || user.picture;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderPostItem = ({ item }: { item: PostItem }) => {
    const thumbnail = item.type === 'video' ? item.thumbnail_url : item.images?.[0];
    return (
      <TouchableOpacity
        style={styles.postItem}
        onPress={() => router.push({ pathname: '/', params: { itemId: item.id.toString() } })}
        activeOpacity={0.8}
      >
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.postThumbnail} />
        ) : (
          <View style={styles.postPlaceholder}>
            <Ionicons name={item.type === 'image' ? 'images' : 'play'} size={20} color="white" />
          </View>
        )}
        {item.type === 'video' && (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={8} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      renderItem={renderPostItem}
      numColumns={3}
      ListHeaderComponent={
        <View style={styles.profileContainer}>
          {/* Profile header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              {displayAvatar ? (
                <Image
                  source={{ uri: displayAvatar }}
                  style={{ width: 94, height: 94, borderRadius: 47 }}
                />
              ) : (
                <Ionicons name="person" size={48} color={colors.primary} />
              )}
            </View>
            <Text variant="title" style={styles.username}>
              {displayName}
            </Text>
            {profile?.bio ? (
              <Text variant="bodySmall" color={colors.muted} style={{ marginBottom: spacing.xs, paddingHorizontal: spacing.xl }} center>
                {profile.bio}
              </Text>
            ) : (
              <Text variant="bodySmall" color={colors.muted}>
                {user.email}
              </Text>
            )}

            {/* Action Buttons Row */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() => router.push('/edit_profile')}
              >
                <Text variant="caption" color={colors.bg}>Edit Profile</Text>
              </TouchableOpacity>

              <Pressable style={styles.logoutButton} onPress={logout}>
                <Text variant="caption" color={colors.muted}>Log Out</Text>
              </Pressable>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text variant="title">{posts.length}</Text>
              <Text variant="caption" color={colors.muted}>
                Posts
              </Text>
            </View>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.stat}
              onPress={() => router.push({ pathname: '/followers', params: { userId: user.sub, tab: 'followers' } })}
            >
              <Text variant="title">{followersCount}</Text>
              <Text variant="caption" color={colors.muted}>
                Followers
              </Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.stat}
              onPress={() => router.push({ pathname: '/followers', params: { userId: user.sub, tab: 'following' } })}
            >
              <Text variant="title">{followingCount}</Text>
              <Text variant="caption" color={colors.muted}>
                Following
              </Text>
            </TouchableOpacity>
          </View>

          {/* Posts Header */}
          <View style={styles.postsHeader}>
            <Ionicons name="grid-outline" size={18} color={colors.text} />
            <Text variant="label">Your Posts</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📷</Text>
          <Text variant="body" color={colors.muted} center>No posts yet</Text>
          <Text variant="caption" color={colors.muted} center>Share your first food discovery!</Text>
        </View>
      }
      contentContainerStyle={styles.postsGrid}
      showsVerticalScrollIndicator={false}
    />
  );
}

function MessagesSection() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.sub) {
        setLoading(false);
        return;
      }

      const fetchConversations = async () => {
        try {
          // Get all conversations for this user
          // Use two separate queries to avoid .or() issues with special chars in auth0 IDs
          const [{ data: conv1 }, { data: conv2 }] = await Promise.all([
            supabase
              .from('conversations')
              .select('*')
              .eq('participant_1', user.sub),
            supabase
              .from('conversations')
              .select('*')
              .eq('participant_2', user.sub)
          ]);

          // Merge and deduplicate by id
          const allConvs = [...(conv1 || []), ...(conv2 || [])];
          const convMap = new Map();
          allConvs.forEach(c => convMap.set(c.id, c));
          const convData = Array.from(convMap.values())
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

          if (!convData || convData.length === 0) {
            setConversations([]);
            setLoading(false);
            return;
          }

          // Get other user IDs
          const otherUserIds = convData.map(c =>
            c.participant_1 === user.sub ? c.participant_2 : c.participant_1
          );

          // Fetch other users
          const { data: usersData } = await supabase
            .from('users')
            .select('auth0_id, name, avatar')
            .in('auth0_id', otherUserIds);

          const userMap: Record<string, any> = {};
          usersData?.forEach(u => { userMap[u.auth0_id] = u; });

          // Build conversation list
          const convList: Conversation[] = await Promise.all(convData.map(async (c) => {
            const otherId = c.participant_1 === user.sub ? c.participant_2 : c.participant_1;

            // Get last message
            const { data: lastMsgData } = await supabase
              .from('messages')
              .select('content, created_at, sender_id')
              .eq('conversation_id', c.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            // Get unread count
            const { count: unread } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('conversation_id', c.id)
              .neq('sender_id', user.sub)
              .is('read_at', null);

            return {
              id: c.id,
              other_user: userMap[otherId] || { auth0_id: otherId, name: 'User', avatar: '' },
              last_message: lastMsgData || undefined,
              unread_count: unread || 0,
            };
          }));

          setConversations(convList);
        } catch (err) {
          console.error('Error fetching conversations:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchConversations();
    }, [user, supabase])
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'now';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.emptyMessages}>
        <Ionicons name="chatbubbles-outline" size={64} color={colors.muted} style={{ marginBottom: spacing.md }} />
        <Text variant="subtitle" center>
          No messages yet
        </Text>
        <Text variant="bodySmall" color={colors.muted} center>
          Start a conversation from someone's profile
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.conversationItem}
          onPress={() => router.push({ pathname: '/conversation', params: { userId: item.other_user.auth0_id } })}
          activeOpacity={0.7}
        >
          {item.other_user.avatar ? (
            <Image source={{ uri: item.other_user.avatar }} style={styles.conversationAvatar} />
          ) : (
            <View style={[styles.conversationAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{item.other_user.name?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
          )}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <Text variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>{item.other_user.name}</Text>
              {item.last_message && (
                <Text variant="caption" color={colors.muted}>{formatTime(item.last_message.created_at)}</Text>
              )}
            </View>
            {item.last_message && (
              <Text variant="caption" color={colors.muted} numberOfLines={1}>
                {item.last_message.sender_id === user?.sub ? 'You: ' : ''}{item.last_message.content}
              </Text>
            )}
          </View>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread_count}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.messagesList}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmented: {
    marginTop: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContainer: {
    padding: spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  username: {
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  postsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  postsGrid: {
    paddingBottom: 100,
  },
  postItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 1,
    position: 'relative',
  },
  postThumbnail: {
    width: '100%',
    height: '100%',
  },
  postPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  editProfileButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  logoutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: 100,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  // Messages Section
  messagesList: {
    padding: spacing.lg,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conversationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 18,
  },
  conversationInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '600',
  },
});
