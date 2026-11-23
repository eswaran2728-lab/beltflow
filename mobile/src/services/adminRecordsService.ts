/**
 * Persatuan admin records: training venues (from the academy's classes) and
 * the academy's aggregate figures (analytics metrics).
 *
 * Endpoints (server/src/routes):
 *  - GET /api/v1/classes/organization/:orgId  -> { classes: [...] }
 *      classes.routes.ts: SELECT c.*, u.full_name AS master_name, needs CLASS_VIEW.
 *      There is no locations table: a venue is the class's `location` column.
 *  - GET /api/v1/analytics/metrics?period=... -> AcademyMetricsResult
 *      analytics.routes.ts: ADMIN_PERSATUAN is scoped to their own organization
 *      on the server. Mounted behind moduleGate('analytics') in app.ts, which
 *      answers 404 { code: 'MODULE_DISABLED' } when the module is switched off.
 *
 * Aggregates and class configuration only: no student or child records.
 */
import { apiClient } from './apiClient';
import type { AcademyMetricsData } from './analyticsService';

export type { AcademyMetricsData };

export type ClassOperationalStatus = 'NOT_STARTED' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | string;

export interface AdminClassRecord {
  id: string;
  name: string;
  /** `classes.location`; null when empty. */
  location: string | null;
  /** `classes.venue_details` (room, floor, directions). */
  venueDetails: string | null;
  schedule: string | null;
  /** `master_name` (the class's main Master), null when none is assigned. */
  masterName: string | null;
  /** `classes.operational_status`, falling back to `classes.status`. */
  status: ClassOperationalStatus;
  /** `classes.capacity` (places), null when the server does not send it. */
  capacity: number | null;
  /** Active students in the class (`active_student_count`), null on older servers. */
  activeStudents: number | null;
}

export interface VenueGroup {
  /** The class `location`; null for the "Location not set" group. */
  location: string | null;
  classes: AdminClassRecord[];
}

/** Values the mobile analytics client already uses (analyticsService.MetricsQueryParams). */
export const REPORT_PERIODS = ['current_month', 'last_30_days', 'last_90_days', 'year_to_date', 'all_time'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
};

function toClassRecord(row: any): AdminClassRecord {
  const capacity = Number(row?.capacity);
  const active = row?.active_student_count;
  return {
    id: String(row?.id ?? ''),
    name: text(row?.name) ?? String(row?.id ?? ''),
    location: text(row?.location),
    venueDetails: text(row?.venue_details),
    schedule: text(row?.schedule),
    masterName: text(row?.master_name),
    status: text(row?.operational_status) ?? text(row?.status) ?? 'ACTIVE',
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    activeStudents: active === undefined || active === null || !Number.isFinite(Number(active)) ? null : Number(active),
  };
}

/** Groups classes by venue (case-insensitive), venues A to Z, unset location last. */
export function groupClassesByLocation(classes: AdminClassRecord[]): VenueGroup[] {
  const byKey = new Map<string, VenueGroup>();
  let unset: VenueGroup | null = null;
  for (const c of classes) {
    if (!c.location) {
      unset = unset ?? { location: null, classes: [] };
      unset.classes.push(c);
      continue;
    }
    const key = c.location.toLowerCase();
    const group = byKey.get(key) ?? { location: c.location, classes: [] };
    group.classes.push(c);
    byKey.set(key, group);
  }
  const byName = (a: AdminClassRecord, b: AdminClassRecord) => a.name.localeCompare(b.name);
  const groups = Array.from(byKey.values()).sort((a, b) => (a.location ?? '').localeCompare(b.location ?? ''));
  if (unset) groups.push(unset);
  groups.forEach(g => g.classes.sort(byName));
  return groups;
}

/** True when the server refused because the module is switched off for this Persatuan. */
export function isModuleDisabledError(err: unknown): boolean {
  const e = err as { status?: number; details?: { code?: string } } | null;
  return Boolean(e && e.status === 404 && e.details && e.details.code === 'MODULE_DISABLED');
}

export const adminRecordsService = {
  async listAcademyClasses(organizationId: string): Promise<AdminClassRecord[]> {
    const res = await apiClient.get<{ classes?: any[] }>(
      `/api/v1/classes/organization/${encodeURIComponent(organizationId)}`
    );
    const rows = Array.isArray(res?.classes) ? res.classes : [];
    return rows.map(toClassRecord);
  },

  async getAcademyMetrics(period: ReportPeriod): Promise<AcademyMetricsData> {
    return apiClient.get<AcademyMetricsData>(`/api/v1/analytics/metrics?period=${encodeURIComponent(period)}`);
  },
};

/** True when the academy has nothing to report yet (all headline numbers are zero). */
export function metricsAreEmpty(m: AcademyMetricsData): boolean {
  return (
    m.enrollment.activeEnrolledStudents === 0 &&
    m.enrollment.pendingApplicants === 0 &&
    m.enrollment.activeClassesCount === 0 &&
    m.trialConversion.totalTrialsBooked === 0 &&
    m.retention.pausedMemberships === 0 &&
    m.retention.transfersCount === 0 &&
    m.ledgerTotals.totalCollected === 0 &&
    m.ledgerTotals.totalOutstanding === 0 &&
    m.ledgerTotals.siblingDiscountSavings === 0
  );
}

/** "RM 5,040.50" for MYR; other currencies keep their ISO code. */
export function formatMoney(amount: number, currency: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const [whole, cents] = (Math.round(value * 100) / 100).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency === 'MYR' ? 'RM' : currency} ${grouped}.${cents}`;
}

/** "46.67%" (at most two decimals, as the server rounds them). */
export function formatPercent(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  return `${n}%`;
}
