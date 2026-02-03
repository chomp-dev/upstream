import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0, User } from 'react-native-auth0';
import { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { createSupabaseClient, supabase as publicSupabase } from '../lib/supabase';
// We will implement this next - keeping for now to avoid breaking imports if used elsewhere, 
// but we might replace it with direct Supabase calls or keep it as an API layer.
import { syncUser } from '../lib/api/user';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    accessToken: string | null;
    supabase: SupabaseClient;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
    accessToken: null,
    supabase: publicSupabase,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { authorize, clearSession, user, isLoading: auth0Loading, getCredentials } = useAuth0();
    const [isSyncing, setIsSyncing] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient>(publicSupabase);

    const login = async () => {
        console.log('Login triggered');
        const options = {
            scope: 'openid profile email offline_access',
            audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE,
            redirectUrl: Platform.OS === 'web'
                ? 'https://www.usechomp.com/demo/social'
                : undefined
        };
        console.log('Auth Options:', JSON.stringify(options, null, 2));

        try {
            await authorize(options);
            // User sync will be handled by the effect when user state changes
        } catch (e: any) {
            console.error('Login failed', e);
            // Alert is not available on web in the same way as RN sometimes, but usually works or polyfilled.
            // On web assume console is main tool, but we can try window.alert or log.
            if (Platform.OS === 'web') {
                window.alert(`Login Failed: ${e.message || JSON.stringify(e)}`);
            } else {
                // Import Alert if not imported or use console
                console.log('Login Error Alert:', e.message);
            }
        }
    };

    const logout = async () => {
        try {
            await clearSession({
                returnTo: Platform.OS === 'web'
                    ? 'https://www.usechomp.com/demo/'
                    : undefined
            } as any);
            setAccessToken(null);
            setSupabaseClient(publicSupabase);
        } catch (e) {
            console.error('Logout failed', e);
        }
    };

    // Extract token and initialize Supabase
    useEffect(() => {
        const initSession = async () => {
            if (user && !auth0Loading) {
                try {
                    const credentials = await getCredentials('openid profile email offline_access');
                    console.log('Credentials obtained:', Object.keys(credentials || {}));

                    if (credentials?.accessToken) {
                        setAccessToken(credentials.accessToken);
                        // Create a new Supabase client with the user's ID token (JWS)
                        // because Access Token might be an opaque/encrypted JWE (5 parts)
                        // which Supabase does not accept.
                        const tokenToUse = credentials.idToken || credentials.accessToken;
                        const authenticatedClient = createSupabaseClient(tokenToUse);
                        setSupabaseClient(authenticatedClient);
                    }
                } catch (error) {
                    console.error('Failed to get credentials', error);
                }
            } else if (!user && !auth0Loading) {
                setAccessToken(null);
                setSupabaseClient(publicSupabase);
            }
        };

        initSession();
    }, [user, auth0Loading]);


    // Sync user to backend when user changes and is logged in
    useEffect(() => {
        const syncUserProfile = async () => {
            // We can rely on the Auth0 Action to sync the user, 
            // but keeping this hook if the client also needs to trigger something specific.
            // For now, removing the manual sync call if the Action covers it, 
            // OR keeping it as a backup/check. 
            // Since the user requested "Post-Login Action is already live", 
            // we might not strictly need this client-side sync, but it doesn't hurt.
            if (user && !auth0Loading && accessToken) {
                setIsSyncing(true);
                try {
                    await syncUser(user, accessToken);
                    console.log('User synced to backend (client-side check)');
                } catch (error) {
                    console.error('Failed to sync user', error);
                } finally {
                    setIsSyncing(false);
                }
            }
        };

        // Only sync if we have the token
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
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
