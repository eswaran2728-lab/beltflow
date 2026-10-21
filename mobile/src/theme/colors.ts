/**
 * BeltFlow Design System — Colors & Semantic Theme System
 * Preserves the exact verified BeltFlow Navy & Amber visual identity.
 */

export const BrandColors = {
  // Brand Navy Palette
  navy: '#0D2B47',
  navyDark: '#061828',
  navyLight: '#153C61',
  navySurface: '#091E32',

  // Accent Amber / Gold
  amber: '#F2941C',
  amberHover: '#D97E0F',
  amberSoft: '#FFF7ED',
  amberBorder: '#FED7AA',

  // Neutrals & Slate Palette
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',

  // Semantic Feedback
  success: '#10B981',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',

  // Explicit Aliases for BeltFlow Standards
  PrimaryNavy: '#0D2B47',
  DeepNavy: '#061828',
  SecondaryNavy: '#153C61',
  Amber: '#F2941C',
} as const;

export interface ThemeColors {
  // Surfaces & Backgrounds
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  text: string;

  // Borders & Dividers
  border: string;
  borderLight: string;
  borderFocused: string;

  // Interactive States
  disabled: string;
  disabledText: string;

  // Buttons
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonOutlineBorder: string;
  buttonOutlineText: string;
  buttonDangerBg: string;
  buttonDangerText: string;

  // Status Badges
  badgeSuccessBg: string;
  badgeSuccessText: string;
  badgeWarningBg: string;
  badgeWarningText: string;
  badgeDangerBg: string;
  badgeDangerText: string;
  badgeInfoBg: string;
  badgeInfoText: string;
  badgeNeutralBg: string;
  badgeNeutralText: string;

  // System & Offline
  offlineBg: string;
  offlineText: string;
  errorBg: string;
  errorText: string;
}

export const lightThemeColors: ThemeColors = {
  background: BrandColors.slate50,
  backgroundSecondary: BrandColors.slate100,
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: BrandColors.amberSoft,

  textPrimary: BrandColors.slate900,
  textSecondary: BrandColors.slate600,
  textMuted: BrandColors.slate400,
  textInverse: '#FFFFFF',
  text: BrandColors.slate900,

  border: BrandColors.slate200,
  borderLight: BrandColors.slate100,
  borderFocused: BrandColors.navy,

  disabled: BrandColors.slate200,
  disabledText: BrandColors.slate400,

  buttonPrimaryBg: BrandColors.navy,
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: BrandColors.amber,
  buttonSecondaryText: '#FFFFFF',
  buttonOutlineBorder: BrandColors.navy,
  buttonOutlineText: BrandColors.navy,
  buttonDangerBg: BrandColors.danger,
  buttonDangerText: '#FFFFFF',

  badgeSuccessBg: BrandColors.successBg,
  badgeSuccessText: '#065F46',
  badgeWarningBg: BrandColors.warningBg,
  badgeWarningText: '#92400E',
  badgeDangerBg: BrandColors.dangerBg,
  badgeDangerText: '#991B1B',
  badgeInfoBg: BrandColors.infoBg,
  badgeInfoText: '#1E40AF',
  badgeNeutralBg: BrandColors.slate100,
  badgeNeutralText: BrandColors.slate600,

  offlineBg: '#FEF3C7',
  offlineText: '#92400E',
  errorBg: BrandColors.dangerBg,
  errorText: '#991B1B',
};

export const darkThemeColors: ThemeColors = {
  background: BrandColors.navyDark,
  backgroundSecondary: BrandColors.navySurface,
  surface: BrandColors.navy,
  surfaceElevated: BrandColors.navyLight,
  surfaceHighlight: BrandColors.navySurface,

  textPrimary: BrandColors.slate50,
  textSecondary: BrandColors.slate300,
  textMuted: BrandColors.slate400,
  textInverse: BrandColors.slate900,
  text: BrandColors.slate50,

  border: '#1E3A5F',
  borderLight: '#153350',
  borderFocused: BrandColors.amber,

  disabled: '#1A334D',
  disabledText: BrandColors.slate500,

  buttonPrimaryBg: BrandColors.amber,
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: BrandColors.navyLight,
  buttonSecondaryText: '#FFFFFF',
  buttonOutlineBorder: BrandColors.amber,
  buttonOutlineText: BrandColors.amber,
  buttonDangerBg: BrandColors.danger,
  buttonDangerText: '#FFFFFF',

  badgeSuccessBg: '#064E3B',
  badgeSuccessText: '#6EE7B7',
  badgeWarningBg: '#78350F',
  badgeWarningText: '#FDE68A',
  badgeDangerBg: '#7F1D1D',
  badgeDangerText: '#FCA5A5',
  badgeInfoBg: '#1E3A8A',
  badgeInfoText: '#93C5FD',
  badgeNeutralBg: BrandColors.navySurface,
  badgeNeutralText: BrandColors.slate300,

  offlineBg: '#78350F',
  offlineText: '#FDE68A',
  errorBg: '#7F1D1D',
  errorText: '#FCA5A5',
};

/**
 * Backward compatibility alias preserving Task 1.1 contracts.
 */
export const Colors = {
  ...BrandColors,
  slate: BrandColors.slate50,
  cardBg: '#FFFFFF',
  cardBgDark: '#0A2238',
  border: BrandColors.slate200,
  borderDark: '#1E3A5F',
  textPrimary: BrandColors.slate900,
  textSecondary: BrandColors.slate500,
  textMuted: BrandColors.slate400,
  textLight: BrandColors.slate50,
  textLightMuted: '#93C5FD',
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
