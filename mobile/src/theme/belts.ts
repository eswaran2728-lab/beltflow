/**
 * BeltFlow Belt Ranking & Colors
 * Reuses the verified martial arts progression sequences and hex values from BeltFlow.
 */

export interface BeltRankConfig {
  id: string;
  name: string;
  order: number;
  colorHex: string;
  borderColor?: string;
  textColor: string;
  description?: string;
}

export const BELT_RANKS: readonly BeltRankConfig[] = [
  {
    id: 'white',
    name: 'White Belt',
    order: 1,
    colorHex: '#FFFFFF',
    borderColor: '#CBD5E1',
    textColor: '#0F172A',
    description: 'Beginner foundation and fundamentals',
  },
  {
    id: 'yellow',
    name: 'Yellow Belt',
    order: 2,
    colorHex: '#FACC15',
    borderColor: '#EAB308',
    textColor: '#0F172A',
    description: 'First milestone of basic techniques and stances',
  },
  {
    id: 'green',
    name: 'Green Belt',
    order: 3,
    colorHex: '#22C55E',
    borderColor: '#16A34A',
    textColor: '#FFFFFF',
    description: 'Intermediate control and flow progression',
  },
  {
    id: 'blue',
    name: 'Blue Belt',
    order: 4,
    colorHex: '#3B82F6',
    borderColor: '#2563EB',
    textColor: '#FFFFFF',
    description: 'Advanced sparring, evasion, and timing',
  },
  {
    id: 'red',
    name: 'Red Belt',
    order: 5,
    colorHex: '#EF4444',
    borderColor: '#DC2626',
    textColor: '#FFFFFF',
    description: 'Senior practitioner with speed and precision',
  },
  {
    id: 'brown',
    name: 'Brown Belt',
    order: 6,
    colorHex: '#92400E',
    borderColor: '#78350F',
    textColor: '#FFFFFF',
    description: 'Pre-black belt mastery and leadership',
  },
  {
    id: 'purple',
    name: 'Purple Belt',
    order: 7,
    colorHex: '#A855F7',
    borderColor: '#9333EA',
    textColor: '#FFFFFF',
    description: 'Advanced specialty syllabus proficiency',
  },
  {
    id: 'black',
    name: 'Black Belt',
    order: 8,
    colorHex: '#0F172A',
    borderColor: '#000000',
    textColor: '#FFFFFF',
    description: 'Dan/Asan instructor mastery and honor',
  },
] as const;

/**
 * Checks whether a belt background color requires dark text for WCAG accessibility.
 */
export function isLightBelt(colorHex: string): boolean {
  const clean = colorHex.trim().toUpperCase();
  return (
    clean === '#FFFFFF' ||
    clean === '#FFF' ||
    clean === '#F8FAFC' ||
    clean === '#E2E8F0' ||
    clean === '#FACC15' ||
    clean === '#FDE047' ||
    clean === '#EAB308'
  );
}

/**
 * Normalizes belt rank lookups, handling style aliases like "Black Belt (Asan)".
 */
export function getBeltConfig(beltName: string): BeltRankConfig {
  const normalized = (beltName || '').trim().toLowerCase();

  // Exact match
  const exact = BELT_RANKS.find(b => b.name.toLowerCase() === normalized);
  if (exact) return exact;

  // Keyword matching
  if (normalized.includes('white')) return BELT_RANKS[0];
  if (normalized.includes('yellow')) return BELT_RANKS[1];
  if (normalized.includes('green')) return BELT_RANKS[2];
  if (normalized.includes('blue')) return BELT_RANKS[3];
  if (normalized.includes('red')) return BELT_RANKS[4];
  if (normalized.includes('brown')) return BELT_RANKS[5];
  if (normalized.includes('purple')) return BELT_RANKS[6];
  if (normalized.includes('black') || normalized.includes('asan') || normalized.includes('dan')) {
    return BELT_RANKS[7];
  }

  // Default to White Belt for unassigned or new students
  return BELT_RANKS[0];
}
