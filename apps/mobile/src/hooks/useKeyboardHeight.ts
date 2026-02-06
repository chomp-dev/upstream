import { useEffect, useState } from 'react';
import { Keyboard, Platform, KeyboardEvent, Dimensions } from 'react-native';

/**
 * Hook to get the current keyboard height for proper positioning
 * Returns 0 when keyboard is hidden, keyboard height when visible
 */
export function useKeyboardHeight() {
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const handleShow = (event: KeyboardEvent) => {
            setKeyboardHeight(event.endCoordinates.height);
        };

        const handleHide = () => {
            setKeyboardHeight(0);
        };

        const showSubscription = Keyboard.addListener(showEvent, handleShow);
        const hideSubscription = Keyboard.addListener(hideEvent, handleHide);

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    return keyboardHeight;
}

/**
 * Get bottom safe area inset (home indicator area on iPhone X+)
 * Standard values: 34 for iPhone X+, 0 for older devices
 */
export function getBottomSafeInset(): number {
    const { height } = Dimensions.get('window');
    // iPhone X+ has screen height >= 812 and home indicator
    const hasHomeIndicator = Platform.OS === 'ios' && height >= 812;
    return hasHomeIndicator ? 34 : 0;
}

export default useKeyboardHeight;
