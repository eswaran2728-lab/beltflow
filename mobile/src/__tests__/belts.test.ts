import {
  DEFAULT_BELT_TEMPLATE,
  isLightBelt,
  getBeltTextColor,
  getBeltBorderColor,
  resolveBeltDisplay,
  getNextBeltLevel,
  isStudentEligibleForGrading,
  createDefaultPersatuanBelts,
  BeltLevelConfig,
  PersatuanBeltSystem,
} from '../theme/belts';

describe('BeltFlow Configurable Multi-Tenant Belt Architecture — Task 1.2 Correction', () => {
  describe('1. Default Belt Template Compatibility', () => {
    test('preserves the existing BeltFlow 8-rank progression as a default template only', () => {
      expect(DEFAULT_BELT_TEMPLATE).toHaveLength(8);
      expect(DEFAULT_BELT_TEMPLATE[0].name).toBe('White Belt');
      expect(DEFAULT_BELT_TEMPLATE[1].name).toBe('Yellow Belt');
      expect(DEFAULT_BELT_TEMPLATE[7].name).toBe('Black Belt');
      expect(DEFAULT_BELT_TEMPLATE[0].colorHex).toBe('#FFFFFF');
      expect(DEFAULT_BELT_TEMPLATE[1].colorHex).toBe('#FACC15');
    });

    test('createDefaultPersatuanBelts returns an isolated template instance for an organization', () => {
      const orgSystem = createDefaultPersatuanBelts('org_selangor_1', 'Silambam');
      expect(orgSystem.organizationId).toBe('org_selangor_1');
      expect(orgSystem.martialArtStyle).toBe('Silambam');
      expect(orgSystem.belts).toHaveLength(8);
    });
  });

  describe('2. Multi-Tenant Isolation & Custom Sequences', () => {
    // Persatuan A: Traditional 6-Rank Silambam (White, Yellow, Green, Blue, Brown, Black Asan)
    const persatuanA: PersatuanBeltSystem = {
      organizationId: 'org_persatuan_a',
      systemName: 'Traditional Silambam Syllabus',
      martialArtStyle: 'Silambam',
      belts: [
        { id: 'pa_w', name: 'Vellai (White)', order: 1, colorHex: '#FFFFFF', minMonthsRequired: 0 },
        { id: 'pa_y', name: 'Manjal (Yellow)', order: 2, colorHex: '#FACC15', minMonthsRequired: 3, minSessionsRequired: 24, gradingFee: 50 },
        { id: 'pa_g', name: 'Pachai (Green)', order: 3, colorHex: '#22C55E', minMonthsRequired: 6, minSessionsRequired: 48, gradingFee: 70 },
        { id: 'pa_b', name: 'Neelam (Blue)', order: 4, colorHex: '#3B82F6', minMonthsRequired: 9, minSessionsRequired: 72, gradingFee: 90 },
        { id: 'pa_br', name: 'Kapi (Brown)', order: 5, colorHex: '#92400E', minMonthsRequired: 12, minSessionsRequired: 96, gradingFee: 120 },
        { id: 'pa_bl', name: 'Karuppu (Black Asan)', order: 6, colorHex: '#0F172A', minMonthsRequired: 24, minSessionsRequired: 192, gradingFee: 250, isDanRank: true, danLevel: 1 },
      ],
    };

    // Persatuan B: Modern 10-Rank Academy (White, Yellow, Orange, Green, Blue, Purple, Red, Brown, 1st Dan, 2nd Dan)
    const persatuanB: PersatuanBeltSystem = {
      organizationId: 'org_persatuan_b',
      systemName: 'Modern Sport Silambam & Weapons',
      martialArtStyle: 'Silambam Sports',
      belts: [
        { id: 'pb_1', name: 'Grade 1 White', order: 1, colorHex: '#FFFFFF' },
        { id: 'pb_2', name: 'Grade 2 Yellow', order: 2, colorHex: '#EAB308' },
        { id: 'pb_3', name: 'Grade 3 Orange', order: 3, colorHex: '#F97316' },
        { id: 'pb_4', name: 'Grade 4 Green', order: 4, colorHex: '#16A34A' },
        { id: 'pb_5', name: 'Grade 5 Blue', order: 5, colorHex: '#2563EB' },
        { id: 'pb_6', name: 'Grade 6 Purple', order: 6, colorHex: '#9333EA' },
        { id: 'pb_7', name: 'Grade 7 Red', order: 7, colorHex: '#DC2626' },
        { id: 'pb_8', name: 'Grade 8 Brown', order: 8, colorHex: '#78350F' },
        { id: 'pb_9', name: 'Junior Black Belt', order: 9, colorHex: '#1E293B' },
        { id: 'pb_10', name: 'Master Dan 1', order: 10, colorHex: '#000000', isDanRank: true, danLevel: 1 },
      ],
    };

    test('Persatuan A and Persatuan B have completely different belt counts and sequences', () => {
      expect(persatuanA.belts).toHaveLength(6);
      expect(persatuanB.belts).toHaveLength(10);
      expect(persatuanA.belts[1].name).toBe('Manjal (Yellow)');
      expect(persatuanB.belts[1].name).toBe('Grade 2 Yellow');
    });

    test('tenant configurations remain isolated and do not leak between academies', () => {
      const nextA = getNextBeltLevel('Manjal (Yellow)', persatuanA.belts);
      expect(nextA?.name).toBe('Pachai (Green)');

      const nextB = getNextBeltLevel('Grade 2 Yellow', persatuanB.belts);
      expect(nextB?.name).toBe('Grade 3 Orange');

      // Grade 3 Orange does not exist in Persatuan A
      const invalidInA = getNextBeltLevel('Grade 3 Orange', persatuanA.belts);
      expect(invalidInA).toBeNull();
    });

    test('Black Belt and Dan ranks are fully configurable per Persatuan rather than globally hardcoded', () => {
      const topRankA = persatuanA.belts[persatuanA.belts.length - 1];
      expect(topRankA.name).toBe('Karuppu (Black Asan)');
      expect(topRankA.danLevel).toBe(1);

      const topRankB = persatuanB.belts[persatuanB.belts.length - 1];
      expect(topRankB.name).toBe('Master Dan 1');
      expect(topRankB.danLevel).toBe(1);
    });
  });

  describe('3. Grading Eligibility Logic', () => {
    const greenBelt: BeltLevelConfig = {
      id: 'g1',
      name: 'Green Belt',
      order: 3,
      colorHex: '#22C55E',
      minMonthsRequired: 6,
      minSessionsRequired: 40,
      gradingFee: 80,
    };

    test('validates student eligibility based on Persatuan-specific criteria', () => {
      const eligibleResult = isStudentEligibleForGrading(greenBelt, {
        monthsTrained: 6,
        sessionsAttended: 42,
      });
      expect(eligibleResult.eligible).toBe(true);
      expect(eligibleResult.missingMonths).toBe(0);
      expect(eligibleResult.missingSessions).toBe(0);

      const notEligibleResult = isStudentEligibleForGrading(greenBelt, {
        monthsTrained: 4,
        sessionsAttended: 30,
      });
      expect(notEligibleResult.eligible).toBe(false);
      expect(notEligibleResult.missingMonths).toBe(2);
      expect(notEligibleResult.missingSessions).toBe(10);
    });
  });

  describe('4. Historical Record Preservation & Fallback Resolution', () => {
    test('preserves historical belt names gracefully even if not in the current system', () => {
      const customBelts: BeltLevelConfig[] = [
        { id: 'c1', name: 'White', order: 1, colorHex: '#FFFFFF' },
        { id: 'c2', name: 'Black', order: 2, colorHex: '#000000' },
      ];

      // Student has a historical belt label from a previous grading year
      const historicalDisplay = resolveBeltDisplay('Honorary Red Belt 2024', customBelts);
      expect(historicalDisplay.name).toBe('Honorary Red Belt 2024');
      // Should intelligently pick red or fallback neutral color
      expect(historicalDisplay.colorHex).toBe('#EF4444');
      expect(historicalDisplay.textColor).toBe('#FFFFFF');
    });

    test('resolveBeltDisplay accurately resolves by ID or by name', () => {
      const customBelts: BeltLevelConfig[] = [
        { id: 'b_gold', name: 'Gold Sash', order: 1, colorHex: '#F59E0B' },
      ];

      const byId = resolveBeltDisplay('b_gold', customBelts);
      expect(byId.name).toBe('Gold Sash');

      const byName = resolveBeltDisplay('Gold Sash', customBelts);
      expect(byName.name).toBe('Gold Sash');
    });
  });

  describe('5. WCAG Contrast & Presentation Helpers', () => {
    test('isLightBelt, getBeltTextColor, and getBeltBorderColor handle accessibility dynamically', () => {
      expect(isLightBelt('#FFFFFF')).toBe(true);
      expect(isLightBelt('#FACC15')).toBe(true);
      expect(isLightBelt('#0F172A')).toBe(false);

      expect(getBeltTextColor('#FFFFFF')).toBe('#0F172A');
      expect(getBeltTextColor('#FACC15')).toBe('#0F172A');
      expect(getBeltTextColor('#0F172A')).toBe('#FFFFFF');
      expect(getBeltTextColor('#3B82F6')).toBe('#FFFFFF');

      expect(getBeltBorderColor('#FFFFFF')).toBe('#CBD5E1');
      expect(getBeltBorderColor('#0F172A')).toBe('transparent');
    });
  });
});
