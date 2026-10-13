import React from 'react';
import { Home, Building2, ShieldCheck, User } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { RolePlaceholderBase } from '../RolePlaceholderBase';
import { AuthUser, UserRole } from '../../../types/auth';

interface RoleScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const SuperAdminHomeScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Super Admin Home"
      subtitle="Platform System Overview"
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="super-admin-home-screen"
      icon={<Home size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Platform Scope: Super Admin maintains platform governance and tenant provisioning. Zero access to academy operational records."
    />
  );
};

export const PersatuanManagementScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Persatuan Management"
      subtitle="Federation & Organization Registry"
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="persatuan-management-screen"
      icon={<Building2 size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Tenant Governance: Review registered Silambam Persatuans, manage active status, and configure multi-tenant dojos."
    />
  );
};

export const PlatformAuditScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Platform Audit"
      subtitle="System Security & Event Logs"
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="platform-audit-screen"
      icon={<ShieldCheck size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Audit Scope: Security compliance records, privileged access audits, and tamper-resistant system event logs."
    />
  );
};

export const SuperAdminProfileScreen: React.FC<RoleScreenProps> = props => {
  const { colors, iconSize } = useTheme();
  return (
    <RolePlaceholderBase
      title="Profile"
      subtitle="Super Administrator Identity"
      role={UserRole.SUPER_ADMIN}
      user={props.user}
      onLogout={props.onLogout}
      isOffline={props.isOffline}
      testID="super-admin-profile-screen"
      icon={<User size={iconSize.lg} color={colors.buttonPrimaryBg} />}
      scopeDescription="Credential Scope: System administration profile, security settings, and session termination."
    />
  );
};
