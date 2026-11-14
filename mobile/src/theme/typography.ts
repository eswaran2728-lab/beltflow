import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * BeltFlow Typography Design Tokens
 * Uses the platform system font (see H28 note below); sizes and weights
 * carry the Stitch hierarchy.
 */

// H28 Tamil_font_coverage: no custom font files are bundled, and CSS-style
// stacks ("Inter, -apple-system, sans-serif") are not valid in React Native.
// The platform system font is used everywhere; it includes Tamil glyphs
// (Android: Noto Sans Tamil; iOS: Tamil Sangam MN) and Malay/English.
const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: undefined });

export const fontFamilies = {
  heading: SYSTEM_FONT,
  body: SYSTEM_FONT,
  bodyMedium: SYSTEM_FONT,
  bodySemiBold: SYSTEM_FONT,
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
