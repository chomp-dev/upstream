import axios from 'axios';
import { User } from 'react-native-auth0';

const API_URL = process.env.EXPO_PUBLIC_MEDIA_API_BASE;

export const syncUser = async (user: User, accessToken: string) => {
    if (!API_URL) {
        console.error('EXPO_PUBLIC_MEDIA_API_BASE is not defined');
        return;
    }

    try {
        const response = await axios.post(
            `${API_URL}/api/users`,
            {
                auth0Id: user.sub,
                email: user.email,
                name: user.name,
                picture: user.picture,
                emailVerified: user.emailVerified,
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error syncing user:', error);
        throw error;
    }
};
