/**
 * Student navigation wiring: the Home tab is a stack (Dashboard, MyApplications,
 * VideoFeedback). Quick actions on the student home open those screens, and
 * entries for optional modules (media, learning) are hidden when the server's
 * release switches them off. Synthetic test data only.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthUser, UserRole } from '../types/auth';
import { StudentNavigator } from '../navigation/roleNavigators/StudentNavigator';
import { releaseService } from '../services/releaseService';
import { mediaFeedbackService } from '../services/mediaFeedbackService';
import { clearDashboardCache } from '../services/dashboardService';

const STUDENT_RECORD_ID = 'stu_record_test_01';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn((url: string) => {
      if (url === '/api/v1/students/me') {
        return Promise.resolve({
          student: {
            id: 'stu_record_test_01',
            full_name: 'Test Student',
            belt_rank: 'White Belt',
            organization_id: 'org_test_01',
            status: 'ACTIVE',
            monthly_fee: 0,
          },
        });
      }
      if (url === '/enrollment-applications/me') {
        return Promise.resolve({ applications: [] });
      }
      return Promise.resolve({});
    }),
    post: jest.fn(),
    patch: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/releaseService', () => ({
  releaseService: { getReleaseModules: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../services/mediaFeedbackService', () => ({
  mediaFeedbackService: {
    getStudentVideos: jest.fn().mockResolvedValue([]),
    requestUpload: jest.fn(),
    getPlaybackUrl: jest.fn(),
    addAnnotation: jest.fn(),
    revokeMediaConsent: jest.fn(),
    deleteVideo: jest.fn(),
  },
}));

jest.mock('../services/authService', () => ({
  authService: {
    login: jest.fn(),
    getStoredSession: jest.fn(),
    getProfile: jest.fn(),
    validateStoredSession: jest.fn(),
    logout: jest.fn(),
    onSessionEnded: jest.fn(() => () => {}),
  },
}));

jest.mock('../services/certificateService', () => ({
  certificateService: { verifyCertificate: jest.fn() },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const student: AuthUser = {
  id: 'usr_student_test_01',
  fullName: 'Test Student',
  email: 'student@example.test',
  role: UserRole.STUDENT,
  organizationId: 'org_test_01',
};

const getModules = releaseService.getReleaseModules as jest.Mock;

const renderNavigator = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider defaultMode="light">
        <StudentNavigator user={student} onLogout={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>
  );

describe('Student navigation wiring', () => {
  beforeEach(() => {
    clearDashboardCache();
    getModules.mockResolvedValue(null);
    (mediaFeedbackService.getStudentVideos as jest.Mock).mockClear();
  });

  test('My Class Applications opens MyApplicationsScreen from the student home', async () => {
    const r = await renderNavigator();
    const button = await r.findByTestId('shortcut-student-applications');
    expect(button.props.accessibilityRole).toBe('button');
    await act(async () => {
      fireEvent.press(button);
    });
    expect(await r.findByTestId('my-applications-screen')).toBeTruthy();
    expect(await r.findByTestId('empty-applications-state')).toBeTruthy();
  });

  test('Video Feedback opens VideoFeedbackScreen for the student record from the dashboard', async () => {
    getModules.mockResolvedValue({ release: 'R2', enabledModules: ['media', 'learning'] });
    const r = await renderNavigator();
    const button = await r.findByTestId('shortcut-student-video-feedback');
    await act(async () => {
      fireEvent.press(button);
    });
    expect(await r.findByTestId('video-feedback-screen')).toBeTruthy();
    expect(mediaFeedbackService.getStudentVideos).toHaveBeenCalledWith(STUDENT_RECORD_ID);
  });

  test('media and learning entries are hidden when the release excludes them', async () => {
    getModules.mockResolvedValue({ release: 'R1', enabledModules: [] });
    const r = await renderNavigator();
    expect(await r.findByTestId('shortcut-student-applications')).toBeTruthy();
    await waitFor(() => {
      expect(r.queryByTestId('shortcut-student-video-feedback')).toBeNull();
      expect(r.queryByTestId('shortcut-student-learning')).toBeNull();
      expect(r.queryByTestId('shortcut-student-progress')).toBeNull();
      expect(r.queryByTestId('tab-student-progress')).toBeNull();
    });
    // Core entries stay.
    expect(r.getByTestId('shortcut-student-attendance')).toBeTruthy();
    expect(r.getByTestId('tab-student-home')).toBeTruthy();
  });

  test('media and learning entries are shown when the release includes them', async () => {
    getModules.mockResolvedValue({ release: 'R2', enabledModules: ['media', 'learning'] });
    const r = await renderNavigator();
    expect(await r.findByTestId('shortcut-student-video-feedback')).toBeTruthy();
    expect(r.getByTestId('shortcut-student-learning')).toBeTruthy();
    expect(r.getByTestId('shortcut-student-progress')).toBeTruthy();
    expect(r.getByTestId('tab-student-progress')).toBeTruthy();
  });
});
