import { apiClient } from './apiClient';

export interface VideoAnnotation {
  id: string;
  timestamp_seconds: number;
  annotation_text: string;
  technique_rating?: number | null;
  created_at: string;
  master_name?: string;
}

export interface VideoSubmission {
  id: string;
  title: string;
  technique_category: string;
  student_id: string;
  upload_status: 'PENDING_UPLOAD' | 'UPLOADED' | 'IN_REVIEW' | 'FEEDBACK_PROVIDED' | 'DELETED';
  duration_seconds: number;
  file_size_bytes: number;
  mime_type: string;
  uploaded_at?: string;
  annotation_count?: number;
}

export interface RequestUploadInput {
  studentId: string;
  title: string;
  fileSize: number;
  mimeType: string;
  techniqueCategory?: string;
  curriculumId?: string;
  lessonId?: string;
  durationSeconds?: number;
}

export interface RequestUploadResult {
  id: string;
  videoId: string;
  storageKey: string;
  presignedToken: string;
  tokenExpiresAt: string;
  uploadUrl: string;
  maxSizeBytes: number;
}

export interface VideoPlaybackResult {
  id: string;
  title: string;
  techniqueCategory: string;
  studentId: string;
  uploadStatus: string;
  durationSeconds: number;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt?: string;
  playbackUrl: string;
  expiresAt: string;
  annotations: VideoAnnotation[];
}

export interface AddVideoFeedbackInput {
  timestampSeconds?: number;
  annotationText: string;
  techniqueRating?: number;
}

export const mediaFeedbackService = {
  /**
   * Request signed upload URL for student video feedback.
   * Enforces 50MB limit, allowed video mime-types, and active media consent.
   */
  async requestUpload(input: RequestUploadInput): Promise<RequestUploadResult> {
    return apiClient.post<RequestUploadResult>('/media/upload-request', input);
  },

  /**
   * Finalize video upload after file transfer to cloud storage.
   * Rejects expired URLs (>900s).
   */
  async finalizeUpload(videoId: string, token: string): Promise<{ success: boolean; status: string; message: string }> {
    return apiClient.post(`/media/videos/${videoId}/finalize`, { token });
  },

  /**
   * Add timestamped instructor critique and technique rating.
   * Restricted to assigned lead or delegated Master for the student.
   */
  async addVideoFeedback(videoId: string, input: AddVideoFeedbackInput): Promise<{
    success: boolean;
    annotationId: string;
    videoId: string;
    timestampSeconds: number;
    annotationText: string;
    techniqueRating?: number;
    status: string;
  }> {
    return apiClient.post(`/media/videos/${videoId}/feedback`, input);
  },

  /**
   * Guardian revokes media analysis consent for their student.
   * Blocks subsequent uploads and playback access.
   */
  async revokeMediaConsent(studentId: string, reason?: string): Promise<{
    success: boolean;
    studentId: string;
    status: string;
    revokedAt: string;
    message: string;
  }> {
    return apiClient.post(`/media/consents/${studentId}/revoke`, { reason });
  },

  /**
   * Fetch temporary short-lived playback URL and timestamped critique annotations.
   */
  async getPlayback(videoId: string, token?: string): Promise<VideoPlaybackResult> {
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return apiClient.get<VideoPlaybackResult>(`/media/videos/${videoId}/playback${query}`);
  },

  /**
   * List all non-deleted video submissions for a student.
   */
  async getStudentVideos(studentId: string): Promise<VideoSubmission[]> {
    return apiClient.get<VideoSubmission[]>(`/media/students/${studentId}/videos`);
  },

  /**
   * Soft-delete video submission. Purges from future API queries.
   */
  async deleteVideo(videoId: string): Promise<{ success: boolean; videoId: string; message: string }> {
    return apiClient.delete(`/media/videos/${videoId}`);
  },
};
