import React from 'react';
import { Home, Calendar, Users, CheckSquare, Award, User, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { Button } from '../../../components/Button';
import { AuthUser, UserRole } from '../../../types/auth';

interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const MasterHomeScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Master Home"
      subtitle="Today's Sessions & Coaching Dashboard"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-home-screen"
      icon={<Home size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Dojo Scope: Access strictly scoped to assigned Silambam classes, registered students, and grading evaluations."
    />
  );
};

export const ClassesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();

  return (
    <RolePlaceholderBase
      title="Assigned Classes"
      subtitle="Training Timetable & Class Roster"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-classes-screen"
      icon={<Calendar size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Class Scope: Inspect syllabus schedules, assigned cohorts, and class-specific student registrations."
      actionButtons={
        <Button
          label="View Class Students"
          onPress={() => props.navigation?.navigate('Students')}
          variant="secondary"
          size="md"
          fullWidth
          rightIcon={<ArrowRight size={iconSize.md} color={colors.buttonSecondaryText} />}
          testID="btn-view-class-students"
          accessibilityLabel="View Class Students via nested stack"
        />
      }
    />
  );
};

export const StudentsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Class Students"
      subtitle="Enrolled Silambam Students"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-students-screen"
      icon={<Users size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Student Scope: Student belt progression history, contact emergency numbers, and individual grading eligibility."
    />
  );
};

export const AttendanceScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Attendance"
      subtitle="Mat Session Marking & Verification"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-attendance-screen"
      icon={<CheckSquare size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Attendance Scope: Session roll call, QR attendance scans, and persistent mat attendance records."
    />
  );
};

export const GradingScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Grading"
      subtitle="Belt Promotion & Form Evaluations"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-grading-screen"
      icon={<Award size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Grading Authority: Conduct belt examinations according to the active Persatuan's configurable belt progression."
    />
  );
};

export const MasterProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Master Instructor Profile"
      role={UserRole.MASTER}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="master-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Coach Identity: Master qualifications, Dan rank certifications, affiliated dojos, and session sign out."
    />
  );
};
