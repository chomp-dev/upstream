import { useWindowDimensions, Platform } from 'react-native';

const MAX_WEB_WIDTH = 500;

export function useContentDimensions() {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    // Subtract Tab Bar height to ensure full content visibility above tabs
    // Tab bar is ~88px on iOS, ~70px on Android/Web + safe area
    const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 70;

    if (Platform.OS === 'web') {
        return {
            width: Math.min(windowWidth, MAX_WEB_WIDTH),
            height: windowHeight - TAB_BAR_HEIGHT,
            isMobileWeb: windowWidth <= MAX_WEB_WIDTH,
        };
    }

    return {
        width: windowWidth,
        height: windowHeight - TAB_BAR_HEIGHT,
        isMobileWeb: true,
    };
}
