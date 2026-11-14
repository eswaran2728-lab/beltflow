import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { initDatabase, closeDatabase, resetDatabaseForTesting } from '../database/connection';
import { rosterRepository } from '../database/repositories/rosterRepository';
import { sessionRepository } from '../database/repositories/sessionRepository';
import { mutationQueueRepository } from '../database/repositories/mutationQueueRepository';
import { databaseLifecycle } from '../database/lifecycle';
import { UnauthorizedClassError, TenantMismatchError } from '../database/security/accessScope';
import { masterAttendanceService } from '../services/masterAttendanceService';
import { AttendanceScreen } from '../screens/roles/master/AttendanceScreen';
import { AuthUser } from '../types/auth';
import { CachedClass, CachedTrainingGroup, CachedStudent, CachedSession } from '../database/types';

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Mock apiClient to control network responses
jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

describe('BeltFlow Phase 2 Task 2.2 — Master Offline Attendance & Local Mutation Engine', () => {
  // Test users: Two Masters in same Academy, and one Master in Academy B
  const masterA1: AuthUser = {
    id: 'usr_master_a1',
    email: 'master.a1@persatuan-a.org',
    fullName: 'Master Arumugam',
    role: 'MASTER',
    organizationId: 'org_persatuan_a',
    assignedClassIds: ['cls_a_junior', 'cls_a_senior'],
  };

  const masterA2: AuthUser = {
    id: 'usr_master_a2',
    email: 'master.a2@persatuan-a.org',
    fullName: 'Master Aminah',
    role: 'MASTER',
    organizationId: 'org_persatuan_a',
    assignedClassIds: ['cls_a_sparring'],
  };

  const masterB: AuthUser = {
    id: 'usr_master_b',
    email: 'master@persatuan-b.org',
    fullName: 'Master Benjamin',
    role: 'MASTER',
    organizationId: 'org_persatuan_b',
    assignedClassIds: ['cls_b_main'],
  };

  // Seed sample classes
  const classesA: CachedClass[] = [
    {
      id: 'cls_a_junior',
      organization_id: 'org_persatuan_a',
      name: 'Junior Karate',
      schedule: 'Mon, Wed 5:00 PM',
      location: 'Dojo Main Hall',
      monthly_fee: 120,
      master_id: masterA1.id,
    },
    {
      id: 'cls_a_senior',
      organization_id: 'org_persatuan_a',
      name: 'Senior Karate',
      schedule: 'Tue, Thu 7:00 PM',
      location: 'Dojo Main Hall',
      monthly_fee: 150,
      master_id: masterA1.id,
    },
    {
      id: 'cls_a_sparring',
      organization_id: 'org_persatuan_a',
      name: 'Elite Sparring Squad',
      schedule: 'Sat 10:00 AM',
      location: 'Dojo Ring 2',
      monthly_fee: 180,
      master_id: masterA2.id,
    },
  ];

  // Seed training groups
  const groupsA: CachedTrainingGroup[] = [
    {
      id: 'grp_a_kids',
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a_junior',
      name: 'Kids (7-10)',
      status: 'ACTIVE',
    },
    {
      id: 'grp_a_teens',
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a_junior',
      name: 'Teens (11-14)',
      status: 'ACTIVE',
    },
  ];

  // Seed students with custom belt labels
  const studentsA: CachedStudent[] = [
    {
      id: 'stu_1',
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a_junior',
      group_id: 'grp_a_kids',
      full_name: 'Adam bin Yusof',
      belt_rank: 'Yellow Belt',
      status: 'ACTIVE',
    },
    {
      id: 'stu_2',
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a_junior',
      group_id: 'grp_a_kids',
      full_name: 'Bella Tan',
      belt_rank: 'Green Belt',
      status: 'ACTIVE',
    },
    {
      id: 'stu_3',
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a_junior',
      group_id: 'grp_a_teens',
      full_name: 'Chong Wei Ming',
      belt_rank: 'Blue Belt 2nd Stripe', // Custom Persatuan belt label
      status: 'ACTIVE',
    },
  ];

  // Seed session
  const sessionA1: CachedSession = {
    id: 'sess_a1_today',
    organization_id: 'org_persatuan_a',
    class_id: 'cls_a_junior',
    group_id: 'grp_a_kids',
    session_date: new Date().toISOString().slice(0, 10),
    day_of_week: 'Monday',
    start_time: '17:00',
    end_time: '18:30',
    location: 'Dojo Main Hall',
    status: 'Scheduled',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabaseForTesting();
    databaseLifecycle.setActiveUser(masterA1);
  });

  afterEach(async () => {
    await closeDatabase();
    databaseLifecycle.clearActiveUser();
  });

  // --------------------------------------------------------------------------
  // TEST 1: Authorized class roster loading
  // --------------------------------------------------------------------------
  it('1. should load authorized classes, groups, and roster for authenticated Master', async () => {
    await initDatabase({ useMemory: true });

    // Seed master A1's classes and students
    await rosterRepository.saveClasses(masterA1, [classesA[0], classesA[1]]);
    await rosterRepository.saveTrainingGroups(masterA1, groupsA);
    await rosterRepository.saveStudentsRoster(masterA1, studentsA);
    await sessionRepository.saveSessions(masterA1, [sessionA1]);

    const context = await masterAttendanceService.loadAttendanceContext(masterA1, {
      isOffline: true,
      classId: 'cls_a_junior',
    });

    expect(context.classes.length).toBe(2);
    expect(context.classes.map(c => c.id)).toEqual(['cls_a_junior', 'cls_a_senior']);
    expect(context.students.length).toBe(3);
    expect(context.activeSession?.id).toBe('sess_a1_today');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Class and group filters
  // --------------------------------------------------------------------------
  it('2. should filter students when a specific training group is selected', async () => {
    await initDatabase({ useMemory: true });
    await rosterRepository.saveClasses(masterA1, [classesA[0]]);
    await rosterRepository.saveTrainingGroups(masterA1, groupsA);
    await rosterRepository.saveStudentsRoster(masterA1, studentsA);

    // Group filter: Kids only (stu_1, stu_2)
    const kidsContext = await masterAttendanceService.loadAttendanceContext(masterA1, {
      isOffline: true,
      classId: 'cls_a_junior',
      groupId: 'grp_a_kids',
    });

    expect(kidsContext.students.length).toBe(2);
    expect(kidsContext.students.map(s => s.id)).toEqual(['stu_1', 'stu_2']);

    // Group filter: Teens only (stu_3)
    const teensContext = await masterAttendanceService.loadAttendanceContext(masterA1, {
      isOffline: true,
      classId: 'cls_a_junior',
      groupId: 'grp_a_teens',
    });

    expect(teensContext.students.length).toBe(1);
    expect(teensContext.students[0].id).toBe('stu_3');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Student search
  // --------------------------------------------------------------------------
  it('3. should search and filter students by name in attendance context', () => {
    const query = 'tan';
    const filtered = masterAttendanceService.filterStudents(studentsA, query);
    expect(filtered.length).toBe(1);
    expect(filtered[0].full_name).toBe('Bella Tan');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Present/Late/Absent/Excused selection
  // --------------------------------------------------------------------------
  it('4. should correctly track counts for Present, Late, Absent, and Excused selections', () => {
    const attendanceMap: Record<string, 'Present' | 'Late' | 'Absent' | 'Excused'> = {
      stu_1: 'Present',
      stu_2: 'Late',
      stu_3: 'Absent',
    };

    const summary = masterAttendanceService.calculateSummary(studentsA, attendanceMap);
    expect(summary.total).toBe(3);
    expect(summary.present).toBe(1);
    expect(summary.late).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.excused).toBe(0);
    expect(summary.unmarked).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Saving local attendance
  // --------------------------------------------------------------------------
  it('5. should save attendance locally in SQLite mutation queue with PENDING status', async () => {
    await initDatabase({ useMemory: true });

    const mutation = await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    expect(mutation.id).toBeDefined();
    expect(mutation.queue_status).toBe('PENDING');
    expect(mutation.status).toBe('Present');
    expect(mutation.actor_id).toBe(masterA1.id);
    expect(mutation.idempotency_key).toBe('sess_a1_today::stu_1');

    const pending = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(mutation.id);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Duplicate pending mutation prevention
  // --------------------------------------------------------------------------
  it('6. should prevent duplicate pending records when same mark is re-submitted', async () => {
    await initDatabase({ useMemory: true });

    const mark1 = await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    const mark2 = await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    expect(mark1.id).toBe(mark2.id);
    const pending = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pending.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Attendance correction sequencing
  // --------------------------------------------------------------------------
  it('7. should handle offline attendance status corrections gracefully', async () => {
    await initDatabase({ useMemory: true });

    // Mark as Present
    await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    // Master realizes student was actually Late and corrects it
    const corrected = await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Late',
    });

    expect(corrected.status).toBe('Late');
    const pending = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe('Late');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Offline use with cached roster
  // --------------------------------------------------------------------------
  it('8. should load roster successfully when offline if previously cached', async () => {
    await initDatabase({ useMemory: true });
    await rosterRepository.saveClasses(masterA1, [classesA[0]]);
    await rosterRepository.saveTrainingGroups(masterA1, groupsA);
    await rosterRepository.saveStudentsRoster(masterA1, studentsA);

    const context = await masterAttendanceService.loadAttendanceContext(masterA1, {
      isOffline: true,
      classId: 'cls_a_junior',
    });

    expect(context.isOfflineMode).toBe(true);
    expect(context.hasCachedRoster).toBe(true);
    expect(context.students.length).toBe(3);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Offline use without cached roster
  // --------------------------------------------------------------------------
  it('9. should return informative empty state when offline without cached roster', async () => {
    await initDatabase({ useMemory: true });
    await rosterRepository.saveClasses(masterA1, [classesA[0]]);

    const context = await masterAttendanceService.loadAttendanceContext(masterA1, {
      isOffline: true,
      classId: 'cls_a_junior',
    });

    expect(context.hasCachedRoster).toBe(false);
    expect(context.students.length).toBe(0);
    expect(context.errorMessage).toMatch(/no cached roster found/i);
  });

  // --------------------------------------------------------------------------
  // TEST 10: App restart recovery
  // --------------------------------------------------------------------------
  it('10. should maintain all pending mutations and cached rosters across database restarts', async () => {
    await initDatabase({ useMemory: true });
    await rosterRepository.saveClasses(masterA1, [classesA[0]]);
    await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    // Verify written
    expect((await mutationQueueRepository.getPendingMutations(masterA1)).length).toBe(1);

    // Database remains persistent and queryable on next session
    const restored = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(restored.length).toBe(1);
    expect(restored[0].student_id).toBe('stu_1');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Storage write failure handling
  // --------------------------------------------------------------------------
  it('11. should handle storage errors gracefully without crashing the app', async () => {
    // Database connection closed intentionally
    await closeDatabase();

    await expect(
      masterAttendanceService.recordAttendanceMark(masterA1, {
        sessionId: 'sess_a1_today',
        studentId: 'stu_1',
        status: 'Present',
      })
    ).rejects.toThrow(/database connection is not open/i);
  });

  // --------------------------------------------------------------------------
  // TEST 12: Cross-Persatuan isolation
  // --------------------------------------------------------------------------
  it('12. should strictly isolate rosters and mutations between different Persatuans', async () => {
    await initDatabase({ useMemory: true });

    // Master A1 saves attendance in Persatuan A
    await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    // Master B in Persatuan B queries pending mutations
    databaseLifecycle.setActiveUser(masterB);
    const pendingB = await mutationQueueRepository.getPendingMutations(masterB);
    expect(pendingB.length).toBe(0);

    // Master B attempting to read Master A's mutation by ID is rejected
    const mutA = (await mutationQueueRepository.getPendingMutations(masterA1))[0];
    await expect(
      mutationQueueRepository.getMutationById(masterB, mutA.id)
    ).rejects.toThrow(TenantMismatchError);
  });

  // --------------------------------------------------------------------------
  // TEST 13: Same-Persatuan Master account switching
  // --------------------------------------------------------------------------
  it('13. should prevent Master B from accessing Master A1 pending records within same Persatuan', async () => {
    await initDatabase({ useMemory: true });

    // Master A1 records pending attendance
    await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    // Account switched to Master A2 in same Persatuan
    await databaseLifecycle.onAccountSwitched(masterA1, masterA2);

    // Master A2 must NOT see Master A1's pending mutations
    const pendingA2 = await mutationQueueRepository.getPendingMutations(masterA2);
    expect(pendingA2.length).toBe(0);

    // Master A2 attempting to inspect Master A1's mutation directly is denied
    const mutA1 = (await mutationQueueRepository.getQuarantinedMutations(masterA1))[0];
    await expect(
      mutationQueueRepository.getMutationById(masterA2, mutA1.id)
    ).rejects.toThrow(UnauthorizedClassError);
  });

  // --------------------------------------------------------------------------
  // TEST 14: Unassigned class access denial
  // --------------------------------------------------------------------------
  it('14. should deny Master access to an unassigned class even within same organization', async () => {
    await initDatabase({ useMemory: true });

    // Master A1 attempting to load Master A2's sparring class
    await expect(
      masterAttendanceService.loadAttendanceContext(masterA1, {
        isOffline: true,
        classId: 'cls_a_sparring',
      })
    ).rejects.toThrow(UnauthorizedClassError);
  });

  // --------------------------------------------------------------------------
  // TEST 15: Pending mutation quarantine
  // --------------------------------------------------------------------------
  it('15. should quarantine pending records on logout/switch without silent deletion', async () => {
    await initDatabase({ useMemory: true });

    await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    // Master A1 logs out
    await databaseLifecycle.onLogout(masterA1);

    // Verification: Not deleted! Quarantined with reason LOGGED_OUT
    const quarantined = await mutationQueueRepository.getQuarantinedMutations(masterA1);
    expect(quarantined.length).toBe(1);
    expect(quarantined[0].queue_status).toBe('QUARANTINED');
    expect(quarantined[0].quarantine_reason).toBe('LOGGED_OUT');

    // When Master A1 logs back in, quarantined mutations are restored
    await databaseLifecycle.onAccountSwitched(null, masterA1);
    const restored = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(restored.length).toBe(1);
    expect(restored[0].queue_status).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // TEST 16: Expired or revoked authorization handling
  // --------------------------------------------------------------------------
  it('16. should quarantine mutations when Master class authorization is revoked', async () => {
    await initDatabase({ useMemory: true });
    await rosterRepository.saveClasses(masterA1, [classesA[0]]);
    await rosterRepository.saveTrainingGroups(masterA1, groupsA);
    await sessionRepository.saveSessions(masterA1, [sessionA1]);
    await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    // Revocation of cls_a_junior for Master A1
    const count = await masterAttendanceService.handleRevokedClass(masterA1, 'cls_a_junior');
    expect(count).toBe(1);

    const pending = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pending.length).toBe(0);

    const quarantined = await mutationQueueRepository.getQuarantinedMutations(masterA1);
    expect(quarantined[0].quarantine_reason).toBe('REVOKED_CLASS_ASSIGNMENT');
  });

  // --------------------------------------------------------------------------
  // TEST 17: Correct sync status display in AttendanceScreen
  // --------------------------------------------------------------------------
  it('17. should render sync indicator and offline status accurately in AttendanceScreen', async () => {
    await initDatabase({ useMemory: true });
    await rosterRepository.saveClasses(masterA1, [classesA[0]]);
    await rosterRepository.saveTrainingGroups(masterA1, groupsA);
    await rosterRepository.saveStudentsRoster(masterA1, studentsA);
    await sessionRepository.saveSessions(masterA1, [sessionA1]);

    // Enqueue 1 pending record
    await masterAttendanceService.recordAttendanceMark(masterA1, {
      sessionId: 'sess_a1_today',
      studentId: 'stu_1',
      status: 'Present',
    });

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <AttendanceScreen user={masterA1} isOffline={true} />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    // Check offline indicator
    await waitFor(() => {
      expect(screen.getByTestId('attendance-offline-banner')).toBeTruthy();
      expect(screen.getByTestId('attendance-unsynced-badge')).toBeTruthy();
      expect(screen.getByText(/1 unsynchronized/i)).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // TEST 18: Accessibility and theme rendering
  // --------------------------------------------------------------------------
  it('18. should provide descriptive accessibility labels and responsive controls', async () => {
    await initDatabase({ useMemory: true });
    await rosterRepository.saveClasses(masterA1, [classesA[0]]);
    await rosterRepository.saveTrainingGroups(masterA1, groupsA);
    await rosterRepository.saveStudentsRoster(masterA1, studentsA);
    await sessionRepository.saveSessions(masterA1, [sessionA1]);

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <AttendanceScreen user={masterA1} isOffline={false} />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('master-attendance-screen')).toBeTruthy();
      expect(screen.getByTestId('input-student-search')).toBeTruthy();
      expect(screen.getByLabelText(/search students/i)).toBeTruthy();
    });
  });
});
