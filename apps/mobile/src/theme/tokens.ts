/**
 * Chomp Design Tokens
 * Warm, appetizing food discovery theme
 */

export const colors = {
  // Background layers - warm charcoal tones
  bg: '#0D0B0A',
  surface: '#1A1614',
  card: '#231E1B',
  elevated: '#2C2520',
  
  // Text colors - warm cream tones
  text: '#FAF7F2',
  textSecondary: '#B8AFA6',
  muted: '#7A716A',
  
  // Border & dividers
  border: 'rgba(255, 248, 240, 0.12)',
  borderSubtle: 'rgba(255, 248, 240, 0.06)',
  
  // Primary accent - warm coral/tomato (appetizing, food-like)
  primary: '#E85D4C',
  primaryLight: '#FF7A6B',
  primaryMuted: '#C44D3F',
  
  // Secondary accents
  amber: '#E8A94D',       // Golden - ratings, stars
  terracotta: '#C47D5C',  // Earthy warmth
  sage: '#7BA37B',        // Fresh, salad greens
  cream: '#F5E6D3',       // Warm highlight
  
  // Legacy aliases (for compatibility)
  lime: '#E85D4C',        // Now maps to primary coral
  blue: '#6B9AC4',        // Softer, warmer blue
  coral: '#E85D4C',       // Primary
  purple: '#9B7BB8',      // Muted purple
  cyan: '#6BBAB8',        // Teal, softer
  
  // Rating bucket colors - warm tones
  ratingExcellent: '#5DB075',  // >= 4.5 - Fresh green
  ratingGood: '#7BA37B',       // >= 4.0 - Sage
  ratingAverage: '#E8A94D',    // >= 3.5 - Amber
  ratingBelowAverage: '#D97B5C', // < 3.5 - Muted orange
  
  // Semantic colors
  success: '#5DB075',
  warning: '#E8A94D',
  error: '#D95D4C',
  info: '#6B9AC4',
  
  // Overlay & transparency
  overlay: 'rgba(13, 11, 10, 0.85)',
  overlayLight: 'rgba(13, 11, 10, 0.6)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const typography = {
  // Font families (can be customized with expo-font)
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  
  // Font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    display: 48,
  },
  
  // Line heights (multipliers)
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
  
  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  }),
} as const;

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// Tab bar configuration
export const tabBar = {
  height: 80,
  iconSize: 24,
  createButtonSize: 56,
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
