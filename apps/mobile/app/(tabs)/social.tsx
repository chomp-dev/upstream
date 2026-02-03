/**
 * Social Tab - Profile/Friends/Inbox hub (UI shell)
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Segmented, Card } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';

type SocialSection = 'profile' | 'friends' | 'inbox';

import { useAuth } from '../../src/context/auth';
import { Image } from 'expo-image';
import { Pressable, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

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
            { key: 'friends', label: 'Friends' },
            { key: 'inbox', label: 'Inbox' },
          ]}
          selected={activeSection}
          onSelect={(key) => setActiveSection(key as SocialSection)}
          style={styles.segmented}
        />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeSection === 'profile' && <ProfileSection />}
        {activeSection === 'friends' && <FriendsSection />}
        {activeSection === 'inbox' && <InboxSection />}
      </ScrollView>
    </Screen>
  );
}

function ProfileSection() {
  const { user, logout, supabase } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user?.sub) {
      supabase
        .from('users')
        .select('*')
        .eq('auth0_id', user.sub)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    }
  }, [user, supabase]);

  if (!user) return null;

  // Use Supabase profile if available, fallback to Auth0 user
  const displayName = profile?.name || user.name || user.email;
  const displayAvatar = profile?.avatar || user.picture;

  return (
    <View style={styles.section}>
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
          <Text variant="title">0</Text>
          <Text variant="caption" color={colors.muted}>
            Posts
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text variant="title">0</Text>
          <Text variant="caption" color={colors.muted}>
            Followers
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text variant="title">0</Text>
          <Text variant="caption" color={colors.muted}>
            Following
          </Text>
        </View>
      </View>

      {/* Favorites */}
      <Card style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Ionicons name="trophy-outline" size={18} color={colors.lime} />
          <Text variant="label">Top Spots</Text>
        </View>
        <View style={styles.topSpots}>
          <Text variant="bodySmall" color={colors.muted}>
            No favorites yet
          </Text>
        </View>
      </Card>

      {/* Recent activity placeholder */}
      <Card style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Ionicons name="stats-chart-outline" size={18} color={colors.blue} />
          <Text variant="label">Recent Activity</Text>
        </View>
        <Text variant="bodySmall" color={colors.muted}>
          Your activity stats will appear here
        </Text>
      </Card>
    </View>
  );
}

function FriendsSection() {
  const friends = [
    { id: '1', name: 'Alex', username: '@alexeats', posts: 42 },
    { id: '2', name: 'Sam', username: '@samcooks', posts: 18 },
    { id: '3', name: 'Jordan', username: '@jordanfoodie', posts: 76 },
  ];

  return (
    <View style={styles.section}>
      <Text variant="label" color={colors.muted} style={styles.sectionLabel}>
        Your Friends
      </Text>

      {friends.map((friend) => (
        <Card key={friend.id} style={styles.friendCard}>
          <View style={styles.friendAvatar}>
            <Text style={styles.friendAvatarText}>
              {friend.name[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendInfo}>
            <Text variant="body">{friend.name}</Text>
            <Text variant="caption" color={colors.muted}>
              {friend.username} • {friend.posts} posts
            </Text>
          </View>
        </Card>
      ))}

      <Card style={[styles.card, styles.addFriendsCard]}>
        <Ionicons name="people-outline" size={40} color={colors.muted} style={{ marginBottom: spacing.sm }} />
        <Text variant="body" center>
          Find Friends
        </Text>
        <Text variant="bodySmall" color={colors.muted} center>
          Coming soon
        </Text>
      </Card>
    </View>
  );
}

function InboxSection() {
  return (
    <View style={styles.section}>
      <View style={styles.emptyInbox}>
        <Ionicons name="mail-open-outline" size={64} color={colors.muted} style={{ marginBottom: spacing.md }} />
        <Text variant="subtitle" center>
          No messages yet
        </Text>
        <Text variant="bodySmall" color={colors.muted} center>
          Start conversations with friends
        </Text>
      </View>

      {/* Placeholder notifications */}
      <Text variant="label" color={colors.muted} style={styles.sectionLabel}>
        Notifications
      </Text>

      <Card style={styles.notificationCard}>
        <View style={styles.notificationIconCircle}>
          <Ionicons name="heart" size={18} color={colors.coral} />
        </View>
        <View style={styles.notificationContent}>
          <Text variant="bodySmall">
            <Text bold>@alexeats</Text> liked your post
          </Text>
          <Text variant="caption" color={colors.muted}>
            2 hours ago
          </Text>
        </View>
      </Card>

      <Card style={styles.notificationCard}>
        <View style={styles.notificationIconCircle}>
          <Ionicons name="chatbubble" size={16} color={colors.blue} />
        </View>
        <View style={styles.notificationContent}>
          <Text variant="bodySmall">
            <Text bold>@samcooks</Text> commented on your video
          </Text>
          <Text variant="caption" color={colors.muted}>
            5 hours ago
          </Text>
        </View>
      </Card>

      <Card style={styles.notificationCard}>
        <View style={styles.notificationIconCircle}>
          <Ionicons name="person-add" size={16} color={colors.purple} />
        </View>
        <View style={styles.notificationContent}>
          <Text variant="bodySmall">
            <Text bold>@jordanfoodie</Text> started following you
          </Text>
          <Text variant="caption" color={colors.muted}>
            1 day ago
          </Text>
        </View>
      </Card>
    </View>
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
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  section: {
    flex: 1,
  },
  sectionLabel: {
    marginBottom: spacing.md,
    marginTop: spacing.lg,
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
  card: {
    marginBottom: spacing.md,
  },
  topSpots: {
    gap: spacing.sm,
  },
  topSpotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  friendAvatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  friendInfo: {
    flex: 1,
  },
  addFriendsCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.md,
    borderStyle: 'dashed',
  },
  emptyInbox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  notificationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
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
});
