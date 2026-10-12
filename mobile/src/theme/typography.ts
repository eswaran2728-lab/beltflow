import type { TextStyle } from 'react-native';

/**
 * BeltFlow Typography Design Tokens
 * Incorporates Space Grotesk for headings and Inter for body copy,
 * with fallbacks to system fonts for native rendering.
 */

export const fontFamilies = {
  heading: 'Space Grotesk, -apple-system, sans-serif',
  body: 'Inter, -apple-system, sans-serif',
  bodyMedium: 'Inter, -apple-system, sans-serif',
  bodySemiBold: 'Inter, -apple-system, sans-serif',
};

export interface TypographyScale {
  display: TextStyle;
  pageTitle: TextStyle;
  sectionHeading: TextStyle;
  titleMedium: TextStyle;
  bodyLarge: TextStyle;
  bodyMedium: TextStyle;
  caption: TextStyle;
  button: TextStyle;
  statNumber: TextStyle;
}

export const typography: TypographyScale = {
  display: {
    fontFamily: fontFamilies.heading,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  pageTitle: {
    fontFamily: fontFamilies.heading,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionHeading: {
    fontFamily: fontFamilies.heading,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  titleMedium: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  bodyLarge: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  caption: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statNumber: {
    fontFamily: fontFamilies.heading,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
};
