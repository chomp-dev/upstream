
import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions, Image as RNImage } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import Constants from 'expo-constants';

const { width, height } = Dimensions.get('window');

// Local Assets
const ASSETS = {
    logo: require('../assets/images/chomp_logo.png'),
    burger: require('../assets/images/splash_assets/burger.png'),
    pizza: require('../assets/images/splash_assets/pizza.png'),
    taco: require('../assets/images/splash_assets/taco.png'),
    sushi: require('../assets/images/splash_assets/sushi.png'),
    soda: require('../assets/images/splash_assets/soda.png'),
};

interface SplashAnimationProps {
    onComplete: () => void;
}

// Floating item interface
interface FloatingItemProps {
    source: any;
    delay: number;
    initialX: number;
    initialY: number;
    size: number;
}

const FloatingItem: React.FC<FloatingItemProps> = ({ source, delay, initialX, initialY, size }) => {
    const translateY = useSharedValue(0);
    const rotate = useSharedValue(0);

    useEffect(() => {
        // Floating animation
        translateY.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(-20, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            )
        );

        // Rotation animation
        rotate.value = withDelay(
            delay,
            withRepeat(
                withTiming(15, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            )
        );
    }, []);

    const style = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: translateY.value },
                { rotate: `${rotate.value}deg` }
            ],
            position: 'absolute',
            left: initialX,
            top: initialY,
            width: size,
            height: size,
        };
    });

    return (
        <Animated.View style={style}>
            <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Animated.View>
    );
};

export default function SplashAnimation({ onComplete }: SplashAnimationProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);
    const bgOpacity = useSharedValue(1);

    useEffect(() => {
        // Main sequence
        const timeout = setTimeout(() => {
            // Trigger exit animation
            scale.value = withTiming(50, { duration: 800, easing: Easing.cubic }, () => {
                runOnJS(onComplete)();
            });
            bgOpacity.value = withTiming(0, { duration: 300 });
        }, 3000); // Show splash for 3 seconds

        return () => clearTimeout(timeout);
    }, []);

    const logoStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const containerStyle = useAnimatedStyle(() => {
        return {
            opacity: bgOpacity.value,
        };
    });

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            {/* Background elements */}
            <FloatingItem source={ASSETS.burger} delay={0} initialX={width * 0.1} initialY={height * 0.15} size={100} />
            <FloatingItem source={ASSETS.pizza} delay={500} initialX={width * 0.7} initialY={height * 0.2} size={110} />
            <FloatingItem source={ASSETS.taco} delay={1000} initialX={width * 0.1} initialY={height * 0.6} size={90} />
            <FloatingItem source={ASSETS.sushi} delay={200} initialX={width * 0.75} initialY={height * 0.7} size={80} />
            <FloatingItem source={ASSETS.soda} delay={800} initialX={width * 0.4} initialY={height * 0.8} size={90} />

            {/* Center Logo */}
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
        backgroundColor: '#000000',
        zIndex: 99999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        width: 200,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: '100%',
        height: '100%',
    }
});
