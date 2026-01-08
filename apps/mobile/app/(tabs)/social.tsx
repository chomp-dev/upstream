/**
 * Social Tab - Profile/Friends/Inbox hub (UI shell)
 */

import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Screen, Text, Segmented, Card } from '../../src/ui';
import { colors, spacing, radius } from '../../src/theme';

type SocialSection = 'profile' | 'friends' | 'inbox';

export default function SocialScreen() {
  const [activeSection, setActiveSection] = useState<SocialSection>('profile');

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
  return (
    <View style={styles.section}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text variant="title" style={styles.username}>
          @chomper
        </Text>
        <Text variant="bodySmall" color={colors.muted}>
          Food explorer • NYC
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text variant="title">24</Text>
          <Text variant="caption" color={colors.muted}>
            Posts
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text variant="title">1.2K</Text>
          <Text variant="caption" color={colors.muted}>
            Followers
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text variant="title">342</Text>
          <Text variant="caption" color={colors.muted}>
            Following
          </Text>
        </View>
      </View>

      {/* Favorites */}
      <Card style={styles.card}>
        <Text variant="label" style={styles.cardTitle}>
          🏆 Top Spots
        </Text>
        <View style={styles.topSpots}>
          <View style={styles.topSpotItem}>
            <Text variant="body">1.</Text>
            <Text variant="bodySmall" style={{ flex: 1 }}>
              Joe's Pizza
            </Text>
            <Text variant="caption" color={colors.primary}>
              ★ 4.8
            </Text>
          </View>
          <View style={styles.topSpotItem}>
            <Text variant="body">2.</Text>
            <Text variant="bodySmall" style={{ flex: 1 }}>
              Ramen Lab
            </Text>
            <Text variant="caption" color={colors.primary}>
              ★ 4.7
            </Text>
          </View>
          <View style={styles.topSpotItem}>
            <Text variant="body">3.</Text>
            <Text variant="bodySmall" style={{ flex: 1 }}>
              Levain Bakery
            </Text>
            <Text variant="caption" color={colors.primary}>
              ★ 4.6
            </Text>
          </View>
        </View>
      </Card>

      {/* Recent activity placeholder */}
      <Card style={styles.card}>
        <Text variant="label" style={styles.cardTitle}>
          📊 Recent Activity
        </Text>
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
        <Text style={styles.addFriendsIcon}>👥</Text>
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
        <Text style={styles.inboxIcon}>📬</Text>
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
        <Text style={styles.notificationIcon}>❤️</Text>
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
        <Text style={styles.notificationIcon}>💬</Text>
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
        <Text style={styles.notificationIcon}>👋</Text>
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
  avatarText: {
    fontSize: 48,
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
  cardTitle: {
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
  addFriendsIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyInbox: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  inboxIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  notificationIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
});
