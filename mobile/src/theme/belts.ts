/**
 * BeltFlow Configurable Multi-Tenant Belt Architecture
 *
 * Each Persatuan maintains its own independent grading progression, belt ranks,
 * colors, criteria, and fees. Belt ranks are domain data, NOT hardcoded theme rules.
 * The 8-belt sequence is preserved as an optional DEFAULT TEMPLATE only.
 */

export interface BeltLevelConfig {
  id: string;
  name: string;
  order: number;
  colorHex: string;
  borderColor?: string;
  textColor?: string;
  description?: string;
  // Per-Persatuan Grading & Eligibility Criteria
  minMonthsRequired?: number;
  minSessionsRequired?: number;
  gradingFee?: number;
  syllabusCategory?: string;
  certificateTitle?: string;
  isDanRank?: boolean;
  danLevel?: number;
}

export interface PersatuanBeltSystem {
  organizationId: string;
  organizationName?: string;
  systemName: string;
  martialArtStyle: string;
  belts: BeltLevelConfig[];
  updatedAt?: string;
  version?: number;
}

/**
 * Reusable Default Initial Configuration Template (BeltFlow 8-Rank Sequence).
 * Preserved for new academies and backwards compatibility. Never forced globally.
 */
export const DEFAULT_BELT_TEMPLATE: readonly BeltLevelConfig[] = [
  {
    id: 'default_white',
    name: 'White Belt',
    order: 1,
    colorHex: '#FFFFFF',
    borderColor: '#CBD5E1',
    textColor: '#0F172A',
    description: 'Beginner foundation and fundamentals',
    minMonthsRequired: 0,
    minSessionsRequired: 0,
    gradingFee: 0,
  },
  {
    id: 'default_yellow',
    name: 'Yellow Belt',
    order: 2,
    colorHex: '#FACC15',
    borderColor: '#EAB308',
    textColor: '#0F172A',
    description: 'First milestone of basic techniques and stances',
    minMonthsRequired: 3,
    minSessionsRequired: 24,
    gradingFee: 50,
  },
  {
    id: 'default_green',
    name: 'Green Belt',
    order: 3,
    colorHex: '#22C55E',
    borderColor: '#16A34A',
    textColor: '#FFFFFF',
    description: 'Intermediate control and flow progression',
    minMonthsRequired: 6,
    minSessionsRequired: 48,
    gradingFee: 60,
  },
  {
    id: 'default_blue',
    name: 'Blue Belt',
    order: 4,
    colorHex: '#3B82F6',
    borderColor: '#2563EB',
    textColor: '#FFFFFF',
    description: 'Advanced sparring, evasion, and timing',
    minMonthsRequired: 9,
    minSessionsRequired: 72,
    gradingFee: 70,
  },
  {
    id: 'default_red',
    name: 'Red Belt',
    order: 5,
    colorHex: '#EF4444',
    borderColor: '#DC2626',
    textColor: '#FFFFFF',
    description: 'Senior practitioner with speed and precision',
    minMonthsRequired: 12,
    minSessionsRequired: 96,
    gradingFee: 80,
  },
  {
    id: 'default_brown',
    name: 'Brown Belt',
    order: 6,
    colorHex: '#92400E',
    borderColor: '#78350F',
    textColor: '#FFFFFF',
    description: 'Pre-black belt mastery and leadership',
    minMonthsRequired: 15,
    minSessionsRequired: 120,
    gradingFee: 100,
  },
  {
    id: 'default_purple',
    name: 'Purple Belt',
    order: 7,
    colorHex: '#A855F7',
    borderColor: '#9333EA',
    textColor: '#FFFFFF',
    description: 'Advanced specialty syllabus proficiency',
    minMonthsRequired: 18,
    minSessionsRequired: 144,
    gradingFee: 120,
  },
  {
    id: 'default_black',
    name: 'Black Belt',
    order: 8,
    colorHex: '#0F172A',
    borderColor: '#000000',
    textColor: '#FFFFFF',
    description: 'Dan/Asan instructor mastery and honor',
    minMonthsRequired: 24,
    minSessionsRequired: 192,
    gradingFee: 200,
    isDanRank: true,
    danLevel: 1,
  },
] as const;

/**
 * Backward compatibility alias for existing Task 1.2 tests/components.
 */
export const BELT_RANKS = DEFAULT_BELT_TEMPLATE;

/**
 * Creates an isolated initial belt configuration clone for a specific organization.
 */
