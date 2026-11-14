import { apiClient } from './apiClient';

export interface MessageThread {
  id: string;
  organization_id: string;
  class_id: string;
  class_name?: string;
  student_id: string;
  student_name?: string;
  parent_id: string;
  parent_name?: string;
  assigned_master_id: string;
  master_name?: string;
  subject: string;
  status: string;
  last_message_at: string;
  last_message_content?: string;
  unread_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name?: string;
  sender_role: string;
  client_message_id?: string;
  content: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_mime?: string;
  attachment_size_bytes?: number;
  delivery_status: 'SENT' | 'DELIVERED' | 'READ';
  read_at?: string;
  is_reported?: boolean;
  created_at: string;
}

export interface CreateThreadInput {
  childId: string;
  classId: string;
  subject?: string;
  masterId?: string;
}

export interface SendMessageInput {
  content: string;
  clientMessageId?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
  attachmentSizeBytes?: number;
}

export interface ThreadWithMessages {
  thread: MessageThread;
  messages: ThreadMessage[];
}

export const messagingService = {
  /**
   * List all authorized message threads for the current authenticated user
   */
  async listThreads(): Promise<MessageThread[]> {
    return apiClient.get<MessageThread[]>('/messaging/threads');
  },

  /**
   * Get thread details and full message history
   */
  async getThreadMessages(threadId: string): Promise<ThreadWithMessages> {
    return apiClient.get<ThreadWithMessages>(`/messaging/threads/${threadId}/messages`);
  },

  /**
   * Create a new communication thread between parent and master for an enrolled child
   * Acceptance criterion: cross_class_thread_denied
   */
  async createThread(input: CreateThreadInput): Promise<MessageThread> {
    return apiClient.post<MessageThread>('/messaging/threads', input);
  },

  /**
   * Send a message within a thread
   * Acceptance criteria: former_master_cannot_send, message_retry_once,
   *                      blocked_attachment_rejected, lock_screen_content_minimized
   */
  async sendMessage(threadId: string, input: SendMessageInput): Promise<ThreadMessage> {
    return apiClient.post<ThreadMessage>(`/messaging/threads/${threadId}/messages`, input);
  },

  /**
   * Report an inappropriate message to Admin Persatuan for review
   */
  async reportMessage(messageId: string, reason?: string): Promise<{ success: boolean; reportId: string }> {
    return apiClient.post<{ success: boolean; reportId: string }>(`/messaging/messages/${messageId}/report`, {
      reason: reason || 'Inappropriate content',
    });
  },

  /**
   * Generate an idempotent client message ID for retry safety
   */
  generateClientMessageId(): string {
    return `cl_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  },
};
