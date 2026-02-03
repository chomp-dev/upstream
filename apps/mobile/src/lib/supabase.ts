import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';

export const createSupabaseClient = (accessToken?: string) => {
    const options = accessToken
        ? {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        }
        : {};

    return createClient(supabaseUrl, supabaseAnonKey, options);
};

// Default public client (for public data if needed, though most things are RLS protected)
export const supabase = createSupabaseClient();
