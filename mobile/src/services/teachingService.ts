import { apiClient } from './apiClient';

export interface LessonDrill {
  id?: string;
  name: string;
  duration_minutes?: number;
  instructions?: string;
  key_focus?: string;
}

export interface LessonPlanInput {
  title: string;
  objectives?: string;
  drills?: LessonDrill[];
  equipment?: string[];
  coveredMaterial?: string;
  privateMasterNotes?: string;
  expectedVersion?: number;
}

export interface LessonPlan {
  id: string;
  sessionId: string;
  classId: string;
  authorMasterId?: string;
  authorName?: string;
  title: string;
  objectives?: string;
  drills: LessonDrill[];
  equipment: string[];
  coveredMaterial?: string;
  privateMasterNotes?: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubstituteBrief {
  isSubstituteBrief: boolean;
  session: {
    id: string;
    classId: string;
    className: string;
    groupName?: string;
    sessionDate: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    location: string;
    status: string;
  };
  lessonPlan: {
    id: string;
    sessionId: string;
    classId: string;
    title: string;
    objectives?: string;
    drills: LessonDrill[];
    equipment: string[];
    coveredMaterial?: string;
    version: number;
    authorName?: string;
  } | null;
  studentSafetyBrief: {
    student_id: string;
    student_name: string;
    belt_rank: string;
    medical_conditions?: string;
    allergies?: string;
    emergency_contact_phone?: string;
  }[];
  confidentialityNotice: string;
}

export const teachingService = {
  async saveLessonPlan(sessionId: string, input: LessonPlanInput): Promise<{ message: string; lessonPlan: LessonPlan }> {
    return await apiClient.put(`/teaching/sessions/${sessionId}/lesson-plan`, input);
  },

  async getLessonPlan(sessionId: string): Promise<{ session: any; lessonPlan: LessonPlan | null }> {
    return await apiClient.get(`/teaching/sessions/${sessionId}/lesson-plan`);
  },

  async getSubstituteBrief(sessionId: string): Promise<SubstituteBrief> {
    return await apiClient.get<SubstituteBrief>(`/teaching/sessions/${sessionId}/substitute-brief`);
  },
};
