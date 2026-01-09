import { useWindowDimensions, Platform } from 'react-native';

const MAX_WEB_WIDTH = 500;

export function useContentDimensions() {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    if (Platform.OS === 'web') {
        return {
            width: Math.min(windowWidth, MAX_WEB_WIDTH),
            height: windowHeight,
            isMobileWeb: windowWidth <= MAX_WEB_WIDTH,
        };
    }

    return {
        width: windowWidth,
        height: windowHeight,
        isMobileWeb: true, // Native is always "mobile" layout effectively
    };
}
