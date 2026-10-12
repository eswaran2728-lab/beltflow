/**
 * BeltFlow Mobile Navigation Route Types
 * Defines type-safe route hierarchies for all 5 authorized roles.
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN_PERSATUAN'
  | 'MASTER'
  | 'PARENT'
  | 'STUDENT';

export type RootStackParamList = {
  Auth: undefined;
  VerifyCert: { certCode?: string };
  SuperAdminRoot: undefined;
  AdminPersatuanRoot: undefined;
  MasterRoot: undefined;
  ParentRoot: undefined;
  StudentRoot: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  VerifyCert: { certCode?: string };
};

export type SuperAdminTabParamList = {
  Overview: undefined;
  Persatuans: undefined;
  AuditLogs: undefined;
};

export type AdminPersatuanTabParamList = {
  Dashboard: undefined;
  Students: undefined;
  Attendance: undefined;
  Billing: undefined;
  Settings: undefined;
};

export type MasterTabParamList = {
  Classes: undefined;
  MatAttendance: undefined;
  Students: undefined;
  Grading: undefined;
};

export type ParentTabParamList = {
  Children: undefined;
  Attendance: undefined;
  Fees: undefined;
  Certificates: undefined;
};

export type StudentTabParamList = {
  Profile: undefined;
  Syllabus: undefined;
  Attendance: undefined;
  Certificates: undefined;
};
