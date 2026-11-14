import { apiClient } from './apiClient';
import { rosterRepository } from '../database/repositories/rosterRepository';
import { sessionRepository } from '../database/repositories/sessionRepository';
import { mutationQueueRepository } from '../database/repositories/mutationQueueRepository';
import { assertAuthenticated, assertClassAccess } from '../database/security/accessScope';
import { AuthUser } from '../types/auth';
import {
  CachedClass,
  CachedTrainingGroup,
  CachedStudent,
  CachedSession,
  AttendanceStatus,
  AttendanceMutation,
} from '../database/types';

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
}

export interface AttendanceContext {
  classes: CachedClass[];
  selectedClass: CachedClass | null;
  groups: CachedTrainingGroup[];
  selectedGroup: CachedTrainingGroup | null;
  sessions: CachedSession[];
  activeSession: CachedSession | null;
  students: CachedStudent[];
  attendanceMap: Record<string, AttendanceStatus | null>;
  pendingCount: number;
  isOfflineMode: boolean;
  hasCachedRoster: boolean;
  errorMessage: string | null;
}

export interface LoadAttendanceOptions {
  isOffline?: boolean;
  classId?: string;
  groupId?: string;
  sessionId?: string;
}

export const masterAttendanceService = {
  /**
   * Loads full attendance operational context for a Master instructor.
   * Seamlessly switches between online endpoint caching and offline SQLite reads.
   */
  async loadAttendanceContext(
    user: AuthUser,
    options: LoadAttendanceOptions = {}
  ): Promise<AttendanceContext> {
    assertAuthenticated(user);

    // If an explicit classId was requested, assert that the Master is authorized for it
    if (options.classId) {
      assertClassAccess(user, user.organizationId, options.classId);
    }

    const isOffline = Boolean(options.isOffline);
    let classes: CachedClass[] = [];
    let groups: CachedTrainingGroup[] = [];
    let sessions: CachedSession[] = [];
    let students: CachedStudent[] = [];
    let errorMessage: string | null = null;
    let hasCachedRoster = true;

    // ------------------------------------------------------------------------
    // 1. Online Retrieval & SQLite Local Sync
    // ------------------------------------------------------------------------
    if (!isOffline) {
      try {
        const classesRes = await apiClient.get<{ classes: any[] }>(
          `/api/v1/classes/organization/${user.organizationId}`
        );

        let serverClasses: CachedClass[] = (classesRes.classes || []).map(c => ({
          id: c.id,
          organization_id: user.organizationId,
          name: c.name,
          schedule: c.schedule || null,
          location: c.location || null,
          monthly_fee: parseFloat(c.monthly_fee) || 0,
          master_id: c.master_id || user.id,
        }));

        // Filter strictly to classes assigned to this Master
        if (user.role === 'MASTER' && user.assignedClassIds) {
          serverClasses = serverClasses.filter(c => user.assignedClassIds!.includes(c.id));
        }

        if (serverClasses.length > 0) {
          await rosterRepository.saveClasses(user, serverClasses);
          classes = serverClasses;
        } else {
          classes = await rosterRepository.getClasses(user);
        }
      } catch {
        // Fallback to local SQLite cache if network fetch failed
        classes = await rosterRepository.getClasses(user);
      }
    } else {
      // ------------------------------------------------------------------------
      // 2. Offline Mode — SQLite Local Database Only
      // ------------------------------------------------------------------------
      classes = await rosterRepository.getClasses(user);
    }

    // Determine target class
    let selectedClass: CachedClass | null = null;
    if (options.classId) {
      selectedClass = classes.find(c => c.id === options.classId) || null;
      if (!selectedClass && classes.length > 0) {
        // Class requested might exist in SQLite directly
        const localClasses = await rosterRepository.getClasses(user);
        selectedClass = localClasses.find(c => c.id === options.classId) || null;
      }
    } else if (classes.length > 0) {
      selectedClass = classes[0];
    }

    if (!selectedClass) {
      return {
        classes,
        selectedClass: null,
        groups: [],
        selectedGroup: null,
        sessions: [],
        activeSession: null,
        students: [],
        attendanceMap: {},
        pendingCount: 0,
        isOfflineMode: isOffline,
        hasCachedRoster: false,
        errorMessage: 'No classes assigned to your Master profile.',
      };
    }

    // Load Groups for selected class
    if (!isOffline) {
      try {
        const groupsRes = await apiClient.get<{ groups: any[] }>(
          `/api/v1/classes/${selectedClass.id}/groups`
        );
        const serverGroups: CachedTrainingGroup[] = (groupsRes.groups || []).map(g => ({
          id: g.id,
          organization_id: user.organizationId,
          class_id: selectedClass!.id,
          name: g.name,
          status: g.status || 'ACTIVE',
        }));
        if (serverGroups.length > 0) {
          await rosterRepository.saveTrainingGroups(user, serverGroups);
          groups = serverGroups;
        } else {
          groups = await rosterRepository.getTrainingGroups(user, selectedClass.id);
        }
      } catch {
        groups = await rosterRepository.getTrainingGroups(user, selectedClass.id);
      }
    } else {
      groups = await rosterRepository.getTrainingGroups(user, selectedClass.id);
    }

    const selectedGroup = options.groupId
      ? groups.find(g => g.id === options.groupId) || null
      : null;

    // Load Sessions for selected class
    if (!isOffline) {
      try {
        const sessionsRes = await apiClient.get<{ sessions: any[] }>(
          `/api/v1/classes/${selectedClass.id}/sessions`
        );
        const serverSessions: CachedSession[] = (sessionsRes.sessions || []).map(s => ({
          id: s.id,
          organization_id: user.organizationId,
          class_id: selectedClass!.id,
          group_id: s.group_id || null,
          schedule_id: s.schedule_id || null,
          session_date: s.session_date,
          day_of_week: s.day_of_week || null,
          start_time: s.start_time || null,
          end_time: s.end_time || null,
          location: s.location || selectedClass!.location || null,
          status: s.status || 'Scheduled',
        }));
        if (serverSessions.length > 0) {
          await sessionRepository.saveSessions(user, serverSessions);
          sessions = serverSessions;
        } else {
          sessions = await sessionRepository.getSessions(user, selectedClass.id);
        }
      } catch {
        sessions = await sessionRepository.getSessions(user, selectedClass.id);
      }
    } else {
      sessions = await sessionRepository.getSessions(user, selectedClass.id);
    }

    // Determine Active Session
    const todayStr = new Date().toISOString().slice(0, 10);
    let activeSession: CachedSession | null = null;

    if (options.sessionId) {
      activeSession = sessions.find(s => s.id === options.sessionId) || null;
    } else if (sessions.length > 0) {
      activeSession = sessions.find(s => s.session_date === todayStr) || sessions[0];
    }

    // Load Student Roster
    if (!isOffline && activeSession) {
      try {
        const rosterRes = await apiClient.get<{ roster: any[] }>(
          `/api/v1/attendance/session/${activeSession.id}/roster`
        );
        const serverStudents: CachedStudent[] = (rosterRes.roster || []).map(r => ({
          id: r.id,
          organization_id: user.organizationId,
          class_id: selectedClass!.id,
          group_id: activeSession!.group_id || null,
          full_name: r.full_name,
          belt_rank: r.belt_rank || 'White Belt',
          status: r.status || 'ACTIVE',
          photo_url: r.photo_url || null,
        }));
        if (serverStudents.length > 0) {
          await rosterRepository.saveStudentsRoster(user, serverStudents);
          students = serverStudents;
        } else {
          students = await rosterRepository.getStudentsRoster(
            user,
            selectedClass.id,
            options.groupId
          );
        }
      } catch {
        students = await rosterRepository.getStudentsRoster(
          user,
          selectedClass.id,
          options.groupId
        );
      }
    } else {
      students = await rosterRepository.getStudentsRoster(
        user,
        selectedClass.id,
        options.groupId
      );
    }

    // Check if offline and no cached roster is available
    if (isOffline && students.length === 0) {
      hasCachedRoster = false;
      errorMessage = 'Offline — No cached roster found for this class. Connect to network to download roster.';
    }

    // Load Local Pending Mutations for this actor & active session
    const sessionIdToQuery = activeSession?.id;
    const pendingMutations = await mutationQueueRepository.getPendingMutations(
      user,
      sessionIdToQuery
    );

    // Build Attendance Map overlaid with locally queued mutations
    const attendanceMap: Record<string, AttendanceStatus | null> = {};
    for (const stu of students) {
      const pending = pendingMutations.find(m => m.student_id === stu.id);
      if (pending) {
        attendanceMap[stu.id] = pending.status;
      } else {
        attendanceMap[stu.id] = null;
      }
    }

    return {
      classes,
      selectedClass,
      groups,
      selectedGroup,
      sessions,
      activeSession,
      students,
      attendanceMap,
      pendingCount: pendingMutations.length,
      isOfflineMode: isOffline,
      hasCachedRoster,
      errorMessage,
    };
  },

  /**
   * Filters student roster by case-insensitive name matching
   */
  filterStudents(students: CachedStudent[], query: string): CachedStudent[] {
    const trimmed = (query || '').trim().toLowerCase();
    if (!trimmed) return students;
    return students.filter(s => s.full_name.toLowerCase().includes(trimmed));
  },

  /**
   * Calculates real-time roll-call stats summary
   */
  calculateSummary(
    students: CachedStudent[],
    attendanceMap: Record<string, AttendanceStatus | null>
  ): AttendanceSummary {
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    let unmarked = 0;

    for (const student of students) {
      const status = attendanceMap[student.id];
      if (status === 'Present') present++;
      else if (status === 'Late') late++;
      else if (status === 'Absent') absent++;
      else if (status === 'Excused') excused++;
      else unmarked++;
    }

    return {
      total: students.length,
      present,
      late,
      absent,
      excused,
      unmarked,
    };
  },

  /**
   * Saves an attendance check-in locally in SQLite mutation queue
   */
  async recordAttendanceMark(
    user: AuthUser,
    params: {
      sessionId: string;
      studentId: string;
      status: AttendanceStatus;
    }
  ): Promise<AttendanceMutation> {
    return await mutationQueueRepository.enqueueAttendance(user, {
      sessionId: params.sessionId,
      studentId: params.studentId,
      status: params.status,
    });
  },

  /**
   * Quarantines mutations for a class whose authorization has been revoked
   */
  async handleRevokedClass(user: AuthUser, classId: string): Promise<number> {
    return await mutationQueueRepository.quarantineMutationsForRevokedClass(user, classId);
  },
};
