import { BrandColors, lightThemeColors, darkThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius, elevation, layout, iconSize } from '../theme/spacing';
import { BELT_RANKS, getBeltConfig, isLightBelt } from '../theme/belts';

describe('BeltFlow Design System — Task 1.2 Tokens & Foundations', () => {
  describe('Brand Colors', () => {
    test('defines exact verified BeltFlow Navy and Amber brand colors', () => {
      expect(BrandColors.navy).toBe('#0D2B47');
      expect(BrandColors.navyDark).toBe('#061828');
      expect(BrandColors.navyLight).toBe('#153C61');
      expect(BrandColors.navySurface).toBe('#091E32');
      expect(BrandColors.amber).toBe('#F2941C');
      expect(BrandColors.amberHover).toBe('#D97E0F');
      expect(BrandColors.amberSoft).toBe('#FFF7ED');
      expect(BrandColors.success).toBe('#10B981');
      expect(BrandColors.danger).toBe('#EF4444');
      expect(BrandColors.info).toBe('#3B82F6');
    });
  });

  describe('Semantic Color Mappings (Light & Dark)', () => {
    test('light theme provides proper contrast and clean card surfaces', () => {
      expect(lightThemeColors.background).toBe('#F8FAFC');
      expect(lightThemeColors.surface).toBe('#FFFFFF');
      expect(lightThemeColors.textPrimary).toBe('#0F172A');
      expect(lightThemeColors.textSecondary).toBe('#475569');
      expect(lightThemeColors.border).toBe('#E2E8F0');
      expect(lightThemeColors.buttonPrimaryBg).toBe(BrandColors.navy);
      expect(lightThemeColors.buttonPrimaryText).toBe('#FFFFFF');
      expect(lightThemeColors.offlineBg).toBe('#FEF3C7');
    });

    test('dark theme provides BeltFlow signature dark navy surfaces and legible text', () => {
      expect(darkThemeColors.background).toBe(BrandColors.navyDark);
      expect(darkThemeColors.surface).toBe(BrandColors.navy);
      expect(darkThemeColors.surfaceElevated).toBe(BrandColors.navyLight);
      expect(darkThemeColors.textPrimary).toBe('#F8FAFC');
      expect(darkThemeColors.textSecondary).toBe('#CBD5E1');
      expect(darkThemeColors.border).toBe('#1E3A5F');
      expect(darkThemeColors.buttonPrimaryBg).toBe(BrandColors.amber);
      expect(darkThemeColors.buttonPrimaryText).toBe('#FFFFFF');
      expect(darkThemeColors.offlineBg).toBe('#78350F');
    });

    test('both themes contain identical semantic keys', () => {
      const lightKeys = Object.keys(lightThemeColors).sort();
      const darkKeys = Object.keys(darkThemeColors).sort();
      expect(lightKeys).toEqual(darkKeys);
    });
  });

  describe('Typography Scale', () => {
    test('defines required hierarchical scales with lineHeights and weights', () => {
      expect(typography.display.fontSize).toBe(32);
      expect(typography.display.lineHeight).toBe(40);
      expect(typography.display.fontWeight).toBe('700');

      expect(typography.pageTitle.fontSize).toBe(24);
      expect(typography.pageTitle.lineHeight).toBe(30);

      expect(typography.sectionHeading.fontSize).toBe(18);
      expect(typography.sectionHeading.lineHeight).toBe(24);

      expect(typography.bodyLarge.fontSize).toBe(15);
      expect(typography.bodyLarge.lineHeight).toBe(22);

      expect(typography.bodyMedium.fontSize).toBe(13);
      expect(typography.bodyMedium.lineHeight).toBe(18);

      expect(typography.caption.fontSize).toBe(11);
      expect(typography.caption.lineHeight).toBe(14);

      expect(typography.button.fontSize).toBe(14);
      expect(typography.button.fontWeight).toBe('600');

      expect(typography.statNumber.fontSize).toBe(28);
      expect(typography.statNumber.fontWeight).toBe('700');
    });
  });

  describe('Spacing, Layout, Radius and Elevation', () => {
    test('defines spacing scale with multiples of 4', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.lg).toBe(16);
      expect(spacing.xl).toBe(20);
      expect(spacing.xxl).toBe(24);
      expect(spacing.xxxl).toBe(32);
    });

    test('defines border radiuses including full pill', () => {
      expect(borderRadius.sm).toBe(6);
      expect(borderRadius.md).toBe(10);
      expect(borderRadius.lg).toBe(16);
      expect(borderRadius.full).toBe(9999);
    });

    test('layout respects touch targets and padding standards', () => {
      expect(layout.minTouchTarget).toBeGreaterThanOrEqual(44);
      expect(layout.screenPadding).toBe(16);
      expect(layout.cardPadding).toBe(16);
    });

    test('icon sizes are standardized', () => {
      expect(iconSize.sm).toBe(16);
      expect(iconSize.md).toBe(20);
      expect(iconSize.lg).toBe(24);
      expect(iconSize.xl).toBe(32);
    });

    test('elevation provides shadow configurations', () => {
      expect(elevation.sm).toBeDefined();
      expect(elevation.md).toBeDefined();
      expect(elevation.lg).toBeDefined();
    });
  });

  describe('Belt Rank Colors & Sequencing', () => {
    test('contains exact verified BeltFlow martial arts belt ranks in order', () => {
      expect(BELT_RANKS).toHaveLength(8);
      expect(BELT_RANKS[0].name).toBe('White Belt');
      expect(BELT_RANKS[1].name).toBe('Yellow Belt');
      expect(BELT_RANKS[2].name).toBe('Green Belt');
      expect(BELT_RANKS[3].name).toBe('Blue Belt');
      expect(BELT_RANKS[4].name).toBe('Red Belt');
      expect(BELT_RANKS[5].name).toBe('Brown Belt');
      expect(BELT_RANKS[6].name).toBe('Purple Belt');
      expect(BELT_RANKS[7].name).toBe('Black Belt');
    });

    test('getBeltConfig maps ranks and aliases correctly', () => {
      const white = getBeltConfig('White Belt');
      expect(white.colorHex).toBe('#FFFFFF');
      expect(white.textColor).toBe('#0F172A');

      const yellow = getBeltConfig('Yellow Belt');
      expect(yellow.colorHex).toBe('#FACC15');
      expect(yellow.textColor).toBe('#0F172A');

      const blackAsan = getBeltConfig('Black Belt (Asan)');
      expect(blackAsan.colorHex).toBe('#0F172A');
      expect(blackAsan.textColor).toBe('#FFFFFF');

      const blackDan = getBeltConfig('Black Belt (1st Dan)');
      expect(blackDan.colorHex).toBe('#0F172A');
      expect(blackDan.textColor).toBe('#FFFFFF');
    });

    test('isLightBelt correctly identifies belts requiring dark text', () => {
      expect(isLightBelt('#FFFFFF')).toBe(true);
      expect(isLightBelt('#E2E8F0')).toBe(true);
      expect(isLightBelt('#FACC15')).toBe(true);
      expect(isLightBelt('#0F172A')).toBe(false);
      expect(isLightBelt('#3B82F6')).toBe(false);
    });
  });
});
