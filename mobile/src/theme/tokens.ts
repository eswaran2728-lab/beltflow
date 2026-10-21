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
    slateBackground: '#F8FAFC',
    slateBorder: '#E2E8F0',
    slateBorderSubtle: '#CBD5E1',
    slateTextMain: '#0F172A',
    slateTextMuted: '#64748B',
    white: '#FFFFFF',
  },

  typography: {
    fontFamily: 'Space Grotesk, -apple-system, sans-serif',
    weights: {
      regular: '400',
      medium: '500',
      semiBold: '600',
      bold: '700',
      extraBold: '800',
    } as const,
    sizes: {
      tag: 10,
      caption: 11,
      bodySm: 12,
      body: 13,
      bodyLg: 15,
      subheading: 16,
      heading: 18,
      title: 24,
      kpiNumber: 28,
    },
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 6,
    md: 8,
    cardPad: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    topBarPad: 52,
  },

  radii: {
    tagMini: 4,
    btnSm: 6,
    btn: 8,
    cardMini: 12,
    cardLarge: 14,
    chip: 12,
    pill: 9999,
  },

  shadows: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    cardElevated: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
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
