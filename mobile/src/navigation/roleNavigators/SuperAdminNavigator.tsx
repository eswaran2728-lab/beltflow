import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Building2, ShieldCheck, User, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RoleNavigationContainer } from '../RoleNavigationContainer';
import { AssistantScreen } from '../../screens/shared/AssistantScreen';
import {
  SuperAdminHomeScreen,
  PersatuanManagementScreen,
  PlatformAuditScreen,
  SuperAdminProfileScreen,
} from '../../screens/roles/superAdmin';
import { RoleNavigatorProps, SuperAdminTabParamList } from '../types';

const Tab = createBottomTabNavigator<SuperAdminTabParamList>();

export const SuperAdminNavigator: React.FC<RoleNavigatorProps> = ({
  user,
  onLogout,
  isOffline,
}) => {
  const { colors, iconSize } = useTheme();

  return (
    <RoleNavigationContainer user={user}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.buttonPrimaryBg,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home Tab',
          tabBarButtonTestID: 'tab-sa-home',
          tabBarIcon: ({ color }) => <Home size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <SuperAdminHomeScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Persatuans"
        options={{
          tabBarLabel: 'Persatuans',
          tabBarAccessibilityLabel: 'Persatuan Management Tab',
          tabBarButtonTestID: 'tab-sa-persatuans',
          tabBarIcon: ({ color }) => <Building2 size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <PersatuanManagementScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Audit"
        options={{
          tabBarLabel: 'Audit',
          tabBarAccessibilityLabel: 'Platform Audit Tab',
          tabBarButtonTestID: 'tab-sa-audit',
          tabBarIcon: ({ color }) => <ShieldCheck size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <PlatformAuditScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Assistant"
        options={{
          tabBarLabel: 'Ask',
          tabBarAccessibilityLabel: 'BeltFlow Assistant Tab',
          tabBarButtonTestID: 'tab-sa-assistant',
          tabBarIcon: ({ color }) => <Sparkles size={iconSize.md} color={color} />,
        }}
      >
        {() => <AssistantScreen user={user} isOffline={isOffline} />}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Profile Tab',
          tabBarButtonTestID: 'tab-sa-profile',
          tabBarIcon: ({ color }) => <User size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <SuperAdminProfileScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
    </RoleNavigationContainer>
  );
};
