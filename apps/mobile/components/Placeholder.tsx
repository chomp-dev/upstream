import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface PlaceholderProps {
    width: number;
    height: number;
}

// Collection of aesthetic gradients
const GRADIENTS = [
    ['#4158D0', '#C850C0', '#FFCC70'], // Blue-Pink-Gold
    ['#0093E9', '#80D0C7'], // Blue-Cyan
    ['#8EC5FC', '#E0C3FC'], // Light Blue-Purple
    ['#D9AFD9', '#97D9E1'], // Pink-Blue
    ['#FBAB7E', '#F7CE68'], // Orange-Yellow
    ['#2c3e50', '#3498db'], // Dark Blue
    ['#1a2a6c', '#b21f1f', '#fdbb2d'], // Navy-Red-Gold
] as const;

export function Placeholder({ width, height }: PlaceholderProps) {
    // Use a random gradient for variety
    // In a real app we might want to be deterministic based on an ID
    const colors = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

    return (
        <View style={[styles.container, { width, height }]}>
            <LinearGradient
                colors={[...colors]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#222',
    },
});
