import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Calendar, CheckSquare, Award, User, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RoleNavigationContainer } from '../RoleNavigationContainer';
import { AssistantScreen } from '../../screens/shared/AssistantScreen';
import { useReleaseModules } from '../../hooks/useReleaseModules';
import { useI18n } from '../../i18n';
import {
  MasterHomeScreen,
  ClassesScreen,
  CreateClassScreen,
  ClassProposalStatusScreen,
  ClassEnrollmentInboxScreen,
  ClassWorkspaceScreen,
  StudentsScreen,
  AttendanceScreen,
  GradingScreen,
  MasterProfileScreen,
  MasterApplicationStatusScreen,
  MasterTrialsFollowUpScreen,
  MasterMakeUpManagementScreen,
  MasterTransferManagementScreen,
  ParentMasterMessagingScreen,
  ClassHandoverScreen,
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
      <ClassesStack.Screen name="ClassWorkspace">
        {navProps => <ClassWorkspaceScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="ClassHandover">
        {navProps => <ClassHandoverScreen {...props} {...navProps} />}
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
      <ClassesStack.Screen name="ClassEnrollmentInbox">
        {navProps => <ClassEnrollmentInboxScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="TrialsFollowUp">
        {navProps => <MasterTrialsFollowUpScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="MakeUpWaitlist">
        {navProps => <MasterMakeUpManagementScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="TransfersManagement">
        {navProps => <MasterTransferManagementScreen {...props} {...navProps} />}
      </ClassesStack.Screen>
      <ClassesStack.Screen name="ParentMasterMessaging">
        {navProps => <ParentMasterMessagingScreen {...props} {...navProps} />}
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
  const release = useReleaseModules();
  const { t } = useI18n();

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
          tabBarLabel: t('tabs.home'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.home') }),
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
          tabBarLabel: t('tabs.classes'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.classes') }),
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
          tabBarLabel: t('tabs.attendance'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.attendance') }),
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
          tabBarLabel: t('tabs.grading'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.grading') }),
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

      {release.isEnabled('assistant') && (
        <Tab.Screen
          name="Assistant"
          options={{
            tabBarLabel: t('tabs.ask'),
            tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.assistant') }),
            tabBarButtonTestID: 'tab-master-assistant',
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
