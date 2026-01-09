import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

export const getMarkerIcon = (primaryType: string | null | undefined, isSelected: boolean) => {
    const color = isSelected ? colors.primary : colors.text;
    const size = isSelected ? 20 : 18;

    if (!primaryType) {
        return <Ionicons name="restaurant-outline" size={size} color={color} />;
    }

    const type = primaryType.toLowerCase();

    if (type.includes('coffee') || type.includes('cafe'))
        return <Ionicons name="cafe-outline" size={size} color={color} />;
    if (type.includes('ice_cream'))
        return <Ionicons name="ice-cream-outline" size={size} color={color} />;
    if (type.includes('bakery'))
        return <MaterialCommunityIcons name="baguette" size={size} color={color} />;
    if (type.includes('pizza'))
        return <Ionicons name="pizza-outline" size={size} color={color} />;
    if (type.includes('burger') || type.includes('hamburger'))
        return <MaterialCommunityIcons name="hamburger" size={size} color={color} />;
    if (type.includes('fast_food'))
        return <MaterialCommunityIcons name="french-fries" size={size} color={color} />;
    if (type.includes('bar'))
        return <Ionicons name="beer-outline" size={size} color={color} />;
    if (type.includes('dessert') || type.includes('sweet'))
        return <MaterialCommunityIcons name="cupcake" size={size} color={color} />;

    // Default restaurant icon
    return <Ionicons name="restaurant-outline" size={size} color={color} />;
};
