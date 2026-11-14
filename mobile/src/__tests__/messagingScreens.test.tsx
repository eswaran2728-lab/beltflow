import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import {
  messagingService,
  MessageThread,
  ThreadMessage,
} from '../services/messagingService';
import { ParentMasterMessagingScreen } from '../screens/roles/parent/ParentMasterMessagingScreen';

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  onUnauthorizedResponse: jest.fn(() => () => {}),
}));

jest.mock('../services/messagingService', () => ({
  messagingService: {
    listThreads: jest.fn(),
    getThreadMessages: jest.fn(),
    createThread: jest.fn(),
    sendMessage: jest.fn(),
    reportMessage: jest.fn(),
    generateClientMessageId: jest.fn(() => 'mock_client_msg_id_123'),
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

describe('Official Task H22: Parent-Master Messaging Mobile Acceptance Tests', () => {
  const mockThreads: MessageThread[] = [
    {
      id: 'thr_001',
      organization_id: 'org_test',
      class_id: 'cls_001',
      class_name: 'Silat Gayong Kids',
      student_id: 'stu_001',
      student_name: 'Danial bin Ahmad',
      parent_id: 'usr_par_001',
      parent_name: 'Ahmad Razlan',
      assigned_master_id: 'usr_mst_001',
      master_name: 'Master Halim',
      subject: 'Belt Grading Prep',
      status: 'ACTIVE',
      last_message_at: new Date().toISOString(),
      last_message_content: 'Danial performed very well today.',
      unread_count: 1,
    },
  ];

  const mockMessages: ThreadMessage[] = [
    {
      id: 'msg_001',
      thread_id: 'thr_001',
      sender_id: 'usr_mst_001',
      sender_role: 'MASTER',
      content: 'Danial performed very well today.',
      delivery_status: 'READ',
      created_at: new Date().toISOString(),
    },
    {
      id: 'msg_002',
      thread_id: 'thr_001',
      sender_id: 'usr_par_001',
      sender_role: 'PARENT',
      content: 'Thank you Master, he is practicing diligently at home.',
      delivery_status: 'DELIVERED',
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (messagingService.listThreads as jest.Mock).mockResolvedValue(mockThreads);
    (messagingService.getThreadMessages as jest.Mock).mockResolvedValue({
      thread: mockThreads[0],
      messages: mockMessages,
    });
  });

  it('1. Renders ParentMasterMessagingScreen with lock-screen privacy minimization banner', async () => {
    const { getByTestId, getByText, getAllByText } = await renderWithTheme(
      <ParentMasterMessagingScreen userRole="PARENT" studentId="stu_001" />
    );

    await waitFor(() => {
      expect(getByTestId('parent-master-messaging-screen')).toBeTruthy();
      expect(getByTestId('lock-screen-privacy-banner')).toBeTruthy();
      expect(getByText(/Lock-screen notifications are privacy-minimized for child safety/)).toBeTruthy();
      expect(getByText('Belt Grading Prep')).toBeTruthy();
      expect(getAllByText('Danial performed very well today.').length).toBeGreaterThan(0);
    });
  });

  it('2. Sends a message with idempotent client_message_id (message_retry_once)', async () => {
    (messagingService.sendMessage as jest.Mock).mockResolvedValue({
      id: 'msg_003',
      thread_id: 'thr_001',
      sender_id: 'usr_par_001',
      sender_role: 'PARENT',
      content: 'Will sparring gear be needed tomorrow?',
      client_message_id: 'mock_client_msg_id_123',
      delivery_status: 'SENT',
      created_at: new Date().toISOString(),
    });

    const { findByTestId } = await renderWithTheme(
      <ParentMasterMessagingScreen userRole="PARENT" studentId="stu_001" />
    );

    const input = await findByTestId('input-message-content');
    await act(async () => {
      fireEvent.changeText(input, 'Will sparring gear be needed tomorrow?');
    });

    const sendBtn = await findByTestId('btn-send-message');
    await act(async () => {
      fireEvent.press(sendBtn);
    });

    await waitFor(() => {
      expect(messagingService.sendMessage).toHaveBeenCalledWith('thr_001', {
        content: 'Will sparring gear be needed tomorrow?',
        clientMessageId: 'mock_client_msg_id_123',
        attachmentName: undefined,
        attachmentSizeBytes: undefined,
      });
    });
  });

  it('3. Rejects blocked executable and script attachments (blocked_attachment_rejected)', async () => {
    const { findByTestId, getByText } = await renderWithTheme(
      <ParentMasterMessagingScreen userRole="PARENT" studentId="stu_001" />
    );

    const openAttachBtn = await findByTestId('btn-open-attach');
    await act(async () => {
      fireEvent.press(openAttachBtn);
    });

    const nameInput = await findByTestId('input-attachment-name');
    await act(async () => {
      fireEvent.changeText(nameInput, 'malicious_code.exe');
    });

    const confirmBtn = await findByTestId('btn-confirm-attach');
    await act(async () => {
      fireEvent.press(confirmBtn);
    });

    await waitFor(() => {
      expect(findByTestId('attachment-error-message')).toBeTruthy();
      expect(getByText(/blocked_attachment_rejected/)).toBeTruthy();
    });
  });

  it('4. Reports inappropriate message to Admin Persatuan (reportMessage)', async () => {
    (messagingService.reportMessage as jest.Mock).mockResolvedValue({
      success: true,
      reportId: 'rep_001',
    });

    const { findByTestId } = await renderWithTheme(
      <ParentMasterMessagingScreen userRole="PARENT" studentId="stu_001" />
    );

    const reportBtn = await findByTestId('btn-report-msg_001');
    await act(async () => {
      fireEvent.press(reportBtn);
    });

    await waitFor(() => {
      expect(messagingService.reportMessage).toHaveBeenCalledWith('msg_001', 'Inappropriate communication content');
    });
  });

  it('5. Denies Super Admin operational access to private messaging threads', async () => {
    const { findByTestId, getAllByText } = await renderWithTheme(
      <ParentMasterMessagingScreen userRole="SUPER_ADMIN" studentId="stu_001" />
    );

    expect(await findByTestId('superadmin-denial-view')).toBeTruthy();
    expect(await findByTestId('messaging-error-banner')).toBeTruthy();
    expect(getAllByText(/Super Admin has zero operational access to private messaging threads/).length).toBeGreaterThan(0);
  });

  it('6. Enforces minor student communication policy (no direct student threads)', async () => {
    const { findByTestId, getAllByText } = await renderWithTheme(
      <ParentMasterMessagingScreen userRole="STUDENT" studentId="stu_001" />
    );

    expect(await findByTestId('student-denial-view')).toBeTruthy();
    expect(await findByTestId('messaging-error-banner')).toBeTruthy();
    expect(getAllByText(/Minor communication policy: Direct student-initiated threads are prohibited/).length).toBeGreaterThan(0);
  });
});
