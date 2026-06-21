// BeltFlow Types — maps directly to Supabase tables (see supabase-schema.sql)

export type UserRole = 'admin' | 'coach' | 'parent' | 'student';

export type BeltRank =
  | 'White' | 'Yellow' | 'Orange' | 'Green' | 'Blue' | 'Purple' | 'Brown' | 'Red' | 'Black';

export type StudentStatus = 'Active' | 'Inactive' | 'At Risk';

export type PaymentStatus = 'Paid' | 'Unpaid' | 'Overdue' | 'Pending Cash Approval' | 'Rejected';

export type PaymentMethod = 'FPX' | 'Cash';

export type SubscriptionStatus = 'Trial' | 'Active' | 'Past Due' | 'Suspended' | 'Cancelled';

export type SubscriptionPlan = 'Free Trial' | 'Starter' | 'Academy' | 'Association';

export type SkillProgress = 'Not Started' | 'Learning' | 'Good' | 'Mastered';

export type GradingResultType = 'Pass' | 'Fail' | 'Pending';

export type TournamentStatus = 'Draft' | 'Open Registration' | 'Registration Closed' | 'Completed' | 'Cancelled';

export type RegistrationStatus = 'Registered' | 'Confirmed' | 'Withdrawn' | 'Completed';

export type MedalResult = 'Gold' | 'Silver' | 'Bronze' | 'Participation' | 'No Medal';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  academyId: string;
  avatar?: string;
}

export interface Academy {
  id: string;
  name: string;
  description: string;
  martialArtStyle: string;
  logoUrl?: string;
  phone: string;
  email: string;
  address: string;
  subscriptionId: string;
}

export interface Branch {
  id: string;
  academyId: string;
  name: string;
  address: string;
  phone: string;
}

export interface Class {
  id: string;
  branchId: string;
  name: string;
  schedule: string;
  coachId: string;
  beltLevels: BeltRank[];
}

export interface Student {
  id: string;
  academyId: string;
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
  missedClasses: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
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
  academyId: string;
  title: string;
  date: string;
  location: string;
  examiner: string;
  students: string[];
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
  coachId: string;
  coachName: string;
  note: string;
  date: string;
  isPrivate: boolean;
}

export interface Subscription {
  id: string;
  academyId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  trialEndDate?: string;
  monthlyAmount: number;
  studentLimit: number;
  features: string[];
}

export interface Invoice {
  id: string;
  academyId: string;
  subscriptionId: string;
  amount: number;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  dueDate: string;
  paidDate?: string;
  period: string;
  invoiceNumber: string;
}

// Tournament Types
export interface Tournament {
  id: string;
  academyId: string;
  name: string;
  organizer: string;
  venue: string;
  date: string;
  registrationDeadline: string;
  status: TournamentStatus;
  notes?: string;
  coachIds: string[];
  categories: string[];
}

export interface TournamentCategory {
  id: string;
  tournamentId: string;
  name: string;
  ageGroup: string;
  description?: string;
  maxParticipants?: number;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  studentId: string;
  studentName: string;
  ageGroup: string;
  category: string;
  branch: string;
  coachId: string;
  coachName: string;
  status: RegistrationStatus;
  remarks?: string;
}

export interface TournamentResult {
  id: string;
  registrationId: string;
  tournamentId: string;
  studentId: string;
  studentName: string;
  category: string;
  medal: MedalResult;
  points: number;
  position?: number;
  notes?: string;
}

export interface AthleteAchievement {
  id: string;
  studentId: string;
  tournamentId: string;
  tournamentName: string;
  category: string;
  medal: MedalResult;
  date: string;
  points: number;
  badge?: string;
}

export interface AcademySettings {
  id: string;
  academyId: string;
  monthlyFee: number;
  beltLevels: BeltRank[];
  martialArtStyle: string;
  branches: Branch[];
  classes: Class[];
  skills: Skill[];
}
