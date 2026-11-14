import { apiClient } from './apiClient';

export interface TrialBookingInput {
  organizationId: string;
  classId: string;
  scheduledDate: string;
  candidateName: string;
  candidateAge?: number;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  consentAccepted: boolean;
}

export interface TrialBooking {
  id: string;
  organization_id: string;
  class_id: string;
  scheduled_date: string;
  candidate_name: string;
  candidate_age?: number;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone: string;
  emergency_phone?: string;
  medical_notes?: string;
  consent_accepted: boolean;
  status: 'BOOKED' | 'ATTENDED' | 'MISSED' | 'CONVERTED' | 'CANCELLED';
  converted_student_id?: string;
  converted_at?: string;
  converted_by?: string;
  created_at: string;
}

export interface FollowUpItem {
  id: string;
  organization_id: string;
  class_id: string;
  student_id?: string;
  trial_id?: string;
  type: 'CONSECUTIVE_ABSENCE' | 'MISSED_TRIAL' | 'OVERDUE_TUITION' | 'INACTIVE_RISK';
  reason: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'CONTACTED' | 'RESOLVED' | 'DISMISSED';
  outcome?: string;
  notes?: string;
  student_name?: string;
  student_phone?: string;
  candidate_name?: string;
  guardian_phone?: string;
  class_name?: string;
  created_at: string;
  updated_at: string;
}

export const trialsService = {
  async bookTrial(input: TrialBookingInput): Promise<TrialBooking> {
    const res = await apiClient.post<{ message: string; trial: TrialBooking }>('/trials/book', input);
    return res.trial;
  },

  async getClassTrials(classId: string): Promise<TrialBooking[]> {
    const res = await apiClient.get<{ trials: TrialBooking[] }>(`/trials/class/${classId}`);
    return res.trials || [];
  },

  async markTrialAttendance(trialId: string, status: 'ATTENDED' | 'MISSED' | 'CANCELLED'): Promise<TrialBooking> {
    const res = await apiClient.post<{ message: string; trial: TrialBooking }>(`/trials/${trialId}/attendance`, { status });
    return res.trial;
  },

  async convertTrial(trialId: string, beltRank?: string): Promise<{ student: any; trial: TrialBooking }> {
    const res = await apiClient.post<{ message: string; student: any; trial: TrialBooking }>(`/trials/${trialId}/convert`, {
      beltRank: beltRank || 'White Belt',
    });
    return { student: res.student, trial: res.trial };
  },

  async evaluateFollowUpRules(classId: string): Promise<void> {
    await apiClient.post(`/trials/follow-ups/evaluate/${classId}`, {});
  },

  async getClassFollowUps(classId: string): Promise<FollowUpItem[]> {
    const res = await apiClient.get<{ items: FollowUpItem[] }>(`/trials/follow-ups/class/${classId}`);
    return res.items || [];
  },

  async recordFollowUpAction(followUpId: string, outcome: string, notes?: string): Promise<FollowUpItem> {
    const res = await apiClient.post<{ message: string; item: FollowUpItem }>(`/trials/follow-ups/${followUpId}/action`, {
      outcome,
      notes,
    });
    return res.item;
  },
};
