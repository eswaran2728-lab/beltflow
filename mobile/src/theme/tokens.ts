import { Platform } from 'react-native';
/**
 * BeltFlow Design System — Google Stitch Approved Design Tokens
 * Extracted directly from official Google Stitch visual reference
 * (BeltFlow Mobile.dc.html & BeltFlow.dc.html)
 */

export const StitchTokens = {
  colors: {
    // Brand Navy Surfaces & Headers
    brandNavy: '#0D2B47',
    brandNavyLight: '#123A5E',
    brandNavyTint: '#EAF1F7',
    brandNavySurface: '#091E32',

    // Accent Amber Palette
    colorAccent: '#F2941C',
    colorAccentHover: '#D97E0F',
    colorAccentSoft: '#FFF7ED',
    colorAccentBorder: '#FED7AA',

    // Semantic Greens (Present, Verified, Success)
    bfGreen: '#10B981',
    bfGreenSoft: '#DCFCE7',
    bfGreenDark: '#15803D',

    // Semantic Reds (At-Risk Absence, Alerts, Danger)
    bfRed: '#EF4444',
    bfRedSoft: '#FFF1F2',
    bfRedBorder: '#FECDD3',
    bfRedDark: '#9F1239',

    // Backgrounds, Borders, Neutrals
    slateBackground: '#F4F6FA',
    slateBorder: '#E4E9F0',
    slateBorderSubtle: '#CBD5E1',
    slateTextMain: '#0F172A',
    slateTextMuted: '#64748B',
    white: '#FFFFFF',
  },

  typography: {
    // H28: system font (covers Tamil); see theme/typography.ts.
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }) as string | undefined,
    weights: {
      regular: '400',
      medium: '500',
      semiBold: '600',
      bold: '700',
      extraBold: '800',
    } as const,
    sizes: {
      tag: 11,
      caption: 12,
      bodySm: 13,
      body: 14,
      bodyLg: 16,
      subheading: 17,
      heading: 19,
      title: 26,
      kpiNumber: 30,
    },
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 6,
    md: 8,
    cardPad: 16,
    lg: 16,
    xl: 18,
    xxl: 24,
    topBarPad: 52,
  },

  radii: {
    tagMini: 6,
    btnSm: 10,
    btn: 14,
    cardMini: 14,
    cardLarge: 18,
    chip: 12,
    pill: 9999,
  },

  shadows: {
    // 3D slab: soft shadow plus a visible bottom edge.
    card: {
      shadowColor: '#0D2B47',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      borderBottomWidth: 3,
      borderBottomColor: '#D6DDE8',
    },
    cardElevated: {
      shadowColor: '#0D2B47',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.09,
      shadowRadius: 16,
      elevation: 4,
      borderBottomWidth: 3,
      borderBottomColor: '#D6DDE8',
    },
  },

  animation: {
    fast: 150,
    normal: 250,
    springDamping: 0.8,
  },

  a11y: {
    minTouchTarget: 44,
  },
} as const;

export type StitchTokensType = typeof StitchTokens;
