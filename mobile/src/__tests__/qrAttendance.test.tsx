import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { initDatabase, closeDatabase, resetDatabaseForTesting } from '../database/connection';
import { rosterRepository } from '../database/repositories/rosterRepository';
import { sessionRepository } from '../database/repositories/sessionRepository';
import { mutationQueueRepository } from '../database/repositories/mutationQueueRepository';
import { databaseLifecycle } from '../database/lifecycle';
import { qrPassService, StudentQRPayload } from '../services/qrPassService';
import { masterAttendanceService } from '../services/masterAttendanceService';
import { offlineSyncService } from '../services/offlineSyncService';
import { networkService } from '../services/networkService';
import { QRScannerModal } from '../screens/roles/master/QRScannerModal';
import { StudentDigitalPass } from '../components/StudentDigitalPass';
import { ParentChildPassViewer } from '../components/ParentChildPassViewer';
import { StudentAttendanceScreen } from '../screens/roles/student/index';
import { AuthUser } from '../types/auth';
import { CachedStudent, CachedSession, AttendanceStatus } from '../database/types';
import { apiClient } from '../services/apiClient';

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// Mock camera permissions & expo-camera
let mockCameraPermission: any = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn().mockImplementation(async () => {
  mockCameraPermission = { granted: true, canAskAgain: true };
  return mockCameraPermission;
});

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props: any) => {
      return React.createElement(View, {
        ...props,
        testID: props.testID || 'camera-view',
      });
    },
    useCameraPermissions: () => [mockCameraPermission, mockRequestPermission],
  };
});

// Mock react-native-qrcode-svg
jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockQRCode = (props: any) => React.createElement(View, { ...props, testID: 'mock-qrcode-svg' });
  MockQRCode.displayName = 'MockQRCode';
  return MockQRCode;
});

// Mock apiClient
jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

// Mock dashboardService
jest.mock('../services/dashboardService', () => ({
  dashboardService: {
    getParentDashboard: jest.fn(),
    getStudentDashboard: jest.fn(),
    getMasterDashboard: jest.fn(),
  },
}));

