import { View, StyleSheet, Image, TouchableOpacity, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface MediaOverlayProps {
    height: number;
    user?: {
        username: string;
        avatarUrl: string;
    };
    caption?: string;
    audio?: string;
    stats?: {
        likes: string;
        comments: string;
    };
}

export function MediaOverlay({
    height,
    user = {
        username: '@foodie_explorer',
        avatarUrl: 'https://i.pravatar.cc/100?img=12',
    },
    caption = 'Best burger in Chicago! 🍔 The vibes here are immaculate',
    audio = 'Original Audio',
    stats = {
        likes: '24K',
        comments: '832',
    },
}: MediaOverlayProps) {
    return (
        <>
            {/* Bottom gradient for readability */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
                style={[styles.bottomGradient, { height: height * 0.4 }]}
                pointerEvents="none"
            />

            {/* Right side action buttons */}
            <View style={styles.rightActions}>
                {/* Profile picture */}
                <TouchableOpacity activeOpacity={0.8}>
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                </TouchableOpacity>

                {/* Like button */}
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="heart-outline" size={22} color="#fff" />
                    </View>
                    <Text style={styles.actionCount}>{stats.likes}</Text>
                </TouchableOpacity>

                {/* Comment button */}
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                    </View>
                    <Text style={styles.actionCount}>{stats.comments}</Text>
                </TouchableOpacity>

                {/* Bookmark button */}
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="bookmark-outline" size={20} color="#fff" />
                    </View>
                </TouchableOpacity>

                {/* Share button */}
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="arrow-redo-outline" size={20} color="#fff" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Bottom left content info */}
            <View style={styles.bottomContent}>
                {/* Username */}
                <View style={styles.userRow}>
                    <Image source={{ uri: user.avatarUrl }} style={styles.userAvatar} />
                    <TouchableOpacity activeOpacity={0.8}>
                        <Text style={styles.username}>{user.username}</Text>
                    </TouchableOpacity>
                </View>

                {/* Caption */}
                <Text style={styles.caption} numberOfLines={2}>
                    {caption}
                </Text>

                {/* Audio info */}
                <View style={styles.audioInfo}>
                    <View style={styles.audioIcon}>
                        <Ionicons name="musical-notes" size={14} color="#fff" />
                    </View>
                    <Text style={styles.audioText} numberOfLines={1}>
                        {audio}
                    </Text>
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    rightActions: {
        position: 'absolute',
        right: 16,
        bottom: 120, // Tab bar height awareness
        alignItems: 'center',
        gap: 24,
    },
    actionButton: {
        alignItems: 'center',
        gap: 6,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#fff',
        marginBottom: 4,
    },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionCount: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        ...Platform.select({
            web: {
                textShadow: '0px 1px 4px rgba(0, 0, 0, 0.8)',
            },
            default: {
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
            },
        }),
    },
    bottomContent: {
        position: 'absolute',
        bottom: 120, // Tab bar height awareness
        left: 16,
        right: 90,
        gap: 10,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    username: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        ...Platform.select({
            web: {
                textShadow: '0px 1px 6px rgba(0, 0, 0, 0.9)',
            },
            default: {
                textShadowColor: 'rgba(0, 0, 0, 0.9)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
            },
        }),
    },
    caption: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 19,
        ...Platform.select({
            web: {
                textShadow: '0px 1px 6px rgba(0, 0, 0, 0.9)',
            },
            default: {
                textShadowColor: 'rgba(0, 0, 0, 0.9)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
            },
        }),
    },
    audioInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
    },
    audioIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
        ...Platform.select({
            web: {
                textShadow: '0px 1px 6px rgba(0, 0, 0, 0.9)',
            },
            default: {
                textShadowColor: 'rgba(0, 0, 0, 0.9)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6,
            },
        }),
    },
});
