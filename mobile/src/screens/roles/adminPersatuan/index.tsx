import React from 'react';
import { Home, MapPin, Users, BarChart3, User } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';

interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const AdminPersatuanHomeScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Persatuan Dashboard"
      subtitle="Academy Operations Overview"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-home-screen"
      icon={<Home size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Persatuan Scope: Manage academy branches, coaches, and student enrollment. Fee structures are controlled by Masters."
    />
  );
};

export const LocationsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Locations"
      subtitle="Dojos & Training Centres"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-locations-screen"
      icon={<MapPin size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Facility Scope: Active training dojos, venue schedules, and regional branch coordination."
    />
  );
};

export const MastersScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Masters"
      subtitle="Academy Coaches & Instructors"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-masters-screen"
      icon={<Users size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Coaching Scope: Certified Silambam masters, class assignments, and coach credentials."
    />
  );
};

export const ReportsScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Reports"
      subtitle="Academy Metrics & Attendance Analytics"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-reports-screen"
      icon={<BarChart3 size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Reporting Scope: Aggregate academy attendance, belt progression rate, and student retention analytics."
    />
  );
};

export const AdminPersatuanProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Persatuan Administrator Profile"
      role={UserRole.ADMIN_PERSATUAN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="admin-persatuan-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Identity Scope: Persatuan organization administrator account settings, session details, and logout."
    />
  );
};
