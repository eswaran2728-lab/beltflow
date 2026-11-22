import { apiClient } from './apiClient';

/**
 * Super Admin (platform operator) records: Persatuan registry, Persatuan
 * status changes, the platform audit trail and security events.
 *
 * Aggregates and platform records only. Super Admin never receives individual
 * child records, medical notes or parent conversations; the server enforces
 * this and these calls only read the fields listed below.
 *
 * Fields confirmed against the server (2026-11-22):
 *  - GET  /api/v1/organizations            -> { organizations: row[] } (organizations.routes.ts)
 *  - PUT  /api/v1/organizations/:id/status -> { organization: { id, name, state, status } }
 *  - GET  /api/v1/audit                    -> { logs: audit_logs row[] } (audit.routes.ts)
 *  - GET  /api/v1/security/events          -> { events, summary: { last24h, noisiestClients } } (security.routes.ts)
 */

export type PersatuanStatus = 'ACTIVE' | 'SUSPENDED' | string;

export interface PersatuanSummary {
  id: string;
  name: string;
  state: string;
  status: PersatuanStatus;
  classCount: number;
  activeStudentCount: number;
  masterCount: number;
}

export interface PlatformAuditEntry {
  id: string;
  action: string;
  details: string;
  userRole: string;
  userEmail: string | null;
  timestamp: string;
}

export interface SecurityEventEntry {
  id: string;
  type: string;
  severity: string;
  method: string | null;
  path: string | null;
  status: number | null;
  at: string;
}

export interface SecurityOverview {
  /** Event counts by type for the last 24 hours. */
  last24h: Record<string, number>;
  events: SecurityEventEntry[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

export const superAdminRecordsService = {
  async listPersatuans(): Promise<PersatuanSummary[]> {
    const res = await apiClient.get<{ organizations?: any[] }>('/api/v1/organizations');
    return (res?.organizations || []).map(o => ({
      id: str(o.id),
      name: str(o.name),
      state: str(o.state),
      status: str(o.status),
      classCount: num(o.classCount),
      activeStudentCount: num(o.activeStudentCount),
      masterCount: num(o.masterCount),
    }));
  },

  async setPersatuanStatus(orgId: string, status: 'ACTIVE' | 'SUSPENDED', reason: string): Promise<{ id: string; status: string }> {
    const res = await apiClient.put<{ organization?: { id: string; status: string } }>(
      `/api/v1/organizations/${encodeURIComponent(orgId)}/status`,
      { status, reason }
    );
    return { id: str(res?.organization?.id ?? orgId), status: str(res?.organization?.status ?? status) };
  },

  async listPlatformAudit(): Promise<PlatformAuditEntry[]> {
    const res = await apiClient.get<{ logs?: any[] }>('/api/v1/audit');
    return (res?.logs || []).map(l => ({
      id: str(l.id),
      action: str(l.action),
      details: str(l.details),
      userRole: str(l.user_role),
      userEmail: l.user_email ? str(l.user_email) : null,
      timestamp: str(l.timestamp),
    }));
  },

  async getSecurityOverview(limit = 50): Promise<SecurityOverview> {
    const res = await apiClient.get<{ events?: any[]; summary?: { last24h?: Record<string, unknown> } }>(
      `/api/v1/security/events?limit=${limit}`
    );
    const last24h: Record<string, number> = {};
    for (const [type, count] of Object.entries(res?.summary?.last24h || {})) last24h[type] = num(count);
    // Only the fields the screen shows: never client hashes, user ids or detail text.
    const events = (res?.events || []).map(e => ({
      id: str(e.id),
      type: str(e.type),
      severity: str(e.severity),
      method: e.method ? str(e.method) : null,
      path: e.path ? str(e.path) : null,
      status: e.status === null || e.status === undefined ? null : num(e.status),
      at: str(e.at),
    }));
    return { last24h, events };
  },
};
