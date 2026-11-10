import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, DollarSign, Bell, User, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RoleNavigationContainer } from '../RoleNavigationContainer';
import { AssistantScreen } from '../../screens/shared/AssistantScreen';
import { useReleaseModules } from '../../hooks/useReleaseModules';
import {
  ParentHomeScreen,
  ChildrenScreen,
  FeesScreen,
  NoticesScreen,
  ParentProfileScreen,
} from '../../screens/roles/parent';
import { RoleNavigatorProps, ParentTabParamList } from '../types';

const Tab = createBottomTabNavigator<ParentTabParamList>();

export const ParentNavigator: React.FC<RoleNavigatorProps> = ({
  user,
  onLogout,
  isOffline,
}) => {
  const { colors, iconSize } = useTheme();
  const release = useReleaseModules();

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
          tabBarButtonTestID: 'tab-parent-home',
          tabBarIcon: ({ color }) => <Home size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <ParentHomeScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Children"
        options={{
          tabBarLabel: 'Children',
          tabBarAccessibilityLabel: 'Children Tab',
          tabBarButtonTestID: 'tab-parent-children',
          tabBarIcon: ({ color }) => <Users size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <ChildrenScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Fees"
        options={{
          tabBarLabel: 'Fees',
          tabBarAccessibilityLabel: 'Fees Tab',
          tabBarButtonTestID: 'tab-parent-fees',
          tabBarIcon: ({ color }) => <DollarSign size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <FeesScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Notices"
        options={{
          tabBarLabel: 'Notices',
          tabBarAccessibilityLabel: 'Notices Tab',
          tabBarButtonTestID: 'tab-parent-notices',
          tabBarIcon: ({ color }) => <Bell size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <NoticesScreen
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
            tabBarLabel: 'Ask',
            tabBarAccessibilityLabel: 'BeltFlow Assistant Tab',
            tabBarButtonTestID: 'tab-parent-assistant',
            tabBarIcon: ({ color }) => <Sparkles size={iconSize.md} color={color} />,
          }}
        >
          {() => <AssistantScreen user={user} isOffline={isOffline} />}
        </Tab.Screen>
      )}

      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Profile Tab',
          tabBarButtonTestID: 'tab-parent-profile',
          tabBarIcon: ({ color }) => <User size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <ParentProfileScreen
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
