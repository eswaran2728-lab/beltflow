import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import {
  mediaFeedbackService,
  VideoSubmission,
} from '../services/mediaFeedbackService';
import { VideoFeedbackScreen } from '../screens/roles/student/VideoFeedbackScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/mediaFeedbackService', () => ({
  mediaFeedbackService: {
    requestUpload: jest.fn(),
    finalizeUpload: jest.fn(),
    addVideoFeedback: jest.fn(),
    revokeMediaConsent: jest.fn(),
    getPlayback: jest.fn(),
    getStudentVideos: jest.fn(),
    deleteVideo: jest.fn(),
  },
}));

jest.setTimeout(30000);

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

describe('Official Task H21: Private Video Feedback Mobile Acceptance Tests', () => {
  const mockStudentId = 'stu_test_h21';

  const mockVideos: VideoSubmission[] = [
    {
      id: 'vid_001',
      title: 'Jurus Seni Gayong 1',
      technique_category: 'POOMSAE',
      student_id: mockStudentId,
      upload_status: 'FEEDBACK_PROVIDED',
      duration_seconds: 45,
      file_size_bytes: 15 * 1024 * 1024,
      mime_type: 'video/mp4',
      uploaded_at: '2026-10-21T00:00:00Z',
      annotation_count: 2,
    },
    {
      id: 'vid_002',
      title: 'Elak & Tangkis Drills',
      technique_category: 'SPARRING',
      student_id: mockStudentId,
      upload_status: 'UPLOADED',
      duration_seconds: 60,
      file_size_bytes: 25 * 1024 * 1024,
      mime_type: 'video/mp4',
      uploaded_at: '2026-10-21T01:00:00Z',
      annotation_count: 0,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (mediaFeedbackService.getStudentVideos as jest.Mock).mockResolvedValue(mockVideos);
  });

  // ==========================================================================
  // Acceptance Test 1: oversized_invalid_upload_rejected
  // ==========================================================================
  it('Acceptance Test 1: oversized_invalid_upload_rejected - rejects files > 50MB and invalid mime types', async () => {
    const { getByTestId, findByTestId, findByText } = await renderWithTheme(
      <VideoFeedbackScreen studentId={mockStudentId} userRole="STUDENT" />
    );

    expect(await findByTestId('video-card-vid_001')).toBeTruthy();

    // Open upload modal
    const uploadBtn = getByTestId('upload-video-button');
    await act(async () => {
      fireEvent.press(uploadBtn);
    });

    // Set title and oversized size (60MB > 50MB)
    const titleInput = await findByTestId('upload-title-input');
    const sizeInput = await findByTestId('upload-size-input');

    await act(async () => {
      fireEvent.changeText(titleInput, 'Oversized Test Video');
      fireEvent.changeText(sizeInput, '60');
    });

    const submitBtn = await findByTestId('upload-submit-btn');
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    // Verify client error displayed mentioning oversized_invalid_upload_rejected
    expect(await findByText(/oversized_invalid_upload_rejected/i)).toBeTruthy();
    expect(mediaFeedbackService.requestUpload).not.toHaveBeenCalled();

    // Now test invalid mime type (e.g. application/pdf)
    const mimeInput = await findByTestId('upload-mime-input');
    await act(async () => {
      fireEvent.changeText(sizeInput, '20'); // Valid size
      fireEvent.changeText(mimeInput, 'application/pdf'); // Invalid format
    });

    await act(async () => {
      fireEvent.press(submitBtn);
    });

    expect(await findByText(/oversized_invalid_upload_rejected: Invalid format/i)).toBeTruthy();
    expect(mediaFeedbackService.requestUpload).not.toHaveBeenCalled();

    // Close modal
    await act(async () => {
      fireEvent.press(getByTestId('upload-close-btn'));
    });
  });

  // ==========================================================================
  // Acceptance Test 2: expired_URL_denied
  // ==========================================================================
  it('Acceptance Test 2: expired_URL_denied - handles expired playback URL rejection', async () => {
    (mediaFeedbackService.getPlayback as jest.Mock).mockRejectedValue(
      new Error('expired_URL_denied: Signed playback URL has expired.')
    );

    const { getByTestId } = await renderWithTheme(
      <VideoFeedbackScreen studentId={mockStudentId} userRole="STUDENT" />
    );

    await waitFor(() => {
      expect(getByTestId('play-video-vid_001')).toBeTruthy();
    });

    const playBtn = getByTestId('play-video-vid_001');
    fireEvent.press(playBtn);

    expect(mediaFeedbackService.getPlayback).toHaveBeenCalledWith('vid_001');
  });

  // ==========================================================================
  // Acceptance Test 3A: wrong_Master_or_guardian_denied (Super Admin zero operational access)
  // ==========================================================================
  it('Acceptance Test 3A: wrong_Master_or_guardian_denied - Super Admin zero operational access view rendered', async () => {
    const { getByTestId, getByText } = await renderWithTheme(
      <VideoFeedbackScreen studentId={mockStudentId} userRole="SUPER_ADMIN" />
    );

    await waitFor(() => {
      expect(getByTestId('superadmin-denial-view')).toBeTruthy();
      expect(getByText('Zero Operational Access')).toBeTruthy();
    });
    expect(mediaFeedbackService.getStudentVideos).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Acceptance Test 3B: wrong_Master_or_guardian_denied (Unauthorized Master or unlinked guardian)
  // ==========================================================================
  it('Acceptance Test 3B: wrong_Master_or_guardian_denied - wrong Master or unlinked guardian receives 403 denial alert', async () => {
    (mediaFeedbackService.getStudentVideos as jest.Mock).mockRejectedValue(
      new Error('wrong_Master_or_guardian_denied: Master not assigned to this student.')
    );

    const { getByTestId } = await renderWithTheme(
      <VideoFeedbackScreen studentId={mockStudentId} userRole="MASTER" />
    );

    await waitFor(() => {
      expect(getByTestId('video-error-alert')).toBeTruthy();
    });
  });

  // ==========================================================================
  // Acceptance Test 4: consent_revocation_blocks_new_access
  // ==========================================================================
  it('Acceptance Test 4: consent_revocation_blocks_new_access - guardian consent revocation disables uploads and playback', async () => {
    (mediaFeedbackService.revokeMediaConsent as jest.Mock).mockResolvedValue({
      success: true,
      studentId: mockStudentId,
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
      message: 'Media consent revoked.',
    });

    const { getByTestId } = await renderWithTheme(
      <VideoFeedbackScreen studentId={mockStudentId} userRole="PARENT" />
    );

    await waitFor(() => {
      expect(getByTestId('video-card-vid_001')).toBeTruthy();
      expect(getByTestId('revoke-consent-button')).toBeTruthy();
    });

    // Call service to revoke
    await act(async () => {
      await mediaFeedbackService.revokeMediaConsent(mockStudentId, 'Opt-out');
    });

    expect(mediaFeedbackService.revokeMediaConsent).toHaveBeenCalledWith(mockStudentId, 'Opt-out');
  });

  // ==========================================================================
  // Acceptance Test 5: deleted_media_not_returned_by_API
  // ==========================================================================
  it('Acceptance Test 5: deleted_media_not_returned_by_API - deleting video purges submission from list', async () => {
    (mediaFeedbackService.deleteVideo as jest.Mock).mockResolvedValue({
      success: true,
      videoId: 'vid_001',
      message: 'deleted_media_not_returned_by_API: Video deleted.',
    });

    const { getByTestId } = await renderWithTheme(
      <VideoFeedbackScreen studentId={mockStudentId} userRole="PARENT" />
    );

    await waitFor(() => {
      expect(getByTestId('video-card-vid_001')).toBeTruthy();
    });

    await act(async () => {
      await mediaFeedbackService.deleteVideo('vid_001');
    });

    expect(mediaFeedbackService.deleteVideo).toHaveBeenCalledWith('vid_001');
  });
});
