import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Award, CheckSquare, FileText, User, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { RoleNavigationContainer } from '../RoleNavigationContainer';
import { AssistantScreen } from '../../screens/shared/AssistantScreen';
import { useReleaseModules } from '../../hooks/useReleaseModules';
import { useI18n } from '../../i18n';
import {
  StudentHomeScreen,
  ProgressScreen,
  StudentAttendanceScreen,
  CertificatesScreen,
  StudentProfileScreen,
  MyApplicationsScreen,
} from '../../screens/roles/student';
import { VideoFeedbackScreen } from '../../screens/roles/student/VideoFeedbackScreen';
import { RoleNavigatorProps, StudentHomeStackParamList, StudentTabParamList } from '../types';

const Tab = createBottomTabNavigator<StudentTabParamList>();
const HomeStack = createNativeStackNavigator<StudentHomeStackParamList>();

/** Home tab: the dashboard plus the screens its quick actions open. */
function StudentHomeStackNavigator(props: RoleNavigatorProps) {
  const { t } = useI18n();
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard">
        {navProps => <StudentHomeScreen {...props} {...navProps} />}
      </HomeStack.Screen>
      <HomeStack.Screen name="MyApplications">
        {navProps => <MyApplicationsScreen user={props.user} {...navProps} />}
      </HomeStack.Screen>
      {/* VideoFeedbackScreen has no back control of its own, so this one shows the stack header. */}
      <HomeStack.Screen
        name="VideoFeedback"
        options={{ headerShown: true, title: t('studentHome.videoFeedbackTitle') }}
      >
        {({ route }) => (
          <VideoFeedbackScreen
            studentId={route.params.studentId}
            studentName={route.params.studentName}
            userRole="STUDENT"
            isOffline={props.isOffline}
          />
        )}
      </HomeStack.Screen>
    </HomeStack.Navigator>
  );
}

export const StudentNavigator: React.FC<RoleNavigatorProps> = ({
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
          tabBarButtonTestID: 'tab-student-home',
          tabBarIcon: ({ color }) => <Home size={iconSize.md} color={color} />,
        }}
      >
        {() => (
          <StudentHomeStackNavigator
            user={user}
            onLogout={onLogout}
            isOffline={isOffline}
          />
        )}
      </Tab.Screen>

      {release.isEnabled('learning') && (
        <Tab.Screen
          name="Progress"
          options={{
            tabBarLabel: t('tabs.progress'),
            tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.progress') }),
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
      )}

      <Tab.Screen
        name="Attendance"
        options={{
          tabBarLabel: t('tabs.attendance'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.attendance') }),
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
          tabBarLabel: t('tabs.certificates'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.certificates') }),
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
            tabBarLabel: t('tabs.ask'),
            tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.assistant') }),
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
          tabBarLabel: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.a11y', { label: t('tabs.profile') }),
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
