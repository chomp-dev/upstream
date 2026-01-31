import { FeedItem } from './api/types';

// Simple in-memory store for passing complex data between screens
// This avoids putting large JSON objects in URL parameters which can cause
// hydration mismatches or URL length issues on Web.

const store = new Map<string, any>();

export const navigationStore = {
    set: (key: string, data: any) => {
        store.set(key, data);
    },
    get: (key: string) => {
        const data = store.get(key);
        // Optional: clear after read (one-time use)
        // store.delete(key); 
        return data;
    },
    clear: (key: string) => {
        store.delete(key);
    }
};
