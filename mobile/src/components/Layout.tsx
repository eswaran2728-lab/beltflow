import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  RefreshControlProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

// ----------------------------------------------------------------------------
// 1. ScreenContainer Component
// ----------------------------------------------------------------------------
export interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = false,
  padded = true,
  refreshControl,
  style,
  testID,
}) => {
  const { colors, layout } = useTheme();

  const containerPadding = padded ? layout.screenPadding : 0;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]} testID={testID}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {scrollable ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: containerPadding },
              style,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.flexContent,
              { paddingHorizontal: containerPadding },
              style,
            ]}
          >
            {children}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

// ----------------------------------------------------------------------------
// 2. SectionHeader Component
// ----------------------------------------------------------------------------
export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
  testID,
}) => {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.sectionHeaderRow, style]} testID={testID}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          disabled={!onAction}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '700' }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 3. ScreenHeader Component
// ----------------------------------------------------------------------------
export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  style,
  testID,
}) => {
  const { colors, typography, iconSize, layout } = useTheme();

  return (
    <View
      style={[
        styles.screenHeaderContainer,
        {
          minHeight: layout.headerHeight,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          backgroundColor: colors.surface,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.headerLeft}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            style={styles.backButton}
            testID="header-back-btn"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={iconSize.lg} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}

        <View>
          <Text style={[typography.pageTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightAction && <View style={styles.headerRight}>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  flexContent: {
    flex: 1,
    paddingVertical: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  screenHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
    marginLeft: -4,
  },
  headerRight: {
    marginLeft: 12,
  },
});
