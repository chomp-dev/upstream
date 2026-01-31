import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0, User } from 'react-native-auth0';
import { router } from 'expo-router';
// We will implement this next
import { syncUser } from '../lib/api/user';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { authorize, clearSession, user, isLoading: auth0Loading, getCredentials } = useAuth0();
    const [isSyncing, setIsSyncing] = useState(false);

    const login = async () => {
        try {
            await authorize({
                scope: 'openid profile email offline_access',
                audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE,
            });

            // User sync will be handled by the effect when user state changes
        } catch (e) {
            console.error('Login failed', e);
        }
    };

    const logout = async () => {
        try {
            await clearSession();
        } catch (e) {
            console.error('Logout failed', e);
        }
    };

    // Sync user to backend when user changes and is logged in
    useEffect(() => {
        const syncUserProfile = async () => {
            if (user && !auth0Loading) {
                setIsSyncing(true);
                try {
                    // Get the access token to send to backend
                    const credentials = await getCredentials();

                    if (credentials?.accessToken) {
                        await syncUser(user, credentials.accessToken);
                        console.log('User synced to backend');
                    }
                } catch (error) {
                    console.error('Failed to sync user', error);
                } finally {
                    setIsSyncing(false);
                }
            }
        };

        syncUserProfile();
    }, [user, auth0Loading]);

    return (
        <AuthContext.Provider
            value={{
                user: user || null,
                isLoading: auth0Loading || isSyncing,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
