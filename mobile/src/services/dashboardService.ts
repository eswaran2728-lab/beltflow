import { apiClient } from './apiClient';
import { AuthUser } from '../types/auth';
import { authService } from './authService';

// ----------------------------------------------------------------------------
// Type Definitions for Dashboard Models
// ----------------------------------------------------------------------------

export interface SuperAdminDashboardData {
  totalPersatuans: number;
  activePersatuans: number;
  pendingPersatuans: number;
  recentOrganizations: {
    id: string;
    name: string;
    state: string;
    martialArtStyle: string;
    masterName: string;
    status: string;
    createdAt?: string;
  }[];
  recentAuditLogs: {
    id: string;
    action: string;
    details: string;
    userRole: string;
    userEmail: string;
    timestamp: string;
  }[];
}

export interface AdminPersatuanDashboardData {
  organization: {
    id: string;
    name: string;
    state: string;
    martialArtStyle: string;
    masterName?: string;
    phone?: string;
    email?: string;
    status: string;
  };
  locationsCount: number;
  classesCount: number;
  mastersCount: number;
  studentsCount: number;
  totalRevenue: number;
  paymentsCount: number;
  classes: {
    id: string;
    name: string;
    location: string;
    monthlyFee: number;
    masterName?: string;
  }[];
  masters: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    credentialLevel?: string;
  }[];
}

export interface MasterDashboardData {
  assignedClassesCount: number;
  assignedStudentsCount: number;
  todaySessionsCount: number;
  pendingGradingCount: number;
  classes: {
    id: string;
    name: string;
    location: string;
    monthlyFee: number;
  }[];
  todaySessions: {
    id: string;
    classId: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    location: string;
    status: string;
  }[];
  recentGradingEvents: {
    id: string;
    title: string;
    gradingDate: string;
    location: string;
    status: string;
    candidateCount?: number;
  }[];
}

export interface ParentChildSummary {
  id: string;
  fullName: string;
  beltRank: string;
  classId?: string;
  className?: string;
  monthlyFee: number;
  attendanceTotal: number;
  attendancePresent: number;
  monthsPendingCount: number;
  totalPending: number;
  upcomingSessions: {
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    location: string;
  }[];
  certificates: {
    id: string;
    beltRank: string;
    issuedDate: string;
    certificateNumber: string;
  }[];
}

export interface ParentDashboardData {
  children: ParentChildSummary[];
  notices: {
    id: string;
    title: string;
    content: string;
    priority?: string;
    createdAt: string;
  }[];
}

export interface StudentDashboardData {
  student: {
    id: string;
    fullName: string;
    beltRank: string;
    organizationId: string;
    classId?: string;
    monthlyFee: number;
    status: string;
  };
  persatuanName: string;
  attendanceTotal: number;
  attendancePresent: number;
  upcomingSessions: {
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    location: string;
    groupName?: string;
  }[];
  skillsTotal: number;
  skillsCompleted: number;
  certificates: {
    id: string;
    beltRank: string;
    issuedDate: string;
    certificateNumber: string;
  }[];
  notices: {
    id: string;
    title: string;
    content: string;
    priority?: string;
    createdAt: string;
  }[];
}

// ----------------------------------------------------------------------------
// Partitioned In-Memory Cache
// ----------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute
const dashboardCache = new Map<string, CacheEntry<unknown>>();

export function buildDashboardCacheKey(user: AuthUser): string {
  return [user.id, user.role, user.organizationId || 'none'].join('::');
}

export function clearDashboardCache(): void {
  dashboardCache.clear();
}

// Automatically clear dashboard caches on session termination
authService.onSessionEnded(() => {
  clearDashboardCache();
});

// ----------------------------------------------------------------------------
// Dashboard Fetchers
// ----------------------------------------------------------------------------

