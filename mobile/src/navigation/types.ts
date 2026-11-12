import { AuthUser, RoleType } from '../types/auth';

/**
 * BeltFlow Mobile Navigation Route Types
 * Defines type-safe route hierarchies for all 5 authorized roles.
 */

export type UserRole = RoleType;

export interface RoleNavigatorProps {
  user: AuthUser;
  onLogout: () => void;
  isOffline?: boolean;
}

export type RootStackParamList = {
  Auth: undefined;
  VerifyCert: { certCode?: string };
  SuperAdminRoot: undefined;
  AdminPersatuanRoot: undefined;
  MasterRoot: undefined;
  ParentRoot: undefined;
  StudentRoot: undefined;
  Unauthorized: undefined;
};

export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  VerifyCert: { certCode?: string };
};

export type SuperAdminTabParamList = {
  Home: undefined;
  Persatuans: undefined;
  Audit: undefined;
  Assistant: undefined;
  Profile: undefined;
};

export type AdminPersatuanTabParamList = {
  Home: undefined;
  Locations: undefined;
  Masters: undefined;
  Reports: undefined;
  Assistant: undefined;
  Profile: undefined;
  AcademySetup?: undefined;
};

// Admin Persatuan Home tab: dashboard plus the screens its buttons open.
export type AdminPersatuanHomeStackParamList = {
  Dashboard: undefined;
  ClassApprovals: undefined;
  HandoverApprovals: undefined;
  AdminGrading: undefined;
  Curriculum: undefined;
  Finance: undefined;
};

export type MasterClassesStackParamList = {
  ClassesList: undefined;
  Students: { classId?: string } | undefined;
  CreateClass: undefined;
  ClassProposalStatus: undefined;
  ClassEnrollmentInbox: { classId: string; className?: string };
  ClassWorkspace: { classId: string; className?: string };
  ClassHandover: { classId: string; className?: string };
  TrialsFollowUp: { classId?: string } | undefined;
  MakeUpWaitlist: { sessionId?: string; classId?: string } | undefined;
  TransfersManagement: { classId?: string } | undefined;
  ParentMasterMessaging: { threadId?: string; classId?: string; childId?: string } | undefined;
  IncomingHandovers: undefined;
};

export type MasterTabParamList = {
  Home: undefined;
  Classes: undefined;
  Attendance: undefined;
  Grading: undefined;
  Assistant: undefined;
  Profile: undefined;
};

export type ParentTabParamList = {
  Home: undefined;
  Children: undefined;
  Fees: undefined;
  Notices: undefined;
  Assistant: undefined;
  Profile: undefined;
};

// Parent Home tab: dashboard plus messaging and the family timeline.
export type ParentHomeStackParamList = {
  Dashboard: undefined;
  Messaging: { studentId?: string; classId?: string } | undefined;
  FamilyTimeline: undefined;
};

// Parent Children tab: list of children plus per-child journeys.
export type ParentChildrenStackParamList = {
  ChildrenList: undefined;
  StudentLifecycle: { studentId: string; studentName?: string; targetClassId?: string };
  MakeUpBooking: { studentId: string; studentName?: string; targetSessionId?: string };
  AvailableClasses: undefined;
  BookTrial: { targetClassId: string; targetClassName?: string; targetOrganizationId?: string };
  MyApplications: undefined;
};

// Student Home tab: dashboard plus applications and video feedback.
export type StudentHomeStackParamList = {
  Dashboard: undefined;
  MyApplications: undefined;
  // studentId is the student record id (students.id) from the dashboard, not the user id.
  VideoFeedback: { studentId: string; studentName?: string };
};

export type StudentTabParamList = {
  Home: undefined;
  Progress: undefined;
  Attendance: undefined;
  Certificates: undefined;
  Assistant: undefined;
  Profile: undefined;
};
