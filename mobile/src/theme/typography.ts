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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  pageTitle: {
    fontFamily: fontFamilies.heading,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sectionHeading: {
    fontFamily: fontFamilies.heading,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  titleMedium: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  bodyLarge: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  caption: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  button: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  statNumber: {
    fontFamily: fontFamilies.heading,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
};
