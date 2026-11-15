import type { ViewStyle } from 'react-native';

/**
 * BeltFlow Spacing & Layout Design Tokens
 * Establishes consistent 4-point/8-point spacing, border radiuses, and touch targets.
 */

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

export const borderRadius = {
  xs: 6,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  full: 9999,
} as const;

export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const layout = {
  screenPadding: 16,
  cardPadding: 16,
  minTouchTarget: 44, // Minimum 44x44 pt touch target for iOS & Android a11y
  headerHeight: 56,
  bottomBarHeight: 64,
} as const;

export interface ElevationTokens {
  none: ViewStyle;
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
}

export const elevation: ElevationTokens = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  // Soft, wide, navy-tinted shadows: cards float instead of being boxed in.
  sm: {
    shadowColor: '#0D2B47',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#0D2B47',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0D2B47',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 8,
  },
};

/**
 * "3D" depth: surfaces have a visible bottom edge (their thickness) plus a soft
 * shadow, so cards read as slabs and buttons as keys you can press.
 */
export const depth = {
  /** Thickness of the bottom edge. */
  cardEdge: 3,
  buttonEdge: 4,
  /** Edge colours: a darker shade of the face. */
  edge: {
    surface: '#D6DDE8',
    navy: '#061828',
    amber: '#B86808',
    danger: '#B91C1C',
    disabled: '#C5CEDA',
  },
} as const;
