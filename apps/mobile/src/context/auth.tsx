import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth0, User } from 'react-native-auth0';
import { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { createSupabaseClient, supabase as publicSupabase } from '../lib/supabase';
import { syncUser } from '../lib/api/user';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    accessToken: string | null;
    supabase: SupabaseClient;
    refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
    accessToken: null,
    supabase: publicSupabase,
    refreshToken: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { authorize, clearSession, user, isLoading: auth0Loading, getCredentials } = useAuth0();
    const [isSyncing, setIsSyncing] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient>(publicSupabase);
    const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const login = async () => {
        console.log('Login triggered');
        const options = {
            scope: 'openid profile email offline_access',
            audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE,
            redirectUrl: Platform.OS === 'web'
                ? 'https://www.usechomp.com/demo/social'
                : undefined
        };

        try {
            await authorize(options);
        } catch (e: any) {
            console.error('Login failed', e);
            if (Platform.OS === 'web') {
                window.alert(`Login Failed: ${e.message || JSON.stringify(e)}`);
            }
        }
    };

    const logout = async () => {
        try {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
            if (Platform.OS === 'web') {
                const domain = "dev-dm0k5l2f2j2qi2g3.us.auth0.com";
                const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;

                // Determine strictly explicitly where to go
                const origin = typeof window !== 'undefined' && window.location.origin
                    ? window.location.origin
                    : 'https://www.usechomp.com';

                // If on production, force the deep link path to avoid landing page
                const returnTo = window.location.hostname.includes('usechomp.com')
                    ? 'https://www.usechomp.com/demo/social'
                    : `${origin}/social`;

                console.log('[Auth] Manual web logout to:', returnTo);

                // Clear local state first
                setAccessToken(null);
                setSupabaseClient(publicSupabase);

                // Construct Auth0 logout URL manually to prevent SDK magic
                const logoutUrl = `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(returnTo)}`;
                window.location.href = logoutUrl;
                return;
            }

            // Native logout
            await clearSession();
            setAccessToken(null);
            setSupabaseClient(publicSupabase);
        } catch (e) {
            console.error('Logout failed', e);
        }
    };

    // Refresh token and update Supabase client
    const refreshToken = useCallback(async () => {
        if (!user) return;

        try {
            // Force refresh to get new token
            const credentials = await getCredentials('openid profile email offline_access');

            if (credentials?.idToken) {
                setAccessToken(credentials.accessToken);
                const authenticatedClient = createSupabaseClient(credentials.idToken);
                setSupabaseClient(authenticatedClient);
                console.log('Token refreshed successfully');
            }
        } catch (error) {
            console.error('Failed to refresh token:', error);
        }
    }, [user, getCredentials]);

    // Initialize session and set up auto-refresh
    useEffect(() => {
        const initSession = async () => {
            if (user && !auth0Loading) {
                try {
                    const credentials = await getCredentials('openid profile email offline_access');

                    if (credentials?.idToken) {
                        setAccessToken(credentials.accessToken);
                        const authenticatedClient = createSupabaseClient(credentials.idToken);
                        setSupabaseClient(authenticatedClient);
                        console.log('Supabase client initialized with Auth0 token');

                        // Refresh token every 5 minutes to prevent expiry
                        if (refreshIntervalRef.current) {
                            clearInterval(refreshIntervalRef.current);
                        }
                        refreshIntervalRef.current = setInterval(() => {
                            refreshToken();
                        }, 5 * 60 * 1000); // 5 minutes
                    }
                } catch (error) {
                    console.error('Failed to get credentials', error);
                }
            } else if (!user && !auth0Loading) {
                setAccessToken(null);
                setSupabaseClient(publicSupabase);
                if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current);
                    refreshIntervalRef.current = null;
                }
            }
        };

        initSession();

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [user, auth0Loading, getCredentials, refreshToken]);

    // Sync user to backend
    useEffect(() => {
        const syncUserProfile = async () => {
            if (user && !auth0Loading && accessToken) {
                setIsSyncing(true);
                try {
                    await syncUser(user, accessToken);
                    console.log('User synced to backend');
                } catch (error) {
                    console.error('Failed to sync user', error);
                } finally {
                    setIsSyncing(false);
                }
            }
        };

        if (accessToken) {
            syncUserProfile();
        }
    }, [user, auth0Loading, accessToken]);

    return (
        <AuthContext.Provider
            value={{
                user: user || null,
                isLoading: auth0Loading || isSyncing,
                login,
                logout,
                accessToken,
                supabase: supabaseClient,
                refreshToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
