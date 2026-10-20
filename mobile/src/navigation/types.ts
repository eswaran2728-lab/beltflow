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
  Profile: undefined;
};

export type AdminPersatuanTabParamList = {
  Home: undefined;
  Locations: undefined;
  Masters: undefined;
  Reports: undefined;
  Profile: undefined;
  AcademySetup?: undefined;
};

export type MasterClassesStackParamList = {
  ClassesList: undefined;
  Students: { classId?: string } | undefined;
  CreateClass: undefined;
  ClassProposalStatus: undefined;
  ClassEnrollmentInbox: { classId: string; className?: string };
  ClassWorkspace: { classId: string; className?: string };
  TrialsFollowUp: { classId?: string } | undefined;
  MakeUpWaitlist: { sessionId?: string; classId?: string } | undefined;
  TransfersManagement: { classId?: string } | undefined;
};

export type MasterTabParamList = {
  Home: undefined;
  Classes: undefined;
  Attendance: undefined;
  Grading: undefined;
  Profile: undefined;
};

export type ParentTabParamList = {
  Home: undefined;
  Children: undefined;
  Fees: undefined;
  Notices: undefined;
  Profile: undefined;
};

export type StudentTabParamList = {
  Home: undefined;
  Progress: undefined;
  Attendance: undefined;
  Certificates: undefined;
  Profile: undefined;
};