export const dashboardService = {
  /**
   * Super Admin Dashboard: Global platform metrics only.
   * Access to individual academy operational records is strictly excluded.
   */
  async getSuperAdminDashboard(options?: { forceRefresh?: boolean }): Promise<SuperAdminDashboardData> {
    const cacheKey = 'SUPER_ADMIN::global';
    if (!options?.forceRefresh) {
      const cached = dashboardCache.get(cacheKey) as CacheEntry<SuperAdminDashboardData> | undefined;
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const [orgsRes, auditRes] = await Promise.all([
      apiClient.get<{ organizations: any[] }>('/api/v1/organizations'),
      apiClient.get<{ logs: any[] }>('/api/v1/audit').catch(() => ({ logs: [] })),
    ]);

    const orgs = orgsRes?.organizations || [];
    const logs = auditRes?.logs || [];

    const data: SuperAdminDashboardData = {
      totalPersatuans: orgs.length,
      activePersatuans: orgs.filter(o => o.status === 'ACTIVE').length,
      pendingPersatuans: orgs.filter(o => o.status === 'PENDING').length,
      recentOrganizations: orgs.slice(0, 5).map(o => ({
        id: o.id,
        name: o.name,
        state: o.state,
        martialArtStyle: o.martial_art_style,
        masterName: o.master_name,
        status: o.status,
        createdAt: o.created_at,
      })),
      recentAuditLogs: logs.slice(0, 5).map(l => ({
        id: l.id,
        action: l.action,
        details: l.details,
        userRole: l.user_role,
        userEmail: l.user_email,
        timestamp: l.timestamp,
      })),
    };

    dashboardCache.set(cacheKey, { data, cachedAt: Date.now() });
    return data;
  },

  /**
   * Persatuan Admin Dashboard: Organization overview, locations, masters, students, financial summary.
   */
  async getAdminPersatuanDashboard(user: AuthUser, options?: { forceRefresh?: boolean }): Promise<AdminPersatuanDashboardData> {
    const orgId = user.organizationId;
    if (!orgId) {
      throw new Error('User has no organization assignment.');
    }

    const cacheKey = buildDashboardCacheKey(user);
    if (!options?.forceRefresh) {
      const cached = dashboardCache.get(cacheKey) as CacheEntry<AdminPersatuanDashboardData> | undefined;
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const [orgRes, classesRes, coachesRes, studentsRes, billingRes] = await Promise.all([
      apiClient.get<{ organization: any }>(`/api/v1/organizations/${orgId}`),
      apiClient.get<{ classes: any[] }>(`/api/v1/classes/organization/${orgId}`).catch(() => ({ classes: [] })),
      apiClient.get<{ coaches: any[] }>(`/api/v1/coaches/organization/${orgId}`).catch(() => ({ coaches: [] })),
      apiClient.get<{ students: any[] }>(`/api/v1/students/organization/${orgId}`).catch(() => ({ students: [] })),
      apiClient.get<{ payments: any[] }>(`/api/v1/billing/organization/${orgId}`).catch(() => ({ payments: [] })),
    ]);

    const org = orgRes.organization;
    const classes = classesRes.classes || [];
    const coaches = coachesRes.coaches || [];
    const students = studentsRes.students || [];
    const payments = billingRes.payments || [];

    const locations = new Set(classes.map(c => c.location).filter(Boolean));
    const totalRevenue = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const data: AdminPersatuanDashboardData = {
      organization: {
        id: org.id,
        name: org.name,
        state: org.state,
        martialArtStyle: org.martial_art_style,
        masterName: org.master_name,
        phone: org.phone,
        email: org.email,
        status: org.status,
      },
      locationsCount: locations.size,
      classesCount: classes.length,
      mastersCount: coaches.length,
      studentsCount: students.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paymentsCount: payments.length,
      classes: classes.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        monthlyFee: parseFloat(c.monthly_fee) || 0,
        masterName: c.master_name,
      })),
      masters: coaches.slice(0, 5).map(c => ({
        id: c.id,
        fullName: c.fullName || c.full_name,
        email: c.email,
        role: c.role,
        credentialLevel: c.credential_level,
      })),
    };

    dashboardCache.set(cacheKey, { data, cachedAt: Date.now() });
    return data;
  },

  /**
   * Master Dashboard: Scoped strictly to the Master's assigned classes and students.
   */
  async getMasterDashboard(user: AuthUser, options?: { forceRefresh?: boolean }): Promise<MasterDashboardData> {
    const orgId = user.organizationId;
    if (!orgId) {
      throw new Error('Master user has no organization assignment.');
    }

    const cacheKey = buildDashboardCacheKey(user);
    if (!options?.forceRefresh) {
      const cached = dashboardCache.get(cacheKey) as CacheEntry<MasterDashboardData> | undefined;
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const [classesRes, studentsRes, gradingRes] = await Promise.all([
      apiClient.get<{ classes: any[] }>(`/api/v1/classes/organization/${orgId}`).catch(() => ({ classes: [] })),
      apiClient.get<{ students: any[] }>(`/api/v1/students/organization/${orgId}`).catch(() => ({ students: [] })),
      apiClient.get<{ gradingEvents: any[] }>(`/api/v1/grading/organization/${orgId}`).catch(() => ({ gradingEvents: [] })),
    ]);

    let classes = classesRes.classes || [];
    let students = studentsRes.students || [];
    const gradingEvents = gradingRes.gradingEvents || [];

    // Filter to Master's assigned classes if specified
    if (user.assignedClassIds && user.assignedClassIds.length > 0) {
      classes = classes.filter(c => user.assignedClassIds!.includes(c.id));
      students = students.filter(s => s.class_id && user.assignedClassIds!.includes(s.class_id));
    }

    // Fetch sessions for first assigned class if available
    let todaySessions: any[] = [];
    if (classes.length > 0) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const sessionsRes = await apiClient.get<{ sessions: any[] }>(`/api/v1/classes/${classes[0].id}/sessions`);
        todaySessions = (sessionsRes.sessions || []).filter(s => s.session_date === todayStr);
      } catch {
        todaySessions = [];
      }
    }

    const pendingGrading = gradingEvents.filter(e => e.status !== 'COMPLETED');

    const data: MasterDashboardData = {
      assignedClassesCount: classes.length,
      assignedStudentsCount: students.length,
      todaySessionsCount: todaySessions.length,
      pendingGradingCount: pendingGrading.length,
      classes: classes.map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        monthlyFee: parseFloat(c.monthly_fee) || 0,
      })),
      todaySessions: todaySessions.map(s => ({
        id: s.id,
        classId: s.class_id,
        sessionDate: s.session_date,
        startTime: s.start_time,
        endTime: s.end_time,
        location: s.location,
        status: s.status,
      })),
      recentGradingEvents: gradingEvents.slice(0, 5).map(e => ({
        id: e.id,
        title: e.title,
        gradingDate: e.grading_date,
        location: e.location,
        status: e.status,
        candidateCount: e.candidate_count ? Number(e.candidate_count) : 0,
      })),
    };

    dashboardCache.set(cacheKey, { data, cachedAt: Date.now() });
    return data;
  },

  /**
   * Parent Dashboard: Scoped strictly to the approved linked children.
   */
  async getParentDashboard(user: AuthUser, options?: { forceRefresh?: boolean }): Promise<ParentDashboardData> {
    const linkedIds = user.linkedStudentIds || [];

    const cacheKey = buildDashboardCacheKey(user);
    if (!options?.forceRefresh) {
      const cached = dashboardCache.get(cacheKey) as CacheEntry<ParentDashboardData> | undefined;
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const noticesRes = await apiClient.get<{ notices: any[] }>('/api/v1/notices/mine').catch(() => ({ notices: [] }));
    const notices = noticesRes.notices || [];

    const children: ParentChildSummary[] = [];

    for (const studentId of linkedIds) {
      try {
        const [studentRes, duesRes, attRes, sessRes, certsRes] = await Promise.all([
          apiClient.get<{ student: any }>(`/api/v1/students/${studentId}`).catch(() => null),
          apiClient.get<{ currentFee: number; monthsPendingCount: number; totalPending: number }>(`/api/v1/billing/monthly-dues/student/${studentId}`).catch(() => null),
          apiClient.get<{ attendance: any[] }>(`/api/v1/attendance/student/${studentId}/history`).catch(() => ({ attendance: [] })),
          apiClient.get<{ sessions: any[] }>(`/api/v1/students/${studentId}/sessions`).catch(() => ({ sessions: [] })),
          apiClient.get<{ certificates: any[] }>(`/api/v1/certificates/student/${studentId}`).catch(() => ({ certificates: [] })),
        ]);

        if (studentRes?.student) {
          const s = studentRes.student;
          const att = attRes?.attendance || [];
          const sess = sessRes?.sessions || [];
          const certs = certsRes?.certificates || [];

          children.push({
            id: s.id,
            fullName: s.full_name,
            beltRank: s.belt_rank,
            classId: s.class_id,
            className: s.class_id ? `Class ${s.class_id}` : undefined,
            monthlyFee: parseFloat(s.monthly_fee) || 0,
            attendanceTotal: att.length,
            attendancePresent: att.filter((a: any) => a.status === 'Present').length,
            monthsPendingCount: duesRes?.monthsPendingCount ?? 0,
            totalPending: duesRes?.totalPending ?? 0,
            upcomingSessions: sess.slice(0, 3).map((sn: any) => ({
              id: sn.id,
              sessionDate: sn.session_date,
              startTime: sn.start_time,
              endTime: sn.end_time,
              location: sn.location,
            })),
            certificates: certs.slice(0, 3).map((c: any) => ({
              id: c.id,
              beltRank: c.belt_rank,
              issuedDate: c.issued_date,
              certificateNumber: c.certificate_number,
            })),
          });
        }
      } catch {
        // Continue to other children if one fails
      }
    }

    const data: ParentDashboardData = {
      children,
      notices: notices.slice(0, 5).map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        priority: n.priority,
        createdAt: n.created_at,
      })),
    };

    dashboardCache.set(cacheKey, { data, cachedAt: Date.now() });
    return data;
  },

  /**
   * Student Dashboard: Scoped strictly to the student's personal record.
   */
  async getStudentDashboard(options?: { forceRefresh?: boolean }): Promise<StudentDashboardData> {
    const studentRes = await apiClient.get<{ student: any }>('/api/v1/students/me');
    const s = studentRes.student;
    if (!s) {
      throw new Error('Student profile not found.');
    }

    const cacheKey = `STUDENT::${s.id}`;
    if (!options?.forceRefresh) {
      const cached = dashboardCache.get(cacheKey) as CacheEntry<StudentDashboardData> | undefined;
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const [sessionsRes, attRes, skillsRes, certsRes, noticesRes, orgRes] = await Promise.all([
      apiClient.get<{ sessions: any[] }>(`/api/v1/students/${s.id}/sessions`).catch(() => ({ sessions: [] })),
      apiClient.get<{ attendance: any[] }>(`/api/v1/attendance/student/${s.id}/history`).catch(() => ({ attendance: [] })),
      apiClient.get<{ skills: any[] }>(`/api/v1/skills/student/${s.id}`).catch(() => ({ skills: [] })),
      apiClient.get<{ certificates: any[] }>(`/api/v1/certificates/student/${s.id}`).catch(() => ({ certificates: [] })),
      apiClient.get<{ notices: any[] }>('/api/v1/notices/mine').catch(() => ({ notices: [] })),
      s.organization_id ? apiClient.get<{ organization: any }>(`/api/v1/organizations/${s.organization_id}`).catch(() => null) : Promise.resolve(null),
    ]);

    const sessions = sessionsRes.sessions || [];
    const att = attRes.attendance || [];
    const skills = skillsRes.skills || [];
    const certs = certsRes.certificates || [];
    const notices = noticesRes.notices || [];

    const data: StudentDashboardData = {
      student: {
        id: s.id,
        fullName: s.full_name,
        beltRank: s.belt_rank,
        organizationId: s.organization_id,
        classId: s.class_id,
        monthlyFee: parseFloat(s.monthly_fee) || 0,
        status: s.status,
      },
      persatuanName: orgRes?.organization?.name || s.organization_id,
      attendanceTotal: att.length,
      attendancePresent: att.filter((a: any) => a.status === 'Present').length,
      upcomingSessions: sessions.slice(0, 5).map(sn => ({
        id: sn.id,
        sessionDate: sn.session_date,
        startTime: sn.start_time,
        endTime: sn.end_time,
        location: sn.location,
        groupName: sn.group_name,
      })),
      skillsTotal: skills.length,
      skillsCompleted: skills.filter(sk => sk.status === 'COMPLETED' || sk.level === 'PASSED').length,
      certificates: certs.slice(0, 5).map(c => ({
        id: c.id,
        beltRank: c.belt_rank,
        issuedDate: c.issued_date,
        certificateNumber: c.certificate_number,
      })),
      notices: notices.slice(0, 5).map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        priority: n.priority,
        createdAt: n.created_at,
      })),
    };

    dashboardCache.set(cacheKey, { data, cachedAt: Date.now() });
    return data;
  },
};
