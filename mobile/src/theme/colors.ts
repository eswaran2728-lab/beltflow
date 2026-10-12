/**
 * BeltFlow Design System — Color Palette
 * Preserves the exact verified branding from the Web PWA & Android Native apps.
 */
export const Colors = {
  // Brand Navy Palette
  navy: '#0D2B47',
  navyDark: '#061828',
  navyLight: '#153C61',
  navySurface: '#091E32',

  // Accent Amber
  amber: '#F2941C',
  amberHover: '#D97E0F',
  amberSoft: '#FFF7ED',
  amberBorder: '#FED7AA',

  // Neutrals & Backgrounds
  slate: '#F8FAFC',
  cardBg: '#FFFFFF',
  cardBgDark: '#0A2238',
  border: '#E2E8F0',
  borderDark: '#1E3A5F',

  // Typography
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textLight: '#F8FAFC',
  textLightMuted: '#93C5FD',

  // Semantic Feedback
  success: '#10B981',
  successBg: '#ECFDF5',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  info: '#3B82F6',
  infoBg: '#EFF6FF',

  // Belt Colors
  belts: {
    white: '#E2E8F0',
    yellow: '#EAB308',
    orange: '#F97316',
    green: '#22C55E',
    blue: '#3B82F6',
    purple: '#A855F7',
    brown: '#92400E',
    red: '#EF4444',
    black: '#0F172A',
  },
} as const;

export type ColorName = keyof typeof Colors;
