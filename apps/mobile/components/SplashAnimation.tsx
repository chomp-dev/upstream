
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, LayoutChangeEvent } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    Easing,
    runOnJS,
    ZoomIn,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

// Local Assets (User verified transparent)
const ASSETS = {
    logo: require('../assets/images/chomp_logo.png'),
    burger: require('../assets/images/splash_assets/burger.png'),
    pizza: require('../assets/images/splash_assets/pizza.png'),
    taco: require('../assets/images/splash_assets/taco.png'),
    sushi: require('../assets/images/splash_assets/sushi.png'),
    soda: require('../assets/images/splash_assets/soda.png'),
};

const FOOD_ITEMS = [
    ASSETS.burger, ASSETS.pizza, ASSETS.taco, ASSETS.sushi, ASSETS.soda,
    ASSETS.burger, ASSETS.pizza, ASSETS.taco, ASSETS.sushi, ASSETS.soda
];

interface SplashAnimationProps {
    onComplete: () => void;
}

// Particle for "Crumbs" Effect
const Crumb = ({ index, total }: { index: number, total: number }) => {
    const angle = (index / total) * 2 * Math.PI;
    const progress = useSharedValue(0);
    const scale = useSharedValue(0);

    useEffect(() => {
        // Explode after 2.8s (synced with logo zoom)
        const delay = 2800;
        scale.value = withDelay(delay, withSequence(
            withTiming(1, { duration: 100 }), // Appear
            withTiming(0, { duration: 600 }) // Fade out
        ));
        progress.value = withDelay(delay, withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) }));
    }, []);

    const style = useAnimatedStyle(() => {
        // Fly outward 300-600px
        const distance = interpolate(progress.value, [0, 1], [0, 400 + (index % 5) * 50]);
        const translateX = Math.cos(angle) * distance;
        const translateY = Math.sin(angle) * distance;

        return {
            position: 'absolute',
            width: 8 + (index % 3) * 4,
            height: 8 + (index % 3) * 4,
            backgroundColor: index % 2 === 0 ? '#F97316' : '#FDE047', // Orange/Yellow crumbs
            borderRadius: 50,
            transform: [
                { translateX },
                { translateY },
                { scale: scale.value }
            ],
            zIndex: 20
        };
    });

    return <Animated.View style={style} />;
};

interface FloatingItemProps {
    source: any;
    containerWidth: number;
    containerHeight: number;
    index: number;
    total: number;
}

const FloatingItem = ({ source, containerWidth, containerHeight, index, total }: FloatingItemProps) => {
    // Symmetrical Layout: Circular Orbit
    const radius = Math.min(containerWidth, containerHeight) * 0.35; // 35% of screen
    const angle = (index / total) * 2 * Math.PI;

    // Position on circle center
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const initialX = centerX + Math.cos(angle) * radius - 40; // -40 for half width
    const initialY = centerY + Math.sin(angle) * radius - 40;

    const scale = useSharedValue(1);
    const translateY = useSharedValue(0);
    const rotate = useSharedValue(0);

    useEffect(() => {
        // Breathing Effect
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 2000 + index * 100, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 2000 + index * 100, easing: Easing.inOut(Easing.sin) })
            ), -1, true
        );

        // Slow Drift
        translateY.value = withRepeat(
            withSequence(
                withTiming(-10, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
                withTiming(10, { duration: 3000, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        );

        // Gentle Rocking
        rotate.value = withRepeat(
            withTiming(index % 2 === 0 ? 10 : -10, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
            -1, true
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { scale: scale.value },
            { rotate: `${rotate.value}deg` }
        ],
        position: 'absolute',
        left: initialX,
        top: initialY,
        width: 80,
        height: 80,
        zIndex: 1,
    }));

    return (
        <Animated.View
            style={style}
            entering={ZoomIn.delay(index * 100).duration(800).springify()}
        >
            <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Animated.View>
    );
};

export default function SplashAnimation({ onComplete }: SplashAnimationProps) {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const scale = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        // Logo Sequence
        scale.value = withSequence(
            withTiming(1, { duration: 800, easing: Easing.elastic(1.2) }), // Pop in
            withDelay(2000,
                withTiming(50, { duration: 600, easing: Easing.in(Easing.cubic) }, () => { // SUPER ZOOM
                    runOnJS(onComplete)();
                })
            )
        );

        // Fade background out near end of zoom
        opacity.value = withDelay(2900, withTiming(0, { duration: 200 }));
    }, []);

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        zIndex: 10,
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const handleLayout = (e: LayoutChangeEvent) => {
        setDimensions(e.nativeEvent.layout);
    };

    return (
        <Animated.View style={[styles.container, containerStyle]} onLayout={handleLayout}>
            {/* Soft Cream Background for Food App */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFBF2' }]} />
            <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,237,213,0.4)']} // Subtle warmth
                style={StyleSheet.absoluteFill}
            />

            {dimensions.width > 0 && FOOD_ITEMS.map((source, i) => (
                <FloatingItem
                    key={i}
                    index={i}
                    total={FOOD_ITEMS.length}
                    source={source}
                    containerWidth={dimensions.width}
                    containerHeight={dimensions.height}
                />
            ))}

            {/* Crumbs Explosion */}
            {Array.from({ length: 12 }).map((_, i) => (
                <Crumb key={`crumb-${i}`} index={i} total={12} />
            ))}

            <Animated.View style={[styles.logoContainer, logoStyle]}>
                <Image
                    source={ASSETS.logo}
                    style={styles.logo}
                    contentFit="contain"
                />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    logoContainer: {
        width: 300, // Bigger Logo
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: '100%',
        height: '100%',
    }
});
