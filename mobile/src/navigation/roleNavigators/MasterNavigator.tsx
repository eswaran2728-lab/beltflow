import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Calendar, CheckSquare, Award, User } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RoleNavigationContainer } from '../RoleNavigationContainer';
import {
  MasterHomeScreen,
  ClassesScreen,
  CreateClassScreen,
  ClassProposalStatusScreen,
  StudentsScreen,
  AttendanceScreen,
  GradingScreen,
  MasterProfileScreen,
  MasterApplicationStatusScreen,
} from '../../screens/roles/master';
import {
  RoleNavigatorProps,
  MasterTabParamList,
  MasterClassesStackParamList,
} from '../types';

const Tab = createBottomTabNavigator<MasterTabParamList>();
const ClassesStack = createNativeStackNavigator<MasterClassesStackParamList>();

function MasterClassesStackNavigator(props: RoleNavigatorProps) {
  return (
    <ClassesStack.Navigator screenOptions={{ headerShown: false }}>
      <ClassesStack.Screen name="ClassesList">
        {navProps => <ClassesScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="Students">
        {navProps => <StudentsScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="CreateClass">
        {navProps => <CreateClassScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="ClassProposalStatus">
        {navProps => <ClassProposalStatusScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
    </ClassesStack.Navigator>
  );
}

export const MasterNavigator: React.FC<RoleNavigatorProps> = ({
  user,
  onLogout,
  isOffline,
}) => {
  const { colors, iconSize } = useTheme();

  // If master affiliation is not ACTIVE (e.g., PENDING, SUSPENDED, ENDED, UNVERIFIED),
  // gate operational screens and present MasterApplicationStatusScreen
  const isGated = Boolean(
    user.affiliationStatus &&
      ['PENDING', 'SUSPENDED', 'ENDED', 'UNVERIFIED', 'DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION'].includes(
        user.affiliationStatus
      )
  );

  if (isGated) {
    return (
      <RoleNavigationContainer user={user}>
        <MasterApplicationStatusScreen
          user={user}
          onLogout={onLogout}
          isOffline={isOffline}
        />
      </RoleNavigationContainer>
    );
  }

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
          tabBarButtonTestID: 'tab-master-home',
          tabBarIcon: ({ color }) => <Home size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <MasterHomeScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Classes"
        options={{
          tabBarLabel: 'Classes',
          tabBarAccessibilityLabel: 'Classes Tab',
          tabBarButtonTestID: 'tab-master-classes',
          tabBarIcon: ({ color }) => <Calendar size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <MasterClassesStackNavigator
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
          tabBarButtonTestID: 'tab-master-attendance',
          tabBarIcon: ({ color }) => <CheckSquare size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <AttendanceScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Grading"
        options={{
          tabBarLabel: 'Grading',
          tabBarAccessibilityLabel: 'Grading Tab',
          tabBarButtonTestID: 'tab-master-grading',
          tabBarIcon: ({ color }) => <Award size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <GradingScreen
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Profile Tab',
          tabBarButtonTestID: 'tab-master-profile',
          tabBarIcon: ({ color }) => <User size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <MasterProfileScreen
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