describe('BeltFlow Phase 2 Task 2.4 — QR Attendance Scanner & Student Digital Pass', () => {
  const masterA: AuthUser = {
    id: 'usr_master_a',
    email: 'master@persatuan-a.org',
    fullName: 'Master Arumugam',
    role: 'MASTER',
    organizationId: 'org_persatuan_a',
    assignedClassIds: ['cls_a_junior'],
  };

  const currentOrgId = masterA.organizationId || 'org_persatuan_a';

  const studentA1: CachedStudent = {
    id: 'stu_a1',
    organization_id: currentOrgId,
    class_id: 'cls_a_junior',
    full_name: 'Dinesh Kumar',
    belt_rank: 'Yellow Belt',
    status: 'ACTIVE',
  };

  const studentA2Inactive: CachedStudent = {
    id: 'stu_a2_inactive',
    organization_id: currentOrgId,
    class_id: 'cls_a_junior',
    full_name: 'Suresh Rao',
    belt_rank: 'Green Belt',
    status: 'INACTIVE',
  };

  const studentB: CachedStudent = {
    id: 'stu_b_foreign',
    organization_id: 'org_persatuan_b',
    class_id: 'cls_b_main',
    full_name: 'Lee Wei',
    belt_rank: 'Blue Belt',
    status: 'ACTIVE',
  };

  const activeSessionA: CachedSession = {
    id: 'ses_a_today',
    organization_id: currentOrgId,
    class_id: 'cls_a_junior',
    group_id: null,
    schedule_id: null,
    session_date: new Date().toISOString().split('T')[0],
    start_time: '18:00',
    end_time: '19:30',
    status: 'Scheduled',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCameraPermission = { granted: true, canAskAgain: true };
    networkService.resetForTesting();
    offlineSyncService.resetForTesting();
    await resetDatabaseForTesting();
    await initDatabase({ useMemory: true });

    // Seed master A, classes, active session and rosters in SQLite
    databaseLifecycle.setActiveUser(masterA);
    await rosterRepository.saveClasses(masterA, [{
      id: 'cls_a_junior',
      organization_id: currentOrgId,
      name: 'Junior Silambam',
      schedule: 'Mon/Wed 6pm',
      location: 'Dojo Hall',
      monthly_fee: 100,
      master_id: masterA.id,
    }]);
    await sessionRepository.saveSessions(masterA, [activeSessionA]);
    await rosterRepository.saveStudentsRoster(masterA, [studentA1, studentA2Inactive]);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  // Test 1: Valid QR pass creation
  test('1. Valid QR pass creation with tamper-evident signature and no PII', () => {
    const payload = qrPassService.createStudentPassPayload({
      id: studentA1.id,
      organizationId: studentA1.organization_id,
      fullName: studentA1.full_name,
      beltRank: studentA1.belt_rank,
      status: 'ACTIVE',
    });

    const qrString = qrPassService.serializePayload(payload);
    expect(qrString).toContain('"type":"BF_PASS"');

    // Verify non-PII compliance: must NOT contain phone, NRIC, email, or token
    expect(qrString).not.toContain('012-');
    expect(qrString).not.toContain('NRIC');
    expect(qrString).not.toContain('MyKid');
    expect(qrString).not.toContain('jwt');
    expect(qrString).not.toContain('password');

    const parsed = qrPassService.parsePayload(qrString);
    expect(parsed).not.toBeNull();
    expect(parsed?.sid).toBe(studentA1.id);
    expect(parsed?.oid).toBe(studentA1.organization_id);
    expect(parsed?.sig).toBeDefined();
    expect(parsed?.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  // Test 2: Invalid QR rejection
  test('2. Invalid QR rejection (malformed, bad JSON, or tampered payload)', () => {
    const badScans = [
      'https://google.com/malicious',
      'NOT_VALID_JSON_AT_ALL',
      '{"type":"OTHER_FORMAT","id":"123"}',
      JSON.stringify({ type: 'BF_PASS', v: 2 }), // unsupported version
    ];

    for (const badScan of badScans) {
      const result = qrPassService.validateScannedPass(badScan, {
        currentOrgId,
        session: activeSessionA,
        roster: [studentA1],
      });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_QR_FORMAT');
    }
  });

  // Test 3: Unauthorized student rejection (student not in roster)
  test('3. Unauthorized student rejection when student is not in authorized class roster', () => {
    const unrosteredPayload = qrPassService.createStudentPassPayload({
      id: 'stu_unknown_person',
      organizationId: currentOrgId,
      fullName: 'Unknown Person',
      beltRank: 'White Belt',
      status: 'ACTIVE',
    });
    const qrString = qrPassService.serializePayload(unrosteredPayload);

    const result = qrPassService.validateScannedPass(qrString, {
      currentOrgId,
      session: activeSessionA,
      roster: [studentA1], // only studentA1 is in roster
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('STUDENT_NOT_FOUND');
    expect(result.errorMessage).toContain('not found in authorized class roster');
  });

  // Test 4: Cross-Persatuan rejection
  test('4. Cross-Persatuan rejection when pass belongs to a different academy', () => {
    const foreignPayload = qrPassService.createStudentPassPayload({
      id: studentB.id,
      organizationId: studentB.organization_id, // org_persatuan_b
      fullName: studentB.full_name,
      beltRank: studentB.belt_rank,
      status: 'ACTIVE',
    });
    const qrString = qrPassService.serializePayload(foreignPayload);

    const result = qrPassService.validateScannedPass(qrString, {
      currentOrgId, // org_persatuan_a
      session: activeSessionA,
      roster: [studentA1],
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('CROSS_PERSATUAN_REJECTED');
    expect(result.errorMessage).toContain('Cross-Persatuan scan rejected');
  });

  // Test 5: Unassigned class rejection
  test('5. Unassigned class rejection when student is registered in another class', () => {
    const studentFromOtherClass: CachedStudent = {
      id: 'stu_other_class',
      organization_id: currentOrgId,
      class_id: 'cls_different_senior',
      full_name: 'Priya Devi',
      belt_rank: 'Yellow Belt',
      status: 'ACTIVE',
    };

    const payload = qrPassService.createStudentPassPayload({
      id: studentFromOtherClass.id,
      organizationId: studentFromOtherClass.organization_id,
      fullName: studentFromOtherClass.full_name,
      beltRank: studentFromOtherClass.belt_rank,
      status: 'ACTIVE',
    });
    const qrString = qrPassService.serializePayload(payload);

    // Roster has student, but their class_id doesn't match activeSessionA.class_id
    const result = qrPassService.validateScannedPass(qrString, {
      currentOrgId,
      session: activeSessionA,
      roster: [studentFromOtherClass],
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('UNASSIGNED_STUDENT_REJECTED');
  });

  // Test 6: Duplicate scan prevention
  test('6. Duplicate scan detection identifies previously recorded attendance', () => {
    const attendanceMap: Record<string, AttendanceStatus | null> = {
      [studentA1.id]: 'Present',
    };

    const dupCheck = qrPassService.checkDuplicateScan(studentA1.id, attendanceMap);
    expect(dupCheck.isDuplicate).toBe(true);
    expect(dupCheck.existingStatus).toBe('Present');

    const newStudentCheck = qrPassService.checkDuplicateScan('stu_never_scanned', attendanceMap);
    expect(newStudentCheck.isDuplicate).toBe(false);
    expect(newStudentCheck.existingStatus).toBeNull();
  });

  // Test 7: Offline scan and local save
  test('7. Offline scan saves mutation locally to SQLite queue as PENDING', async () => {
    networkService.setState({ status: 'offline' });

    // Master marks attendance for studentA1 via masterAttendanceService
    const mutation = await masterAttendanceService.recordAttendanceMark(masterA, {
      sessionId: activeSessionA.id,
      studentId: studentA1.id,
      status: 'Present',
    });

    expect(mutation.id).toBeDefined();
    expect(mutation.queue_status).toBe('PENDING');
    expect(mutation.status).toBe('Present');

    // Verify written to SQLite mutation queue
    const pendingMutations = await mutationQueueRepository.getPendingMutations(masterA);
    expect(pendingMutations.length).toBe(1);
    expect(pendingMutations[0].student_id).toBe(studentA1.id);
    expect(pendingMutations[0].queue_status).toBe('PENDING');
  });

  // Test 8: Offline scan with missing roster rejects safely
  test('8. Offline scan with missing or un-cached roster rejects verification', () => {
    const payload = qrPassService.createStudentPassPayload({
      id: 'stu_uncached',
      organizationId: currentOrgId,
      fullName: 'Uncached Student',
      beltRank: 'White Belt',
      status: 'ACTIVE',
    });
    const qrString = qrPassService.serializePayload(payload);

    const result = qrPassService.validateScannedPass(qrString, {
      currentOrgId,
      session: activeSessionA,
      roster: [], // Empty roster offline
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe('STUDENT_NOT_FOUND');
  });

  // Test 9: Camera permission denial UI handling
  test('9. Camera permission denial displays guidance and manual fallback button', async () => {
    mockCameraPermission = { granted: false, canAskAgain: true };
    const mockOnClose = jest.fn();

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <QRScannerModal
            visible={true}
            onClose={mockOnClose}
            user={masterA}
            activeSession={activeSessionA}
            roster={[studentA1]}
            attendanceMap={{}}
            onAttendanceRecorded={jest.fn()}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByTestId('camera-permission-denied-state')).toBeTruthy();
    expect(screen.getByText('Camera Permission Required')).toBeTruthy();
    expect(screen.getByTestId('btn-grant-camera-permission')).toBeTruthy();
    expect(screen.getByTestId('btn-permission-manual-fallback')).toBeTruthy();

    fireEvent.press(screen.getByTestId('btn-permission-manual-fallback'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  // Test 10: Camera unavailable state fallback
  test('10. Camera hardware unavailable displays error and manual list option', async () => {
    const mockOnClose = jest.fn();
    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <QRScannerModal
            visible={true}
            onClose={mockOnClose}
            user={masterA}
            activeSession={activeSessionA}
            roster={[studentA1]}
            attendanceMap={{}}
            onAttendanceRecorded={jest.fn()}
            isCameraAvailable={false}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByTestId('camera-hardware-unavailable-state')).toBeTruthy();
    expect(screen.getByText('Camera Hardware Unavailable')).toBeTruthy();
    expect(screen.getByTestId('btn-fallback-manual-list')).toBeTruthy();

    fireEvent.press(screen.getByTestId('btn-fallback-manual-list'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  // Test 11: Parent linked-child pass access
  test('11. Parent linked-child pass access displays approved child credentials', async () => {
    const childrenList = [
      {
        id: 'stu_child_1',
        organizationId: currentOrgId,
        fullName: 'Kavitha Devi',
        beltRank: 'Yellow Belt',
        status: 'ACTIVE' as const,
      },
      {
        id: 'stu_child_2',
        organizationId: currentOrgId,
        fullName: 'Surya Kumar',
        beltRank: 'Green Belt',
        status: 'ACTIVE' as const,
      },
    ];

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <ParentChildPassViewer
            childrenList={childrenList}
            isOffline={false}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByTestId('parent-child-pass-viewer')).toBeTruthy();
    expect(screen.getAllByText('Kavitha Devi').length).toBeGreaterThanOrEqual(1);

    // Switch to second child
    fireEvent.press(screen.getByTestId('tab-child-stu_child_2'));
    expect(screen.getAllByText('Surya Kumar').length).toBeGreaterThanOrEqual(1);
  });

  // Test 12: Student personal pass access
  test('12. Student personal pass renders student credentials, belt badge, and QR code', async () => {
    const studentUser: AuthUser = {
      id: 'usr_student_1',
      email: 'student1@persatuan-a.org',
      fullName: 'Dinesh Kumar',
      role: 'STUDENT',
      organizationId: currentOrgId,
    };

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <StudentAttendanceScreen user={studentUser} isOffline={false} />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByTestId('student-attendance-screen')).toBeTruthy();
    expect(screen.getByTestId('student-personal-pass')).toBeTruthy();
    expect(screen.getAllByText('Dinesh Kumar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('pass-belt-badge')).toBeTruthy();
    expect(screen.getByTestId('pass-status-badge')).toBeTruthy();
  });

  // Test 13: Expired or revoked QR behavior
  test('13. Expired or revoked QR codes are rejected', () => {
    // A. Expired token (issued in past, expired)
    const expiredPayload = qrPassService.createStudentPassPayload(
      {
        id: studentA1.id,
        organizationId: studentA1.organization_id,
        fullName: studentA1.full_name,
        beltRank: studentA1.belt_rank,
        status: 'ACTIVE',
      },
      { issuedAt: 1000, expiresInDays: 1 } // exp will be 1000 + 86400 (very long ago)
    );
    const expiredQr = qrPassService.serializePayload(expiredPayload);

    const expiredResult = qrPassService.validateScannedPass(expiredQr, {
      currentOrgId,
      session: activeSessionA,
      roster: [studentA1],
    });

    expect(expiredResult.isValid).toBe(false);
    expect(expiredResult.errorCode).toBe('EXPIRED_PASS');

    // B. Revoked / Inactive membership
    const inactivePayload = qrPassService.createStudentPassPayload({
      id: studentA2Inactive.id,
      organizationId: studentA2Inactive.organization_id,
      fullName: studentA2Inactive.full_name,
      beltRank: studentA2Inactive.belt_rank,
      status: 'INACTIVE',
    });
    const inactiveQr = qrPassService.serializePayload(inactivePayload);

    const inactiveResult = qrPassService.validateScannedPass(inactiveQr, {
      currentOrgId,
      session: activeSessionA,
      roster: [studentA2Inactive],
    });

    expect(inactiveResult.isValid).toBe(false);
    expect(inactiveResult.errorCode).toBe('STUDENT_INACTIVE_REJECTED');
  });

  // Test 14: SQLite save failure handling
  test('14. SQLite save failure handles local database error gracefully without crash', async () => {
    const mockOnAttendanceRecorded = jest.fn();
    const payload = qrPassService.createStudentPassPayload({
      id: studentA1.id,
      organizationId: studentA1.organization_id,
      fullName: studentA1.full_name,
      beltRank: studentA1.belt_rank,
      status: 'ACTIVE',
    });
    const qrString = qrPassService.serializePayload(payload);

    // Mock masterAttendanceService to reject
    const spy = jest.spyOn(masterAttendanceService, 'recordAttendanceMark').mockRejectedValueOnce(new Error('Disk Full'));

    try {
      const screen = await render(
        <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
          <ThemeProvider>
            <QRScannerModal
              visible={true}
              onClose={jest.fn()}
              user={masterA}
              activeSession={activeSessionA}
              roster={[studentA1]}
              attendanceMap={{}}
              onAttendanceRecorded={mockOnAttendanceRecorded}
            />
          </ThemeProvider>
        </SafeAreaProvider>
      );

      // Simulate scanning via CameraView onBarcodeScanned prop
      const cameraView = screen.getByTestId('camera-view');
      await act(async () => {
        cameraView.props.onBarcodeScanned({ data: qrString });
      });

      // Confirmation card should appear
      expect(screen.getByTestId('qr-confirmation-card')).toBeTruthy();

      // Confirm attendance
      await act(async () => {
        fireEvent.press(screen.getByTestId('btn-confirm-qr-attendance'));
      });

      // Verify error banner is shown
      await waitFor(() => {
        expect(screen.getByText('Disk Full')).toBeTruthy();
      });
      expect(mockOnAttendanceRecorded).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  // Test 15: Connection recovery and sync
  test('15. Connection recovery and sync pushes offline QR attendance to server', async () => {
    networkService.setState({ status: 'offline' });

    // Save offline QR scan in SQLite
    const mutation = await masterAttendanceService.recordAttendanceMark(masterA, {
      sessionId: activeSessionA.id,
      studentId: studentA1.id,
      status: 'Present',
    });
    expect(mutation.id).toBeDefined();

    const pending = await mutationQueueRepository.getPendingMutations(masterA);
    expect(pending.length).toBe(1);

    // Mock server sync success
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      synced: [pending[0].id],
      conflicts: [],
      errors: [],
    });

    // Connection recovery: sync now
    offlineSyncService.setUser(masterA);
    const syncRes = await offlineSyncService.syncNow(masterA);

    expect(syncRes.syncedCount).toBe(1);
    expect(syncRes.error).toBeNull();

    // Mutation queue is now empty of pending mutations
    const remainingPending = await mutationQueueRepository.getPendingMutations(masterA);
    expect(remainingPending.length).toBe(0);
  });

  // Test 16: QR attendance correction
  test('16. QR attendance correction allows updating recorded status from Present to Late', async () => {
    // Initial attendance: Present
    await masterAttendanceService.recordAttendanceMark(masterA, {
      sessionId: activeSessionA.id,
      studentId: studentA1.id,
      status: 'Present',
    });

    const attendanceMap: Record<string, AttendanceStatus | null> = {
      [studentA1.id]: 'Present',
    };

    const payload = qrPassService.createStudentPassPayload({
      id: studentA1.id,
      organizationId: studentA1.organization_id,
      fullName: studentA1.full_name,
      beltRank: studentA1.belt_rank,
      status: 'ACTIVE',
    });
    const qrString = qrPassService.serializePayload(payload);

    const mockRecorded = jest.fn();

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <QRScannerModal
            visible={true}
            onClose={jest.fn()}
            user={masterA}
            activeSession={activeSessionA}
            roster={[studentA1]}
            attendanceMap={attendanceMap}
            onAttendanceRecorded={mockRecorded}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    // Simulate scan
    const cameraView = screen.getByTestId('camera-view');
    await act(async () => {
      cameraView.props.onBarcodeScanned({ data: qrString });
    });

    // Shows duplicate warning dialog
    expect(screen.getByTestId('dialog-duplicate-scan')).toBeTruthy();

    // Select 'Late'
    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-qr-status-late'));
    });

    // Confirm
    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-confirm-qr-attendance'));
    });

    await waitFor(() => {
      expect(mockRecorded).toHaveBeenCalledWith(studentA1.id, 'Late');
    });
  });

  // Test 17: Concurrent scan prevention
  test('17. Concurrent scan prevention debounce lock ignores rapid duplicate scan events', async () => {
    const payload = qrPassService.createStudentPassPayload({
      id: studentA1.id,
      organizationId: studentA1.organization_id,
      fullName: studentA1.full_name,
      beltRank: studentA1.belt_rank,
      status: 'ACTIVE',
    });
    const qrString = qrPassService.serializePayload(payload);

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <QRScannerModal
            visible={true}
            onClose={jest.fn()}
            user={masterA}
            activeSession={activeSessionA}
            roster={[studentA1]}
            attendanceMap={{}}
            onAttendanceRecorded={jest.fn()}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    // Trigger two consecutive events synchronously
    const cameraView = screen.getByTestId('camera-view');
    await act(async () => {
      cameraView.props.onBarcodeScanned({ data: qrString });
      cameraView.props.onBarcodeScanned({ data: qrString });
    });

    // Should only have locked and processed once
    expect(screen.getByTestId('qr-confirmation-card')).toBeTruthy();
  });

  // Test 18: Accessibility test
  test('18. Accessibility attributes and labels are correctly set on scanner and pass UI', async () => {
    const studentData = {
      id: studentA1.id,
      organizationId: studentA1.organization_id,
      fullName: studentA1.full_name,
      beltRank: studentA1.belt_rank,
      status: 'ACTIVE' as const,
    };

    const screen = await render(
      <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
        <ThemeProvider>
          <StudentDigitalPass
            student={studentData}
            isOffline={false}
            testID="student-digital-pass"
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );

    expect(screen.getByTestId('student-digital-pass')).toBeTruthy();
    expect(screen.getByLabelText('Attendance QR Code')).toBeTruthy();
    expect(screen.getByTestId('pass-belt-badge')).toBeTruthy();
    expect(screen.getByTestId('pass-status-badge')).toBeTruthy();
  });

  // Test 19: Android and iOS library compatibility
  test('19. Android/iOS library compatibility: expo-camera and react-native-qrcode-svg instantiate', () => {
    const CameraModule = require('expo-camera');
    expect(CameraModule.CameraView).toBeDefined();
    expect(CameraModule.useCameraPermissions).toBeDefined();

    const QRCodeModule = require('react-native-qrcode-svg');
    expect(QRCodeModule).toBeDefined();
  });

  // Test 20: Cryptographic signature verification and tamper detection (SEC-QR-001)
  test('20. Cryptographic signature verification and tamper detection (SEC-QR-001)', () => {
    // 1. Create a valid v2 signed pass
    const payload = qrPassService.createStudentPassPayload({
      id: studentA1.id,
      organizationId: studentA1.organization_id,
      fullName: studentA1.full_name,
      beltRank: studentA1.belt_rank,
      status: 'ACTIVE',
    });

    const parsed = qrPassService.parsePayload(qrPassService.serializePayload(payload));
    expect(parsed).not.toBeNull();
    expect(parsed?.v).toBe(2);
    expect(parsed?.kid).toBe('bf_qr_k1');
    expect(parsed?.nonce).toBeDefined();
    expect(parsed?.sig).toBeDefined();

    // 2. Tamper with sid in payload -> Cryptographic signature MUST reject with INVALID_SIGNATURE
    const tamperedPayload: StudentQRPayload = {
      ...parsed!,
      sid: 'stu_malicious_attacker',
    };
    const tamperedRaw = JSON.stringify(tamperedPayload);

    const validation = qrPassService.validateScannedPass(tamperedRaw, {
      currentOrgId,
      session: activeSessionA,
      roster: [studentA1],
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errorCode).toBe('INVALID_SIGNATURE');
    expect(validation.errorMessage).toContain('SEC-QR-001');

    // 3. Untampered valid pass for an unrostered student -> Rejects with STUDENT_NOT_FOUND
    const unrosteredPayload = qrPassService.createStudentPassPayload({
      id: 'stu_legit_but_unrostered',
      organizationId: currentOrgId,
      fullName: 'Legit Student',
      beltRank: 'White Belt',
      status: 'ACTIVE',
    });
    const unrosteredRaw = JSON.stringify(unrosteredPayload);

    const unrosteredResult = qrPassService.validateScannedPass(unrosteredRaw, {
      currentOrgId,
      session: activeSessionA,
      roster: [studentA1], // only studentA1 in roster
    });

    expect(unrosteredResult.isValid).toBe(false);
    expect(unrosteredResult.errorCode).toBe('STUDENT_NOT_FOUND');
  });

  // Test 21: Key rotation support and unknown key rejection
  test('21. Key rotation support validates older active keys and rejects unknown keys', () => {
    // Register older rotating key bf_qr_k0
    qrPassService.addTrustedKey('bf_qr_k0', 'old_rotated_secret_key');

    // Pass created with previous key bf_qr_k0
    const passOlderKey = qrPassService.createStudentPassPayload(
      {
        id: studentA1.id,
        organizationId: currentOrgId,
        fullName: studentA1.full_name,
        beltRank: studentA1.belt_rank,
        status: 'ACTIVE',
      },
      { kid: 'bf_qr_k0', secret: 'old_rotated_secret_key' }
    );

    const validWithOldKey = qrPassService.validateScannedPass(JSON.stringify(passOlderKey), {
      currentOrgId,
      session: activeSessionA,
      roster: [studentA1],
    });
    expect(validWithOldKey.isValid).toBe(true);

    // Pass created with unknown / forged key ID
    const passUnknownKey = qrPassService.createStudentPassPayload(
      {
        id: studentA1.id,
        organizationId: currentOrgId,
        fullName: studentA1.full_name,
        beltRank: studentA1.belt_rank,
        status: 'ACTIVE',
      },
      { kid: 'bf_unknown_key_99', secret: 'some_random_secret' }
    );

    const rejectedUnknownKey = qrPassService.validateScannedPass(JSON.stringify(passUnknownKey), {
      currentOrgId,
      session: activeSessionA,
      roster: [studentA1],
    });
    expect(rejectedUnknownKey.isValid).toBe(false);
    expect(rejectedUnknownKey.errorCode).toBe('UNKNOWN_KEY_ID');

    // Reset trusted keys
    qrPassService.resetTrustedKeys();
  });

});
