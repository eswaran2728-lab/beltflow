import { apiClient } from './apiClient';

/**
 * A Master's own classes and their rosters. The server returns only the
 * classes assigned to the signed-in Master, and masks identity numbers.
 */
export interface MasterClass {
  id: string;
  name: string;
  schedule?: string | null;
  location?: string | null;
}

export interface RosterStudent {
  id: string;
  full_name: string;
  belt_rank: string;
  group_name?: string | null;
  student_status: string;
  enrollment_status: string;
}

export const masterRosterService = {
  async listMyClasses(organizationId: string): Promise<MasterClass[]> {
    const res = await apiClient.get<{ classes: MasterClass[] }>(`/api/v1/classes/organization/${encodeURIComponent(organizationId)}`);
    return (res?.classes || []).map(c => ({ id: c.id, name: c.name, schedule: c.schedule ?? null, location: c.location ?? null }));
  },

  async getRoster(classId: string, search = '', offset = 0): Promise<{ students: RosterStudent[]; total: number }> {
    const params = new URLSearchParams({ limit: '50', offset: String(offset) });
    if (search.trim()) params.set('search', search.trim());
    const res = await apiClient.get<{ students: RosterStudent[]; pagination?: { total?: number } }>(
      `/api/v1/classes/${encodeURIComponent(classId)}/students?${params.toString()}`
    );
    return { students: res?.students || [], total: Number(res?.pagination?.total ?? (res?.students || []).length) };
  },
};
