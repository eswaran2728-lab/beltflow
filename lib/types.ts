// BeltFlow Types — map directly to Supabase tables (snake_case in DB, camelCase here)

export type UserRole = 'admin' | 'coach' | 'parent' | 'student';

export type BeltRank =
  | 'White' | 'Yellow' | 'Orange' | 'Green' | 'Blue' | 'Purple' | 'Brown' | 'Red' | 'Black';

export type StudentStatus = 'Active' | 'Inactive' | 'At Risk';

export type PaymentStatus = 'Paid' | 'Unpaid' | 'Overdue' | 'Pending Cash Approval' | 'Rejected';

export type PaymentMethod = 'FPX' | 'Cash';

export type SkillProgress = 'Not Started' | 'Learning' | 'Good' | 'Mastered';

export type GradingResultType = 'Pass' | 'Fail' | 'Pending';

export type TournamentStatus = 'Draft' | 'Open Registration' | 'Registration Closed' | 'Completed' | 'Cancelled';

export type RegistrationStatus = 'Registered' | 'Confirmed' | 'Withdrawn' | 'Completed';

export type MedalResult = 'Gold' | 'Silver' | 'Bronze' | 'Participation' | 'No Medal';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
}

export interface Class {
  id: string;
  branchId: string | null;
  name: string;
  schedule: string;
  coachId: string | null;
}

export interface Student {
  id: string;
  fullName: string;
  age: number;
  icNumber: string;
  parentName: string;
  parentPhone: string;
  emergencyContact?: string;
  beltRank: BeltRank;
  joinDate: string;
  status: StudentStatus;
  branch: string;
  classGroup: string;
  classId: string | null;
  missedClasses: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string | null;
  date: string;
  present: boolean;
  notes?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  month: string;
  status: PaymentStatus;
  method: PaymentMethod;
  paidDate?: string;
  receiptNumber?: string;
  approvedBy?: string;
  notes?: string;
}

export interface GradingEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  examiner: string;
  studentIds: string[];
  status: 'Upcoming' | 'Completed';
}

export interface GradingRecord {
  id: string;
  eventId: string;
  studentId: string;
  studentName: string;
  currentBelt: BeltRank;
  targetBelt: BeltRank;
  result: GradingResultType;
  examiner: string;
  date: string;
  notes?: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
  order: number;
}

export interface StudentSkill {
  id: string;
  studentId: string;
  skillId: string;
  skillName: string;
  progress: SkillProgress;
  updatedAt: string;
  notes?: string;
}

export interface InstructorNote {
  id: string;
  studentId: string;
  coachId: string | null;
  coachName: string;
  note: string;
  date: string;
  isPrivate: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  organizer: string;
  venue: string;
  date: string;
  registrationDeadline: string;
  status: TournamentStatus;
  notes?: string;
  categories: string[];
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  studentId: string;
  studentName: string;
  ageGroup: string;
  category: string;
  branch: string;
  coachName: string;
  status: RegistrationStatus;
  remarks?: string;
}

export interface TournamentResult {
  id: string;
  tournamentId: string;
  studentId: string;
  studentName: string;
  category: string;
  medal: MedalResult;
  points: number;
  position?: number;
  notes?: string;
}

export interface AcademySettings {
  id: string;
  name: string;
  description: string;
  martialArtStyle: string;
  phone: string;
  email: string;
  address: string;
  monthlyFee: number;
}

export const BELT_LEVELS: BeltRank[] = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'];

/** e.g. "July 2026" — the label used for monthly payments */
export function monthLabel(d: Date = new Date()): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
