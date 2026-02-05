import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useAuth } from '../src/context/auth';
import { router } from 'expo-router';

export const AuthHeader = () => {
    const { user, login } = useAuth();

    const navigateToProfile = () => {
        router.push('/profile');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.logo}>Chomp</Text>
            <View style={styles.authContainer}>
                {user ? (
                    <TouchableOpacity onPress={navigateToProfile} style={styles.profileButton}>
                        {user.picture ? (
                            <Image source={{ uri: user.picture }} style={styles.avatar} />
                        ) : null}
                        <Text style={styles.profileText}>{user.name || 'Profile'}</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => login()} style={styles.loginButton}>
                        <Text style={styles.loginText}>Sign In</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        // Safe area spacing if needed, but usually handled by SafeAreaView in layout
    },
    logo: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#eeb57e', // Tomato color or brand color
    },
    authContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 8,
    },
    profileText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    loginButton: {
        backgroundColor: '#eeb57e',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    loginText: {
        color: '#000',
        fontWeight: '600',
        fontSize: 14,
    },
});
