/**
 * The Student Progress tab must ask the learning API about the student
 * RECORD (students.id), not the login account (users.id). The server looks
 * up students by id and checks students.user_id === the caller
 * (server/src/routes/learning.routes.ts), so passing the user id makes
 * performance and achievements fail for every real student.
 * Synthetic data only.
 */
import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { learningService } from '../services/learningService';
import { ProgressScreen } from '../screens/roles/student';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  apiPath: (p: string) => p,
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/learningService', () => {
  const actual = jest.requireActual('../services/learningService');
  return {
    ...actual,
    learningService: {
      ...actual.learningService,
      getLessons: jest.fn().mockResolvedValue([]),
      getStudentPerformance: jest.fn().mockResolvedValue(null),
      getStudentAchievements: jest.fn().mockResolvedValue([]),
    },
  };
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const student: AuthUser = { id: 'usr_student_test', fullName: 'Test Student', email: 's@example.test', role: UserRole.STUDENT, organizationId: 'org_test' };

test('Progress tab loads learning data for the student record id, not the user id', async () => {
  (apiClient.get as jest.Mock).mockImplementation((path: string) =>
    path === '/api/v1/students/me' ? Promise.resolve({ student: { id: 'stu_record_test', user_id: 'usr_student_test' } }) : Promise.resolve({})
  );
  const r = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider defaultMode="light">
        <ProgressScreen user={student} onLogout={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/students/me'));
  await waitFor(() => expect(r.getByTestId('learning-hub-title')).toBeTruthy());
  await act(async () => { fireEvent.press(r.getByTestId('tab-learning-performance')); });
  await waitFor(() => expect(learningService.getStudentPerformance).toHaveBeenCalled());
  expect((learningService.getStudentPerformance as jest.Mock).mock.calls[0][0]).toBe('stu_record_test');
  await act(async () => { await r.unmount(); });
});

test('Progress tab shows an error instead of the library when the student record cannot be found', async () => {
  (apiClient.get as jest.Mock).mockImplementation(() => Promise.reject(new Error('Student profile not found.')));
  const r = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider defaultMode="light">
        <ProgressScreen user={student} onLogout={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(r.getByTestId('student-progress-error')).toBeTruthy());
  expect(r.queryByTestId('learning-hub-title')).toBeNull();
  await act(async () => { await r.unmount(); });
});
