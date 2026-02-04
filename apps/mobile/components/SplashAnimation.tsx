
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
    FadeOut
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

// Local Assets
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
    ASSETS.burger, ASSETS.pizza, ASSETS.taco, ASSETS.sushi, ASSETS.soda,
    ASSETS.burger, ASSETS.pizza, ASSETS.taco, ASSETS.sushi // ~14 items
];

interface SplashAnimationProps {
    onComplete: () => void;
}

interface FloatingItemProps {
    source: any;
    containerWidth: number;
    containerHeight: number;
    index: number;
}

const FloatingItem = ({ source, containerWidth, containerHeight, index }: FloatingItemProps) => {
    // Deterministic pseudo-random based on index to ensure consistent spread
    const random = (seed: number) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    };

    const size = 60 + random(index) * 60; // 60-120px
    const initialX = random(index * 13) * (containerWidth - size);
    const initialY = random(index * 7) * (containerHeight - size);
    const delay = random(index * 3) * 800;
    const durationX = 2000 + random(index) * 1000;
    const durationRotate = 3000 + random(index * 2) * 2000;

    const translateY = useSharedValue(0);
    const rotate = useSharedValue(0);

    useEffect(() => {
        translateY.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(-30, { duration: durationX, easing: Easing.inOut(Easing.quad) }),
                    withTiming(0, { duration: durationX, easing: Easing.inOut(Easing.quad) })
                ),
                -1,
                true
            )
        );

        rotate.value = withRepeat(
            withTiming(15, { duration: durationRotate, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { rotate: `${rotate.value}deg` }
        ],
        position: 'absolute',
        left: initialX,
        top: initialY,
        width: size,
        height: size,
        zIndex: 1, // Behinid logo
    }));

    return (
        <Animated.View
            style={style}
            entering={ZoomIn.delay(delay).duration(600).springify()}
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
        // Logo entrance
        scale.value = withSequence(
            withTiming(1, { duration: 800, easing: Easing.elastic(1) }),
            withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 1000 }),
                    withTiming(1, { duration: 1000 })
                ),
                -1, true
            )
        );

        // Exit sequence
        const timeout = setTimeout(() => {
            scale.value = withTiming(80, { duration: 600, easing: Easing.in(Easing.exp) }, () => {
                runOnJS(onComplete)();
            });
            opacity.value = withTiming(0, { duration: 200 });
        }, 3500);

        return () => clearTimeout(timeout);
    }, []);

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        zIndex: 10,
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const handleLayout = (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setDimensions({ width, height });
    };

    return (
        <Animated.View style={[styles.container, containerStyle]} onLayout={handleLayout}>
            {/* Gradient Background */}
            <LinearGradient
                colors={['#1c1c1c', '#000000']}
                locations={[0, 0.8]}
                style={StyleSheet.absoluteFill}
            />

            {/* Render items only after we know dimensions to keep them in bounds */}
            {dimensions.width > 0 && FOOD_ITEMS.map((source, i) => (
                <FloatingItem
                    key={i}
                    index={i}
                    source={source}
                    containerWidth={dimensions.width}
                    containerHeight={dimensions.height}
                />
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
        overflow: 'hidden', // Ensure items don't fly out on web
    },
    logoContainer: {
        width: 250,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: '100%',
        height: '100%',
    }
});
