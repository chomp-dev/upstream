import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../src/ui';

const LOGO = require('../assets/images/chomp_logo.png');
const BG = require('../assets/images/splash_assets/splash_bg.jpg');

interface SimpleSplashProps {
    progress?: number;
    statusText?: string;
}

export default function SimpleSplash({ progress = 0, statusText = '' }: SimpleSplashProps) {
    return (
        <View style={styles.container}>
            {/* Background Image with Blur */}
            <Image
                source={BG}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={10}
                priority="high"
            />

            {/* Dark Overlay for Contrast */}
            <LinearGradient
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                style={StyleSheet.absoluteFill}
            />

            {/* Chomp Logo */}
            <Image
                source={LOGO}
                style={styles.logo}
                contentFit="contain"
            />

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
                </View>
                {statusText ? (
                    <Text variant="caption" color="#eeb57e" style={styles.statusText}>
                        {statusText}
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f7f6f1',
        zIndex: 99999,
    },
    logo: {
        width: 300,
        height: 150,
    },
    progressContainer: {
        position: 'absolute',
        bottom: 120,
        width: '60%',
        alignItems: 'center',
    },
    progressTrack: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#eeb57e',
        borderRadius: 2,
    },
    statusText: {
        marginTop: 8,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
});
