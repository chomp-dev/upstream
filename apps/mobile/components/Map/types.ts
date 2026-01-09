import type * as Location from 'expo-location';
import type { Restaurant } from '../../src/lib/api/types';

export interface MapImplProps {
  restaurants: Restaurant[];
  location: Location.LocationObject;
  currentRadius: number;
  selectedRestaurant: Restaurant | null;
  onSelectRestaurant: (restaurant: Restaurant | null) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}
