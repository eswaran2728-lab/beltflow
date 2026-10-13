import React from 'react';
import { Home, Users, DollarSign, Bell, User } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';

interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const ParentHomeScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Parent Home"
      subtitle="Family Overview & Academy Schedule"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-home-screen"
      icon={<Home size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Family Scope: Access strictly restricted to approved linked children. No access to other students or academy administration."
    />
  );
};

export const ChildrenScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Children"
      subtitle="Approved Linked Students"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-children-screen"
      icon={<Users size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Linked Students: Monitor children's training attendance streaks, syllabus milestones, and grading eligibility."
    />
  );
};

export const FeesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Fees"
      subtitle="Monthly Tuition & Grading Invoices"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-fees-screen"
      icon={<DollarSign size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Billing Scope: View official academy tuition invoices, examination fees, and digital payment receipts."
    />
  );
};

export const NoticesScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Notices"
      subtitle="Academy Announcements & Grading Dates"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-notices-screen"
      icon={<Bell size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Notice Board: Academy holiday notifications, tournament invitations, and federation announcements."
    />
  );
};

export const ParentProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Parent & Guardian Identity"
      role={UserRole.PARENT}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="parent-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Guardian Scope: Contact information, emergency notification preferences, linked students, and sign out."
    />
  );
};
