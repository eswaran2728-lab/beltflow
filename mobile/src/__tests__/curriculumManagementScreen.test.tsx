import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { UserRole, AuthUser } from '../types/auth';
import { apiClient } from '../services/apiClient';
import { CurriculumManagementScreen } from '../screens/roles/adminPersatuan/CurriculumManagementScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

const mockSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderWithTheme = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider initialMetrics={mockSafeAreaMetrics}>
      <ThemeProvider defaultMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

describe('H09: Persatuan-Configurable Belt Curriculum (Tenant-Owned Versioning)', () => {
  const adminUser: AuthUser = {
    id: 'usr_admin_selangor',
    fullName: 'Persatuan Admin',
    email: 'admin@silambamselangor.my',
    role: UserRole.ADMIN_PERSATUAN,
    organizationId: 'org_selangor',
    affiliationStatus: 'ACTIVE',
  };

  const mockActiveCurriculum = {
    organizationId: 'org_selangor',
    curriculum: {
      id: 'curr_v1',
      organization_id: 'org_selangor',
      system_name: 'Official Selangor Silambam Syllabus',
      martial_art_style: 'Silambam',
      version: 1,
      status: 'PUBLISHED',
      published_at: '2026-01-15T00:00:00.000Z',
      created_at: '2026-01-15T00:00:00.000Z',
      updated_at: '2026-01-15T00:00:00.000Z',
    },
    ranks: [
      { id: 'r1', name: 'White Belt', order: 1, colorHex: '#FFFFFF', minMonthsRequired: 0, minSessionsRequired: 0, gradingFee: 0 },
      { id: 'r2', name: 'Yellow Belt', order: 2, colorHex: '#FACC15', minMonthsRequired: 3, minSessionsRequired: 24, gradingFee: 50 },
      { id: 'r3', name: 'Green Belt', order: 3, colorHex: '#22C55E', minMonthsRequired: 6, minSessionsRequired: 48, gradingFee: 60 },
      { id: 'r4', name: 'Black Belt', order: 4, colorHex: '#0F172A', minMonthsRequired: 24, minSessionsRequired: 192, gradingFee: 200, isDanRank: true, danLevel: 1 },
    ],
  };

  const mockVersionsList = {
    organizationId: 'org_selangor',
    curriculums: [
      mockActiveCurriculum.curriculum,
      {
        id: 'curr_v2_draft',
        organization_id: 'org_selangor',
        system_name: '2026 Advanced Silambam Syllabus (Draft)',
        martial_art_style: 'Silambam',
        version: 2,
        status: 'DRAFT',
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
    ],
  };

  const mockDraftDetail = {
    curriculum: mockVersionsList.curriculums[1],
    ranks: [
      { id: 'd1', name: 'Vellai (White)', order: 1, colorHex: '#FFFFFF', minMonthsRequired: 0, minSessionsRequired: 0, gradingFee: 0 },
      { id: 'd2', name: 'Karuppu (Black Asan)', order: 2, colorHex: '#0F172A', minMonthsRequired: 24, minSessionsRequired: 192, gradingFee: 250, isDanRank: true, danLevel: 1 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/curriculums/active')) {
        return Promise.resolve(mockActiveCurriculum);
      }
      if (url.includes('/curriculums/curr_v2_draft')) {
        return Promise.resolve(mockDraftDetail);
      }
      if (url.includes('/curriculums/curr_v1')) {
        return Promise.resolve({
          curriculum: mockActiveCurriculum.curriculum,
          ranks: mockActiveCurriculum.ranks,
        });
      }
      if (url.includes('/curriculums')) {
        return Promise.resolve(mockVersionsList);
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    (apiClient.post as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/publish')) {
        return Promise.resolve({
          message: 'Published',
          curriculum: { ...mockDraftDetail.curriculum, status: 'PUBLISHED' },
          ranks: mockDraftDetail.ranks,
        });
      }
      if (url === '/api/v1/curriculums') {
        return Promise.resolve({
          message: 'Created',
          curriculum: {
            id: 'curr_v3_draft',
            organization_id: 'org_selangor',
            system_name: 'Curriculum Syllabus v3',
            martial_art_style: 'Silambam',
            version: 3,
            status: 'DRAFT',
            created_at: '2026-03-01T00:00:00.000Z',
            updated_at: '2026-03-01T00:00:00.000Z',
          },
          ranks: mockActiveCurriculum.ranks,
        });
      }
      return Promise.reject(new Error(`Unhandled POST URL: ${url}`));
    });

    (apiClient.delete as jest.Mock).mockResolvedValue({ message: 'Deleted', deletedId: 'curr_v2_draft' });
  });

  test('Test 1: Renders official active curriculum with published status and belt ranks', async () => {
    const { getByTestId, getAllByText, getByText } = await renderWithTheme(
      <CurriculumManagementScreen user={adminUser} />
    );

    await waitFor(() => {
      expect(getByTestId('badge-active-curriculum')).toBeTruthy();
      expect(getAllByText('Official Selangor Silambam Syllabus').length).toBeGreaterThanOrEqual(1);
      expect(getByText('White Belt')).toBeTruthy();
      expect(getByText('Black Belt')).toBeTruthy();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/curriculums/active?organizationId=org_selangor');
  });

  test('Test 2: Lists curriculum versions and switches to DRAFT version view', async () => {
    const { getByTestId, getByText } = await renderWithTheme(
      <CurriculumManagementScreen user={adminUser} />
    );

    await waitFor(() => {
      expect(getByTestId('curriculum-version-item-1')).toBeTruthy();
      expect(getByTestId('curriculum-version-item-2')).toBeTruthy();
    });

    // Tap on Draft version v2
    await act(async () => {
      fireEvent.press(getByTestId('curriculum-version-item-2'));
    });

    await waitFor(() => {
      expect(getByTestId('btn-publish-curriculum')).toBeTruthy();
      expect(getByTestId('btn-delete-draft')).toBeTruthy();
      expect(getByText('2026 Advanced Silambam Syllabus (Draft)')).toBeTruthy();
    });
  });

  test('Test 3: Publish button triggers atomic publish endpoint for DRAFT version', async () => {
    const { getByTestId } = await renderWithTheme(
      <CurriculumManagementScreen user={adminUser} />
    );

    await waitFor(() => {
      expect(getByTestId('curriculum-version-item-2')).toBeTruthy();
    });

    // Switch to draft
    await act(async () => {
      fireEvent.press(getByTestId('curriculum-version-item-2'));
    });

    await waitFor(() => {
      expect(getByTestId('btn-publish-curriculum')).toBeTruthy();
    });

    // In React Native Jest environment, Alert.alert is mocked
    const alertSpy = jest.spyOn(Alert, 'alert');

    await act(async () => {
      fireEvent.press(getByTestId('btn-publish-curriculum'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Publish Syllabus Version',
      expect.stringContaining('Publishing version v2'),
      expect.any(Array)
    );

    // Trigger the positive confirmation callback
    const buttons = alertSpy.mock.calls[0][2] as any[];
    const publishCallback = buttons[1].onPress;
    await act(async () => {
      await publishCallback();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/curriculums/curr_v2_draft/publish');
  });

  test('Test 4: Create new draft button invokes POST /api/v1/curriculums', async () => {
    const { getByTestId } = await renderWithTheme(
      <CurriculumManagementScreen user={adminUser} />
    );

    await waitFor(() => {
      expect(getByTestId('btn-create-draft')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId('btn-create-draft'));
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/curriculums',
        expect.objectContaining({
          systemName: 'Curriculum Syllabus v3',
          martialArtStyle: 'Silambam',
          cloneFromVersionId: 'curr_v1',
        })
      );
    });
  });

  test('Test 5: Offline mode disables mutating actions', async () => {
    const { getByTestId } = await renderWithTheme(
      <CurriculumManagementScreen user={adminUser} isOffline={true} />
    );

    await waitFor(() => {
      const createBtn = getByTestId('btn-create-draft');
      expect(createBtn.props.accessibilityState.disabled).toBe(true);
    });
  });
});
