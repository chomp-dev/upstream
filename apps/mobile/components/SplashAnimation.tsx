
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, LayoutChangeEvent } from 'react-native';
import { Text } from '../src/ui';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    withSpring,
    Easing,
    runOnJS,
    ZoomIn,
    interpolate,
    Extrapolate,
    type SharedValue
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

// Local Assets
const ASSETS = {
    logo: require('../assets/images/chomp_logo.png'),
    bg: require('../assets/images/splash_assets/splash_bg.jpg'),
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
    progress?: number;
    dataReady?: boolean;
    minDisplayMs?: number;
    statusText?: string;
}

// Particle for "Crumbs" Effect
const Crumb = ({ index, total }: { index: number, total: number }) => {
    const angle = (index / total) * 2 * Math.PI;
    const progress = useSharedValue(0);
    const scale = useSharedValue(0);

    useEffect(() => {
        // Explode after logo bounce (around 2200ms into sequence)
        // Wait for absorption (600ms) + small delay
        // Actually, let's trigger it manually or synced with a prop if needed, 
        // but for now keeping it simple with delay relative to mount might be tricky if loading takes long.
        // We'll disable crumbs for this new "clean" animation style as requested ("clean animation") 
        // or re-enable them if we want them during the bounce.
        // Let's remove them for the "clean" look requested.
    }, []);

    return null;
};

interface FloatingItemProps {
    source: any;
    containerWidth: number;
    containerHeight: number;
    index: number;
    total: number;
    absorbing: SharedValue<number>; // 0 to 1
}

const FloatingItem = ({ source, containerWidth, containerHeight, index, total, absorbing }: FloatingItemProps) => {
    // Symmetrical Layout: Circular Orbit
    const radius = Math.min(containerWidth, containerHeight) * 0.35; // 35% of screen
    const angle = (index / total) * 2 * Math.PI;

    // Position on circle center
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const initialX = centerX + Math.cos(angle) * radius - 40; // -40 for half width
    const initialY = centerY + Math.sin(angle) * radius - 40;

    // Center target (where logo is)
    const targetX = centerX - 40;
    const targetY = centerY - 40;

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

    const style = useAnimatedStyle(() => {
        // Interpolate position between initial "orbit" and center "target"
        const currentLeft = interpolate(absorbing.value, [0, 1], [initialX, targetX]);
        const currentTop = interpolate(absorbing.value, [0, 1], [initialY, targetY]);

        // Scale down to 0 when absorbed
        const currentScale = interpolate(absorbing.value, [0, 1], [scale.value, 0]);

        // Face the center when absorbing? Or just spin?
        // Let's spin fast when absorbing
        const absorptionRotate = interpolate(absorbing.value, [0, 1], [0, 360]);

        return {
            transform: [
                { translateY: translateY.value * (1 - absorbing.value) }, // Stop drifting
                { scale: currentScale },
                { rotate: `${rotate.value + absorptionRotate}deg` }
            ],
            position: 'absolute',
            left: currentLeft,
            top: currentTop,
            width: 80,
            height: 80,
            zIndex: 1,
            opacity: 1 - absorbing.value // Fade out slightly as they enter
        };
    });

    return (
        <Animated.View
            style={style}
            entering={ZoomIn.delay(index * 100).duration(800).springify()}
        >
            <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Animated.View>
    );
};

export default function SplashAnimation({
    onComplete,
    progress = 100,
    dataReady = true,
    minDisplayMs = 2000,
    statusText = ''
}: SplashAnimationProps) {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    const [isSequenceStarted, setIsSequenceStarted] = useState(false);

    const logoScale = useSharedValue(0.1); // Start small
    const containerOpacity = useSharedValue(1);
    const progressAnim = useSharedValue(0);
    const absorbing = useSharedValue(0); // 0 = floating, 1 = absorbed

    // Update progress animation
    useEffect(() => {
        progressAnim.value = withTiming(progress / 100, { duration: 200 });
    }, [progress]);

    // Initial logo pop-in
    useEffect(() => {
        logoScale.value = withSpring(1, { damping: 12 });

        // Set minimum display timer
        const timer = setTimeout(() => {
            setMinTimeElapsed(true);
        }, minDisplayMs);

        return () => clearTimeout(timer);
    }, []);

    // Trigger Finish Sequence
    useEffect(() => {
        if (dataReady && minTimeElapsed && !isSequenceStarted) {
            setIsSequenceStarted(true);

            // 1. Absorb Food (Duration: ~600ms)
            absorbing.value = withTiming(1, { duration: 600, easing: Easing.inOut(Easing.cubic) }, () => {
                // 2. Logo Bounce (Chomp effect)
                // Using runOnJS to coordinate complex sequence if needed, but chaining callbacks works

                // Scale up then spring back
                logoScale.value = withSequence(
                    withTiming(1.3, { duration: 150, easing: Easing.out(Easing.quad) }), // Open mouth / Anticipate
                    withSpring(1.0, { damping: 8, stiffness: 200 }) // CHOMP / Settle
                );

                // 3. Fade Out (Total delay ~500ms after bounce starts)
                runOnJS(startFadeOut)();
            });
        }
    }, [dataReady, minTimeElapsed, isSequenceStarted]);

    const startFadeOut = () => {
        setTimeout(() => {
            containerOpacity.value = withTiming(0, { duration: 400 }, () => {
                runOnJS(onComplete)();
            });
        }, 300); // Wait for bounce to finish a bit
    };

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: logoScale.value }],
        zIndex: 10,
    }));

    // Progress bar width animation
    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value * 100}%`,
        opacity: 1 - absorbing.value, // Hide progress bar when absorbing starts
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
    }));

    const handleLayout = (e: LayoutChangeEvent) => {
        setDimensions(e.nativeEvent.layout);
    };

    return (
        <Animated.View style={[styles.container, containerStyle]} onLayout={handleLayout}>
            {/* Background Image with Blur */}
            <Image
                source={ASSETS.bg}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={10}
                priority="high"
            />
            {/* Dark Overlay */}
            <LinearGradient
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
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
                    absorbing={absorbing}
                />
            ))}

            <Animated.View style={[styles.logoContainer, logoStyle]}>
                <Image
                    source={ASSETS.logo}
                    style={styles.logo}
                    contentFit="contain"
                />
            </Animated.View>

            {/* Progress Bar */}
            <Animated.View style={[styles.progressContainer, { opacity: useAnimatedStyle(() => ({ opacity: 1 - absorbing.value })).opacity }]}>
                <View style={styles.progressTrack}>
                    <Animated.View style={[styles.progressFill, progressBarStyle]} />
                </View>
                {statusText ? (
                    <Text variant="caption" color="#eeb57e" style={styles.statusText}>
                        {statusText}
                    </Text>
                ) : null}
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
        backgroundColor: '#0D0B0A',
    },
    logoContainer: {
        width: 300,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: '100%',
        height: '100%',
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
        backgroundColor: 'rgba(255,255,255,0.1)', // Lighter track
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
