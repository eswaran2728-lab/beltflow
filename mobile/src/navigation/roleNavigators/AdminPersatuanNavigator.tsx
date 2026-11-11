import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MapPin, Users, BarChart3, User, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RoleNavigationContainer } from '../RoleNavigationContainer';
import { AssistantScreen } from '../../screens/shared/AssistantScreen';
import { useReleaseModules } from '../../hooks/useReleaseModules';
import { useI18n } from '../../i18n';
import {
  AdminPersatuanHomeScreen,
  LocationsScreen,
  MastersScreen,
  ReportsScreen,
  AdminPersatuanProfileScreen,
  AdminAcademySetupScreen,
} from '../../screens/roles/adminPersatuan';
import { RoleNavigatorProps, AdminPersatuanTabParamList } from '../types';

const Tab = createBottomTabNavigator<AdminPersatuanTabParamList>();

export const AdminPersatuanNavigator: React.FC<RoleNavigatorProps> = ({
  user,
  onLogout,
  isOffline,
}) => {
  const { colors, iconSize } = useTheme();
  const release = useReleaseModules();
  const { t } = useI18n();

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
          tabBarLabel: t('tabs.home'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.home') }),
          tabBarButtonTestID: 'tab-ap-home',
          tabBarIcon: ({ color }) => <Home size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <AdminPersatuanHomeScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Locations"
        options={{
          tabBarLabel: t('tabs.locations'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.locations') }),
          tabBarButtonTestID: 'tab-ap-locations',
          tabBarIcon: ({ color }) => <MapPin size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <LocationsScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Masters"
        options={{
          tabBarLabel: t('tabs.masters'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.masters') }),
          tabBarButtonTestID: 'tab-ap-masters',
          tabBarIcon: ({ color }) => <Users size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <MastersScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Reports"
        options={{
          tabBarLabel: t('tabs.reports'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.reports') }),
          tabBarButtonTestID: 'tab-ap-reports',
          tabBarIcon: ({ color }) => <BarChart3 size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <ReportsScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      {release.isEnabled('assistant') && (
        <Tab.Screen
          name="Assistant"
          options={{
            tabBarLabel: t('tabs.ask'),
            tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.assistant') }),
            tabBarButtonTestID: 'tab-ap-assistant',
            tabBarIcon: ({ color }) => <Sparkles size={iconSize.md} color={color} />,
          }}
        >
          {() => <AssistantScreen user={user} isOffline={isOffline} />}
        </Tab.Screen>
      )}

      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.profile') }),
          tabBarButtonTestID: 'tab-ap-profile',
          tabBarIcon: ({ color }) => <User size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <AdminPersatuanProfileScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="AcademySetup"
        options={{
          tabBarItemStyle: { display: 'none' },
          tabBarButton: () => null,
        }}
      >
        {() => (
          <AdminAcademySetupScreen
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