export function createDefaultPersatuanBelts(
  organizationId: string,
  style: string = 'Silambam',
  systemName: string = 'Standard Academy Syllabus'
): PersatuanBeltSystem {
  return {
    organizationId,
    systemName,
    martialArtStyle: style,
    version: 1,
    belts: DEFAULT_BELT_TEMPLATE.map(b => ({
      ...b,
      id: `${organizationId}_${b.id.replace('default_', '')}`,
    })),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * WCAG accessibility check: returns true if belt background requires dark text.
 */
export function isLightBelt(colorHex: string): boolean {
  if (!colorHex) return false;
  const clean = colorHex.trim().toUpperCase();
  return (
    clean === '#FFFFFF' ||
    clean === '#FFF' ||
    clean === '#F8FAFC' ||
    clean === '#E2E8F0' ||
    clean === '#CBD5E1' ||
    clean === '#FACC15' ||
    clean === '#FDE047' ||
    clean === '#EAB308' ||
    clean === '#FEF08A'
  );
}

/**
 * Derives accessible text color for any belt hex value.
 */
export function getBeltTextColor(colorHex: string): string {
  return isLightBelt(colorHex) ? '#0F172A' : '#FFFFFF';
}

/**
 * Derives a subtle border color for light-colored belts on light surfaces.
 */
export function getBeltBorderColor(colorHex: string): string {
  return isLightBelt(colorHex) ? '#CBD5E1' : 'transparent';
}

/**
 * Resolves belt display metadata for rendering badges and cards.
 * If the belt is not found in the custom Persatuan list, it falls back
 * gracefully while preserving the student's historical belt name.
 */
export function resolveBeltDisplay(
  beltIdentifier: string,
  customBelts?: readonly BeltLevelConfig[]
): {
  name: string;
  colorHex: string;
  textColor: string;
  borderColor: string;
  order?: number;
  isDanRank?: boolean;
  danLevel?: number;
} {
  const query = (beltIdentifier || '').trim();
  const lower = query.toLowerCase();

  const searchPool = (customBelts && customBelts.length > 0)
    ? customBelts
    : DEFAULT_BELT_TEMPLATE;

  // 1. Search by exact ID or Name
  const match = searchPool.find(
    b => b.id.toLowerCase() === lower || b.name.toLowerCase() === lower
  );

  if (match) {
    const colorHex = match.colorHex;
    const textColor = match.textColor || getBeltTextColor(colorHex);
    const borderColor = match.borderColor || getBeltBorderColor(colorHex);
    return {
      name: match.name,
      colorHex,
      textColor,
      borderColor,
      order: match.order,
      isDanRank: match.isDanRank,
      danLevel: match.danLevel,
    };
  }

  // 2. Keyword-based color derivation for custom or historical titles:
  // Preserves the student's exact label (e.g. "Honorary Red Belt 2024"),
  // but intelligently infers the appropriate color and contrast.
  let derivedColor = '#64748B'; // Neutral fallback
  if (lower.includes('white')) derivedColor = '#FFFFFF';
  else if (lower.includes('yellow')) derivedColor = '#FACC15';
  else if (lower.includes('orange')) derivedColor = '#F97316';
  else if (lower.includes('green')) derivedColor = '#22C55E';
  else if (lower.includes('blue')) derivedColor = '#3B82F6';
  else if (lower.includes('red')) derivedColor = '#EF4444';
  else if (lower.includes('brown')) derivedColor = '#92400E';
  else if (lower.includes('purple')) derivedColor = '#A855F7';
  else if (lower.includes('black') || lower.includes('asan') || lower.includes('dan')) derivedColor = '#0F172A';

  return {
    name: query || 'Unassigned',
    colorHex: derivedColor,
    textColor: getBeltTextColor(derivedColor),
    borderColor: getBeltBorderColor(derivedColor),
    isDanRank: false,
  };
}

/**
 * Backward compatibility alias for legacy getBeltConfig call site.
 */
export function getBeltConfig(beltName: string): BeltLevelConfig {
  const display = resolveBeltDisplay(beltName, DEFAULT_BELT_TEMPLATE);
  return {
    id: `belt_${(display.name).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name: display.name,
    order: display.order || 1,
    colorHex: display.colorHex,
    borderColor: display.borderColor,
    textColor: display.textColor,
    isDanRank: display.isDanRank,
  };
}

/**
 * Resolves the next promotion target belt within an organization's custom progression.
 */
export function getNextBeltLevel(
  currentBeltIdOrName: string,
  belts: readonly BeltLevelConfig[]
): BeltLevelConfig | null {
  if (!belts || belts.length === 0) return null;

  const lower = (currentBeltIdOrName || '').trim().toLowerCase();
  const currentBelt = belts.find(
    b => b.id.toLowerCase() === lower || b.name.toLowerCase() === lower
  );

  if (!currentBelt) return null;

  // Find belts with higher order number
  const nextCandidates = belts
    .filter(b => b.order > currentBelt.order)
    .sort((a, b) => a.order - b.order);

  return nextCandidates[0] || null;
}

/**
 * Checks whether a student meets a specific belt's progression criteria.
 */
export function isStudentEligibleForGrading(
  targetBelt: BeltLevelConfig,
  studentStats: { monthsTrained?: number; sessionsAttended?: number }
): {
  eligible: boolean;
  missingMonths: number;
  missingSessions: number;
} {
  const requiredMonths = targetBelt.minMonthsRequired || 0;
  const requiredSessions = targetBelt.minSessionsRequired || 0;

  const actualMonths = studentStats.monthsTrained || 0;
  const actualSessions = studentStats.sessionsAttended || 0;

  const missingMonths = Math.max(0, requiredMonths - actualMonths);
  const missingSessions = Math.max(0, requiredSessions - actualSessions);

  const eligible = missingMonths === 0 && missingSessions === 0;

  return {
    eligible,
    missingMonths,
    missingSessions,
  };
}

/**
 * In-memory registry for per-Persatuan belt configurations.
 */
class PersatuanBeltRegistry {
  private systems: Map<string, PersatuanBeltSystem> = new Map();

  register(system: PersatuanBeltSystem): void {
    this.systems.set(system.organizationId, system);
  }

  get(organizationId: string): PersatuanBeltSystem {
    const existing = this.systems.get(organizationId);
    if (existing) return existing;
    // Lazy default initialization
    const initial = createDefaultPersatuanBelts(organizationId);
    this.systems.set(organizationId, initial);
    return initial;
  }

  clear(): void {
    this.systems.clear();
  }
}

export const beltSystemRegistry = new PersatuanBeltRegistry();
