// BeltFlow v2 domain types — map to the multi-tenant Supabase schema.

export type UserRole = 'admin' | 'coach' | 'parent' | 'student';
export type ProfileStatus = 'pending' | 'approved' | 'rejected';
export type Language = 'en' | 'ms' | 'ta';

export type Lifecycle = 'trial' | 'active' | 'frozen' | 'quit';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type InvoiceStatus = 'unpaid' | 'pending_approval' | 'paid' | 'waived' | 'overdue';
export type PaymentMethod = 'cash' | 'fpx' | 'transfer';
export type GradingResultType = 'registered' | 'pass' | 'fail' | 'absent';
export type SkillLevel = 'not_started' | 'learning' | 'good' | 'mastered';
export type Medal = 'gold' | 'silver' | 'bronze' | 'participation';
export type Relationship = 'father' | 'mother' | 'guardian';
export type NoteVisibility = 'staff' | 'parent_visible';
export type CertType = 'grading' | 'tournament' | 'participation' | 'achievement';

export interface Academy {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  monthlyFeeDefault: number;
}

export interface Belt {
  id: string;
  name: string;
  colorHex: string;
  sortOrder: number;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
}

export interface ClassRow {
  id: string;
  branchId: string | null;
  name: string;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  scheduleNote: string;
  monthlyFeeOverride: number | null;
  coachIds: string[];
  coachNames: string[];
}

export interface Student {
  id: string;
  profileId: string | null;
  fullName: string;
  icOrMykid: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string;
  beltId: string | null;
  beltName: string;
  lifecycle: Lifecycle;
  joinedAt: string;
  photoUrl?: string;
  medicalNotes: string;
  classIds: string[];
  classNames: string[];
}

export interface Guardian {
  parentProfileId: string;
  parentName: string;
  parentPhone: string;
  studentId: string;
  relationship: Relationship;
  isPrimaryPayer: boolean;
}

export interface ClassSession {
  id: string;
  classId: string;
  sessionDate: string;
  cancelled: boolean;
}

export interface AttendanceRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  sessionDate: string;
  classId: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  billingMonth: string;
  amount: number;
  discount: number;
  discountReason: string;
  status: InvoiceStatus;
  net: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  amount: number;
  submittedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  receiptNo: string | null;
  proofUrl: string | null;
}

export interface GradingEvent {
  id: string;
  name: string;
  eventDate: string;
  location: string;
  examiner: string;
  fee: number;
}

export interface GradingResult {
  id: string;
  gradingEventId: string;
  studentId: string;
  studentName: string;
  fromBeltId: string | null;
  toBeltId: string | null;
  fromBeltName: string;
  toBeltName: string;
  result: GradingResultType;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  sortOrder: number;
}

export interface StudentSkill {
  studentId: string;
  skillId: string;
  level: SkillLevel;
}

export interface Tournament {
  id: string;
  name: string;
  eventDate: string;
  location: string;
}

export interface TournamentResult {
  id: string;
  tournamentId: string;
  studentId: string;
  studentName: string;
  eventCategory: string;
  medal: Medal | null;
  points: number;
}

export interface StudentNote {
  id: string;
  studentId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  visibility: NoteVisibility;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Certificate {
  id: string;
  studentId: string;
  type: CertType;
  title: string;
  certNo: string;
  verifyCode: string;
  issuedAt: string;
  pdfUrl: string | null;
}

// ---- helpers ----
export const SKILL_LEVELS: SkillLevel[] = ['not_started', 'learning', 'good', 'mastered'];
export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  not_started: 'Not Started', learning: 'Learning', good: 'Good', mastered: 'Mastered',
};
export const SKILL_LEVEL_PCT: Record<SkillLevel, number> = {
  not_started: 0, learning: 33, good: 66, mastered: 100,
};
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  trial: 'Trial', active: 'Active', frozen: 'Frozen', quit: 'Quit',
};
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused',
};
export const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  unpaid: 'Unpaid', pending_approval: 'Pending Approval', paid: 'Paid', waived: 'Waived', overdue: 'Overdue',
};
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function firstOfMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthLabel(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}
