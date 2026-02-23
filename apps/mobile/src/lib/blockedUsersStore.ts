import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBlockedUsers } from './api/media';

const STORAGE_KEY = 'blocked-users-cache-v1';

interface BlockedUsersCache {
  userId: string;
  blockedUserIds: string[];
  updatedAt: number;
}

let memoryCache: BlockedUsersCache | null = null;
const listeners = new Set<(blockedUserIds: string[]) => void>();

function notifyListeners(blockedUserIds: string[]) {
  listeners.forEach((listener) => {
    try {
      listener(blockedUserIds);
    } catch (error) {
      console.warn('[BlockedUsersStore] Listener error:', error);
    }
  });
}

export const blockedUsersStore = {
  async getBlockedUserIds(userId?: string): Promise<string[]> {
    if (!userId) return [];

    if (memoryCache && memoryCache.userId === userId) {
      return memoryCache.blockedUserIds;
    }

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BlockedUsersCache;
        if (parsed.userId === userId) {
          memoryCache = parsed;
          return parsed.blockedUserIds;
        }
      }
    } catch (error) {
      console.warn('[BlockedUsersStore] Failed to hydrate cache:', error);
    }

    return [];
  },

  async refresh(userId?: string): Promise<string[]> {
    if (!userId) return [];
    const rows = await getBlockedUsers(userId);
    const blockedUserIds = rows.map((row) => row.blocked_user_id);
    const nextState: BlockedUsersCache = {
      userId,
      blockedUserIds,
      updatedAt: Date.now(),
    };
    memoryCache = nextState;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    notifyListeners(blockedUserIds);
    return blockedUserIds;
  },

  async add(userId: string, blockedUserId: string): Promise<void> {
    const current = await this.getBlockedUserIds(userId);
    if (current.includes(blockedUserId)) return;
    const nextState: BlockedUsersCache = {
      userId,
      blockedUserIds: [...current, blockedUserId],
      updatedAt: Date.now(),
    };
    memoryCache = nextState;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    notifyListeners(nextState.blockedUserIds);
  },

  subscribe(listener: (blockedUserIds: string[]) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
