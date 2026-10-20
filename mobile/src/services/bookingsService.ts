import { apiClient } from './apiClient';

export interface MakeUpRequestInput {
  studentId: string;
  targetSessionId: string;
  reason?: string;
}

export interface MakeUpBooking {
  id: string;
  organization_id: string;
  student_id: string;
  original_class_id: string;
  target_session_id: string;
  target_class_id: string;
  status: 'REQUESTED' | 'WAITLISTED' | 'OFFERED' | 'CONFIRMED' | 'ATTENDED' | 'CANCELLED' | 'EXPIRED';
  waitlist_position?: number;
  offered_at?: string;
  offer_expires_at?: string;
  confirmed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  session_attendance_id?: string;
  version: number;
  created_at: string;
  updated_at: string;
  student_name?: string;
  belt_rank?: string;
  original_class_name?: string;
  target_class_name?: string;
  session_date?: string;
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
}

export interface SessionBookingsResponse {
  session: {
    id: string;
    organization_id: string;
    class_id: string;
    class_name: string;
    capacity: number;
    training_level: string;
    session_date: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    location: string;
    status: string;
  };
  capacity: {
    maxCapacity: number;
    confirmedMakeUps: number;
    availableMakeUpPlaces: number;
  };
  confirmedCount: number;
  waitlistCount: number;
  bookings: MakeUpBooking[];
}

export const bookingsService = {
  async requestMakeUp(input: MakeUpRequestInput): Promise<MakeUpBooking> {
    const res = await apiClient.post<{ message: string; booking: MakeUpBooking }>('/bookings/make-up/request', input);
    return res.booking;
  },

  async approveMakeUp(bookingId: string, version: number): Promise<MakeUpBooking> {
    const res = await apiClient.post<{ message: string; booking: MakeUpBooking }>(`/bookings/make-up/${bookingId}/approve`, {
      version,
    });
    return res.booking;
  },

  async cancelMakeUp(bookingId: string, reason?: string): Promise<MakeUpBooking> {
    const res = await apiClient.post<{ message: string; booking: MakeUpBooking }>(`/bookings/make-up/${bookingId}/cancel`, {
      reason,
    });
    return res.booking;
  },

  async promoteWaitlist(sessionId: string): Promise<{ message: string; promotedCount: number; promotedBooking?: MakeUpBooking }> {
    return await apiClient.post(`/bookings/waitlist/promote/${sessionId}`, {});
  },

  async acceptOffer(bookingId: string): Promise<MakeUpBooking> {
    const res = await apiClient.post<{ message: string; booking: MakeUpBooking }>(`/bookings/make-up/${bookingId}/accept`, {});
    return res.booking;
  },

  async getSessionBookings(sessionId: string): Promise<SessionBookingsResponse> {
    return await apiClient.get<SessionBookingsResponse>(`/bookings/sessions/${sessionId}`);
  },

  async getStudentMakeUps(studentId: string): Promise<MakeUpBooking[]> {
    const res = await apiClient.get<{ bookings: MakeUpBooking[] }>(`/bookings/student/${studentId}`);
    return res.bookings || [];
  },
};
