import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Award, CheckSquare, FileText, User, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RoleNavigationContainer } from '../RoleNavigationContainer';
import { AssistantScreen } from '../../screens/shared/AssistantScreen';
import { useReleaseModules } from '../../hooks/useReleaseModules';
import {
  StudentHomeScreen,
  ProgressScreen,
  StudentAttendanceScreen,
  CertificatesScreen,
  StudentProfileScreen,
} from '../../screens/roles/student';
import { RoleNavigatorProps, StudentTabParamList } from '../types';

const Tab = createBottomTabNavigator<StudentTabParamList>();

export const StudentNavigator: React.FC<RoleNavigatorProps> = ({
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
          tabBarButtonTestID: 'tab-student-home',
          tabBarIcon: ({ color }) => <Home size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <StudentHomeScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Progress"
        options={{
          tabBarLabel: 'Progress',
          tabBarAccessibilityLabel: 'Progress Tab',
          tabBarButtonTestID: 'tab-student-progress',
          tabBarIcon: ({ color }) => <Award size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <ProgressScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Attendance"
        options={{
          tabBarLabel: 'Attendance',
          tabBarAccessibilityLabel: 'Attendance Tab',
          tabBarButtonTestID: 'tab-student-attendance',
          tabBarIcon: ({ color }) => <CheckSquare size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <StudentAttendanceScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Certificates"
        options={{
          tabBarLabel: 'Certificates',
          tabBarAccessibilityLabel: 'Certificates Tab',
          tabBarButtonTestID: 'tab-student-certificates',
          tabBarIcon: ({ color }) => <FileText size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <CertificatesScreen
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
            tabBarButtonTestID: 'tab-student-assistant',
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
          tabBarButtonTestID: 'tab-student-profile',
          tabBarIcon: ({ color }) => <User size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <StudentProfileScreen
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
