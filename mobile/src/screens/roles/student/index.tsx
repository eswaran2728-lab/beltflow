import React from 'react';
import { Home, Award, CheckSquare, FileText, User } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';

interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const StudentHomeScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Student Home"
      subtitle="My Training Journey & Syllabus"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-home-screen"
      icon={<Home size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Student Scope: Access restricted strictly to personal syllabus forms, personal attendance, and verified certificates."
    />
  );
};

export const ProgressScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Progress"
      subtitle="Silambam Syllabus & Belt Requirements"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-progress-screen"
      icon={<Award size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Syllabus Scope: Martial arts lesson progress, footwork drills, staff strikes, and grading exam readiness."
    />
  );
};

export const StudentAttendanceScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Attendance"
      subtitle="Training Log & Session Attendance"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-attendance-screen"
      icon={<CheckSquare size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Attendance Log: View confirmed practice mat attendance, monthly check-in history, and training streaks."
    />
  );
};

export const CertificatesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Certificates"
      subtitle="Official Grading Credentials"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-certificates-screen"
      icon={<FileText size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Credentials: Digitally signed Persatuan grading certificates, rank verifications, and official QR verification codes."
    />
  );
};

export const StudentProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Student Martial Artist Profile"
      role={UserRole.STUDENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="student-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Personal Identity: Student identification number, affiliated Persatuan academy, dojo location, and sign out."
    />
  );
};
