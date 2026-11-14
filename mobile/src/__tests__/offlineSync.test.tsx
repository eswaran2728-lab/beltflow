import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { initDatabase, resetDatabaseForTesting } from '../database/connection';
import { mutationQueueRepository } from '../database/repositories/mutationQueueRepository';
import { conflictRepository } from '../database/repositories/conflictRepository';
import { rosterRepository } from '../database/repositories/rosterRepository';
import { sessionRepository } from '../database/repositories/sessionRepository';
import { databaseLifecycle } from '../database/lifecycle';
import {
  offlineSyncService,
  calculateBackoffWithJitter,
} from '../services/offlineSyncService';
import { masterAttendanceService } from '../services/masterAttendanceService';
import { AttendanceScreen } from '../screens/roles/master/AttendanceScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { apiClient } from '../services/apiClient';
import { networkService } from '../services/networkService';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser } from '../types/auth';
import {
  CachedClass,
  CachedTrainingGroup,
  CachedStudent,
  CachedSession,
} from '../database/types';

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

describe('BeltFlow Phase 2 Task 2.3 — Automatic Offline Attendance Sync & Conflict Engine', () => {
  const masterA1: AuthUser = {
    id: 'user_master_a1',
    email: 'master1@persatuan-a.com',
    fullName: 'Master Tan A1',
    role: 'MASTER',
    organizationId: 'org_persatuan_a',
    assignedClassIds: ['cls_a1'],
  };

  const masterA2: AuthUser = {
    id: 'user_master_a2',
    email: 'master2@persatuan-a.com',
    fullName: 'Master Lee A2',
    role: 'MASTER',
    organizationId: 'org_persatuan_a',
    assignedClassIds: ['cls_a2'],
  };

  const masterB: AuthUser = {
    id: 'user_master_b1',
    email: 'master@persatuan-b.com',
    fullName: 'Master Wong B',
    role: 'MASTER',
    organizationId: 'org_persatuan_b',
    assignedClassIds: ['cls_b1'],
  };

  const classA1: CachedClass = {
    id: 'cls_a1',
    organization_id: 'org_persatuan_a',
    name: 'Silambam Advanced',
    monthly_fee: 100,
    master_id: masterA1.id,
  };

  const groupA1: CachedTrainingGroup = {
    id: 'grp_a1',
    organization_id: 'org_persatuan_a',
    class_id: 'cls_a1',
    name: 'Dragons',
    status: 'ACTIVE',
  };

  const sessionA1: CachedSession = {
    id: 'sess_a1',
    organization_id: 'org_persatuan_a',
    class_id: 'cls_a1',
    group_id: 'grp_a1',
    session_date: '2026-10-15',
    day_of_week: 'Thursday',
    start_time: '18:00',
    end_time: '19:30',
    location: 'Main Hall',
    status: 'Scheduled',
  };

  const studentsA1: CachedStudent[] = [
    {
      id: 'stu_1',
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a1',
      group_id: 'grp_a1',
      full_name: 'Adam Smith',
      belt_rank: 'Green Belt',
    },
    {
      id: 'stu_2',
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a1',
      group_id: 'grp_a1',
      full_name: 'Bella Swan',
      belt_rank: 'Yellow Belt',
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    networkService.resetForTesting();
    offlineSyncService.resetForTesting();
    await resetDatabaseForTesting();
    await initDatabase({ useMemory: true });
    databaseLifecycle.setActiveUser(masterA1);

    // Seed class, group, session, students
    await rosterRepository.saveClasses(masterA1, [classA1]);
    await rosterRepository.saveTrainingGroups(masterA1, [groupA1]);
    await sessionRepository.saveSessions(masterA1, [sessionA1]);
    await rosterRepository.saveStudentsRoster(masterA1, studentsA1);
  });

  afterEach(async () => {
    offlineSyncService.resetForTesting();
    await resetDatabaseForTesting();
  });

  // --------------------------------------------------------------------------
  // 1. Successful offline-to-online sync
  // --------------------------------------------------------------------------
  it('1. should successfully sync offline mutations when network becomes available', async () => {
    // Record 2 offline mutations
    const m1 = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });
    const m2 = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[1].id,
      status: 'Late',
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [m1.id, m2.id],
      conflicts: [],
      errors: [],
    });

    const result = await offlineSyncService.syncNow(masterA1);

    expect(result.syncedCount).toBe(2);
    expect(result.conflictCount).toBe(0);
    expect(result.error).toBeNull();

    // Verify mutations in SQLite are SYNCED
    const pending = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pending.length).toBe(0);

    const syncedM1 = await mutationQueueRepository.getMutationById(masterA1, m1.id);
    expect(syncedM1?.queue_status).toBe('SYNCED');
    expect(syncedM1?.synced_at).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. Fifty students marked offline, synced in bounded batches
  // --------------------------------------------------------------------------
  it('2. should sync fifty offline students across bounded batches sequentially', async () => {
    const fiftyStudents: CachedStudent[] = Array.from({ length: 50 }, (_, i) => ({
      id: `stu_bulk_${i}`,
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a1',
      group_id: 'grp_a1',
      full_name: `Student Bulk ${i}`,
      belt_rank: 'White Belt',
    }));
    await rosterRepository.saveStudentsRoster(masterA1, fiftyStudents);

    for (const s of fiftyStudents) {
      await mutationQueueRepository.enqueueAttendance(masterA1, {
        sessionId: sessionA1.id,
        studentId: s.id,
        status: 'Present',
      });
    }

    const pendingBefore = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pendingBefore.length).toBe(50);

    // Mock batches of 25 (2 batches needed)
    (apiClient.post as jest.Mock)
      .mockImplementationOnce(async (_url: string, body: any) => ({
        synced: body.mutations.map((m: any) => m.mutationId),
        conflicts: [],
        errors: [],
      }))
      .mockImplementationOnce(async (_url: string, body: any) => ({
        synced: body.mutations.map((m: any) => m.mutationId),
        conflicts: [],
        errors: [],
      }));

    const result = await offlineSyncService.syncNow(masterA1, { maxBatchSize: 25 });

    expect(result.syncedCount).toBe(50);
    expect(apiClient.post).toHaveBeenCalledTimes(2);

    const pendingAfter = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pendingAfter.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 3. Connection loss during batch upload
  // --------------------------------------------------------------------------
  it('3. should revert in-flight mutations to pending and increment retry on network drop', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isNetworkError: true,
      message: 'Network connection lost.',
    });

    const result = await offlineSyncService.syncNow(masterA1);

    expect(result.syncedCount).toBe(0);
    expect(result.error).toBe('Network connection lost.');

    const refreshed = await mutationQueueRepository.getMutationById(masterA1, m.id);
    expect(refreshed?.queue_status).toBe('PENDING');
    expect(refreshed?.retry_count).toBe(1);
    expect(refreshed?.last_error).toBe('Network connection lost.');
  });

  // --------------------------------------------------------------------------
  // 4. Request timeout followed by retry
  // --------------------------------------------------------------------------
  it('4. should handle timeout gracefully and succeed on subsequent retry', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    // First attempt: timeout
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      status: 408,
      message: 'Request timeout.',
    });

    const failRes = await offlineSyncService.syncNow(masterA1);
    expect(failRes.syncedCount).toBe(0);

    // Second attempt: success
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [m.id],
      conflicts: [],
      errors: [],
    });

    const successRes = await offlineSyncService.syncNow(masterA1);
    expect(successRes.syncedCount).toBe(1);

    const finalM = await mutationQueueRepository.getMutationById(masterA1, m.id);
    expect(finalM?.queue_status).toBe('SYNCED');
  });

  // --------------------------------------------------------------------------
  // 5. Duplicate mutation replay
  // --------------------------------------------------------------------------
  it('5. should acknowledge duplicate mutation replay without error', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    // Server returns duplicate mutation in synced array via replay protection
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [m.id],
      conflicts: [],
      errors: [],
    });

    const res = await offlineSyncService.syncNow(masterA1);
    expect(res.syncedCount).toBe(1);

    const verified = await mutationQueueRepository.getMutationById(masterA1, m.id);
    expect(verified?.queue_status).toBe('SYNCED');
  });

  // --------------------------------------------------------------------------
  // 6. Legitimate correction after successful sync
  // --------------------------------------------------------------------------
  it('6. should track legitimate correction with sequenced mutation linking', async () => {
    // 1. Mark and sync Present
    const m1 = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });
    await mutationQueueRepository.markMutationSynced(masterA1, m1.id);

    // 2. Master later changes to Late (correction)
    const m2 = await mutationQueueRepository.recordLegitimateCorrection(
      masterA1,
      sessionA1.id,
      studentsA1[0].id,
      'Late'
    );

    expect(m2.id).not.toBe(m1.id);
    expect(m2.correction_of_mutation_id).toBe(m1.id);
    expect(m2.sequence_number).toBe(2);
    expect(m2.queue_status).toBe('PENDING');

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [m2.id],
      conflicts: [],
      errors: [],
    });

    const res = await offlineSyncService.syncNow(masterA1);
    expect(res.syncedCount).toBe(1);

    const syncedM2 = await mutationQueueRepository.getMutationById(masterA1, m2.id);
    expect(syncedM2?.queue_status).toBe('SYNCED');
  });

  // --------------------------------------------------------------------------
  // 7. App restart before sync
  // --------------------------------------------------------------------------
  it('7. should recover in-flight mutations back to pending on app restart', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    // Mark in flight as if mid-network request during crash
    await mutationQueueRepository.markMutationInFlight(masterA1, m.id);

    // Simulate app reboot recovery
    const recoveredCount = await mutationQueueRepository.resetInFlightMutations(masterA1.id);
    expect(recoveredCount).toBe(1);

    const pending = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(m.id);
    expect(pending[0].queue_status).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // 8. Concurrent worker prevention
  // --------------------------------------------------------------------------
  it('8. should prevent concurrent sync workers using mutex lock', async () => {
    await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    let resolveApi: any;
    const apiPromise = new Promise(resolve => {
      resolveApi = resolve;
    });

    (apiClient.post as jest.Mock).mockImplementationOnce(() => apiPromise);

    // Trigger worker 1 (hangs in flight)
    const worker1Promise = offlineSyncService.syncNow(masterA1);

    // Trigger worker 2 immediately while worker 1 is active
    const worker2Result = await offlineSyncService.syncNow(masterA1);
    expect(worker2Result.error).toBe('Sync is already in progress.');

    // Complete worker 1
    resolveApi({ synced: [], conflicts: [], errors: [] });
    await worker1Promise;
  });

  // --------------------------------------------------------------------------
  // 9. Expired JWT
  // --------------------------------------------------------------------------
  it('9. should stop sync and preserve mutations when JWT is expired', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      status: 401,
      message: 'Invalid or expired session token.',
    });

    const res = await offlineSyncService.syncNow(masterA1);

    expect(res.syncedCount).toBe(0);
    expect(res.error).toBe('Invalid or expired session token.');

    // Mutation is not lost
    const pending = await mutationQueueRepository.getPendingMutations(masterA1);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(m.id);
  });

  // --------------------------------------------------------------------------
  // 10. Revoked Master assignment
  // --------------------------------------------------------------------------
  it('10. should quarantine pending mutations with AUTH_REVOKED if Master assignment revoked', async () => {
    await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      status: 403,
      message: 'Master assignment revoked.',
    });

    const res = await offlineSyncService.syncNow(masterA1);

    expect(res.syncedCount).toBe(0);
    expect(res.error).toContain('Master authorization has been revoked');

    // Records are quarantined, never deleted
    const quarantined = await mutationQueueRepository.getQuarantinedMutations(masterA1);
    expect(quarantined.length).toBe(1);
    expect(quarantined[0].quarantine_reason).toBe('AUTH_REVOKED');
  });

  // --------------------------------------------------------------------------
  // 11. Cross-Persatuan isolation
  // --------------------------------------------------------------------------
  it('11. should isolate sync queue across distinct Persatuan organizations', async () => {
    await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    // Master B cannot see Master A's pending mutations
    const pendingForMasterB = await mutationQueueRepository.getPendingMutations(masterB);
    expect(pendingForMasterB.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 12. Same-Persatuan account switching
  // --------------------------------------------------------------------------
  it('12. should prevent Master B from uploading Master A pending records after account switch', async () => {
    await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    // Switch account to Master A2
    await databaseLifecycle.onAccountSwitched(masterA1, masterA2);
    offlineSyncService.setUser(masterA2);

    const pendingForA2 = await mutationQueueRepository.getPendingMutations(masterA2);
    expect(pendingForA2.length).toBe(0);

    // Syncing as Master A2 uploads 0 records
    (apiClient.post as jest.Mock).mockClear();
    const res = await offlineSyncService.syncNow(masterA2);
    expect(res.syncedCount).toBe(0);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 13. Closed training session conflict
  // --------------------------------------------------------------------------
  it('13. should record conflict and mark mutation CONFLICT when session is closed on server', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [],
      conflicts: [
        {
          mutationId: m.id,
          code: 'SESSION_CLOSED',
          reason: 'Training session has been cancelled on the server.',
        },
      ],
      errors: [],
    });

    const res = await offlineSyncService.syncNow(masterA1);

    expect(res.conflictCount).toBe(1);
    const conflicts = await conflictRepository.getConflicts(masterA1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflict_reason).toContain('cancelled');

    const updatedM = await mutationQueueRepository.getMutationById(masterA1, m.id);
    expect(updatedM?.queue_status).toBe('CONFLICT');
  });

  // --------------------------------------------------------------------------
  // 14. Student transfer conflict
  // --------------------------------------------------------------------------
  it('14. should record STUDENT_TRANSFERRED conflict in SQLite', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [],
      conflicts: [
        {
          mutationId: m.id,
          code: 'STUDENT_TRANSFERRED',
          reason: 'Student transferred to another class or group.',
        },
      ],
      errors: [],
    });

    const res = await offlineSyncService.syncNow(masterA1);
    expect(res.conflictCount).toBe(1);

    const conflicts = await conflictRepository.getConflicts(masterA1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflict_reason).toContain('transferred');
  });

  // --------------------------------------------------------------------------
  // 15. Concurrent server attendance modification
  // --------------------------------------------------------------------------
  it('15. should record CONCURRENT_MODIFICATION with server status and timestamp', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [],
      conflicts: [
        {
          mutationId: m.id,
          code: 'CONCURRENT_MODIFICATION',
          reason: 'Attendance was updated by another instructor on the server.',
          serverStatus: 'Late',
          serverTimestamp: '2026-10-15T18:15:00Z',
        },
      ],
      errors: [],
    });

    const res = await offlineSyncService.syncNow(masterA1);
    expect(res.conflictCount).toBe(1);

    const conflicts = await conflictRepository.getConflicts(masterA1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].server_status).toBe('Late');
    expect(conflicts[0].server_timestamp).toBe('2026-10-15T18:15:00Z');
  });

  // --------------------------------------------------------------------------
  // 16. Server 409 conflict handled gracefully
  // --------------------------------------------------------------------------
  it('16. should handle server 409 conflict gracefully without throwing uncaught error', async () => {
    await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      status: 409,
      message: 'State conflict on server.',
    });

    const res = await offlineSyncService.syncNow(masterA1);
    expect(res.error).toBe('State conflict on server.');
    expect(res.syncedCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 17. Server 429 rate limit backoff
  // --------------------------------------------------------------------------
  it('17. should track retry count on server 429 rate limit response', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      status: 429,
      message: 'Too many requests. Please slow down.',
    });

    const res = await offlineSyncService.syncNow(masterA1);
    expect(res.error).toContain('Too many requests');

    const updatedM = await mutationQueueRepository.getMutationById(masterA1, m.id);
    expect(updatedM?.retry_count).toBe(1);
    expect(updatedM?.queue_status).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // 18. Server 500/503 outage backoff
  // --------------------------------------------------------------------------
  it('18. should handle server 503 outage and mark status error for retry', async () => {
    await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      status: 503,
      message: 'BeltFlow service unavailable.',
    });

    const res = await offlineSyncService.syncNow(masterA1);
    expect(res.error).toBe('BeltFlow service unavailable.');
    expect(offlineSyncService.getState().status).toBe('error');
  });

  // --------------------------------------------------------------------------
  // 19. Backoff with jitter calculation
  // --------------------------------------------------------------------------
  it('19. should calculate exponential backoff with jitter bounded by maxMs', () => {
    const backoff0 = calculateBackoffWithJitter(0, 1000, 30000);
    expect(backoff0).toBeGreaterThanOrEqual(1000);
    expect(backoff0).toBeLessThanOrEqual(1300);

    const backoff3 = calculateBackoffWithJitter(3, 1000, 30000);
    // 1000 * 2^3 = 8000 + 20% jitter
    expect(backoff3).toBeGreaterThanOrEqual(8000);
    expect(backoff3).toBeLessThanOrEqual(10000);

    const backoff10 = calculateBackoffWithJitter(10, 1000, 30000);
    // Capped at 30000 + jitter
    expect(backoff10).toBeLessThanOrEqual(37000);
  });

  // --------------------------------------------------------------------------
  // 20. Recovery after partial batch completion
  // --------------------------------------------------------------------------
  it('20. should preserve acknowledged batch 1 when batch 2 fails', async () => {
    const students4: CachedStudent[] = Array.from({ length: 4 }, (_, i) => ({
      id: `stu_part_${i}`,
      organization_id: 'org_persatuan_a',
      class_id: 'cls_a1',
      group_id: 'grp_a1',
      full_name: `Student Part ${i}`,
      belt_rank: 'White Belt',
    }));
    await rosterRepository.saveStudentsRoster(masterA1, students4);

    const mutations = [];
    for (const s of students4) {
      mutations.push(
        await mutationQueueRepository.enqueueAttendance(masterA1, {
          sessionId: sessionA1.id,
          studentId: s.id,
          status: 'Present',
        })
      );
    }

    // Batch size 2: batch 1 succeeds, batch 2 throws error
    (apiClient.post as jest.Mock)
      .mockResolvedValueOnce({
        synced: [mutations[0].id, mutations[1].id],
        conflicts: [],
        errors: [],
      })
      .mockRejectedValueOnce({
        isNetworkError: true,
        message: 'Interrupted during second batch',
      });

    const res = await offlineSyncService.syncNow(masterA1, { maxBatchSize: 2 });
    expect(res.syncedCount).toBe(2);
    expect(res.error).toBe('Interrupted during second batch');

    // Batch 1 items are SYNCED
    const m0 = await mutationQueueRepository.getMutationById(masterA1, mutations[0].id);
    const m1 = await mutationQueueRepository.getMutationById(masterA1, mutations[1].id);
    expect(m0?.queue_status).toBe('SYNCED');
    expect(m1?.queue_status).toBe('SYNCED');

    // Batch 2 items are PENDING for retry
    const m2 = await mutationQueueRepository.getMutationById(masterA1, mutations[2].id);
    const m3 = await mutationQueueRepository.getMutationById(masterA1, mutations[3].id);
    expect(m2?.queue_status).toBe('PENDING');
    expect(m3?.queue_status).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // 21. No premature success indicator
  // --------------------------------------------------------------------------
  it('21. should never report success status before server response is received', async () => {
    await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    let syncStateInFlight: string | null = null;
    offlineSyncService.onSyncStateChange(state => {
      if (state.status === 'syncing') {
        syncStateInFlight = state.status;
      }
    });

    (apiClient.post as jest.Mock).mockImplementationOnce(async () => {
      expect(syncStateInFlight).toBe('syncing');
      expect(offlineSyncService.getState().status).not.toBe('success');
      return { synced: [], conflicts: [], errors: [] };
    });

    await offlineSyncService.syncNow(masterA1);
  });

  // --------------------------------------------------------------------------
  // 22. Manual sync action in AttendanceScreen
  // --------------------------------------------------------------------------
  it('22. should allow Master to trigger manual sync via Sync Now button in UI', async () => {
    // Seed pending mutation in SQLite
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.get as jest.Mock).mockResolvedValue({
      classes: [classA1],
      groups: [groupA1],
      sessions: [sessionA1],
      roster: studentsA1,
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [m.id],
      conflicts: [],
      errors: [],
    });

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <AttendanceScreen user={masterA1} isOffline={false} />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('btn-sync-now')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-sync-now'));
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/attendance/sync',
        expect.any(Object),
        expect.any(Object)
      );
    });

    screen.unmount();
  });

  // --------------------------------------------------------------------------
  // 23. Foreground reconnection
  // --------------------------------------------------------------------------
  it('23. should auto-trigger sync when network reconnects', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [m.id],
      conflicts: [],
      errors: [],
    });

    offlineSyncService.setUser(masterA1);

    // Simulate transition from offline to online
    networkService.simulateOffline();
    await act(async () => {
      networkService.simulateOnline();
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/attendance/sync',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  // --------------------------------------------------------------------------
  // 24. Failed SQLite persistence handling
  // --------------------------------------------------------------------------
  it('24. should show save failure banner and retry button if SQLite write fails', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      classes: [classA1],
      groups: [groupA1],
      sessions: [sessionA1],
      roster: studentsA1,
    });

    (apiClient.post as jest.Mock).mockResolvedValue({
      synced: [],
      conflicts: [],
      errors: [],
    });

    // Mock recordAttendanceMark failure
    jest
      .spyOn(masterAttendanceService, 'recordAttendanceMark')
      .mockRejectedValueOnce(new Error('SQLite disk I/O error'));

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <AttendanceScreen user={masterA1} isOffline={false} />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    // Wait for student row to render
    await waitFor(() => {
      expect(screen.getByTestId(`btn-status-present-${studentsA1[0].id}`)).toBeTruthy();
    });

    // Mark Present
    await act(async () => {
      fireEvent.press(screen.getByTestId(`btn-status-present-${studentsA1[0].id}`));
    });

    // Press Save
    await waitFor(() => {
      expect(screen.getByTestId('btn-attendance-save')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-attendance-save'));
    });

    // Assert Save Failure banner is displayed with Retry button
    await waitFor(() => {
      expect(screen.getByTestId('attendance-save-failure-banner')).toBeTruthy();
      expect(screen.getByTestId('btn-retry-save')).toBeTruthy();
    });

    // Restore spy and retry
    (masterAttendanceService.recordAttendanceMark as jest.Mock).mockRestore();
    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-retry-save'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('attendance-save-failure-banner')).toBeNull();
    });

    screen.unmount();
  });

  // --------------------------------------------------------------------------
  // 25. Audit trail and conflict retention
  // --------------------------------------------------------------------------
  it('25. should retain full conflict audit trail in SQLite for administrative review', async () => {
    const m = await mutationQueueRepository.enqueueAttendance(masterA1, {
      sessionId: sessionA1.id,
      studentId: studentsA1[0].id,
      status: 'Present',
    });

    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [],
      conflicts: [
        {
          mutationId: m.id,
          code: 'CONCURRENT_MODIFICATION',
          reason: 'Marked Absent by Admin 5 minutes ago',
          serverStatus: 'Absent',
          serverTimestamp: '2026-10-15T18:20:00Z',
        },
      ],
      errors: [],
    });

    await offlineSyncService.syncNow(masterA1);

    const conflicts = await conflictRepository.getConflicts(masterA1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].local_status).toBe('Present');
    expect(conflicts[0].server_status).toBe('Absent');
    expect(conflicts[0].conflict_reason).toContain('Admin');
    expect(conflicts[0].resolution).toBe('PENDING');

    // Resolve conflict
    await conflictRepository.resolveConflict(masterA1, conflicts[0].id, 'RESOLVED_SERVER');

    const pendingAfterResolution = await conflictRepository.getConflicts(masterA1, true);
    expect(pendingAfterResolution.length).toBe(0);

    const allAfterResolution = await conflictRepository.getConflicts(masterA1, false);
    expect(allAfterResolution.length).toBe(1);
    expect(allAfterResolution[0].resolution).toBe('RESOLVED_SERVER');
  });
});
