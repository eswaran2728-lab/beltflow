import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
} from 'react-native';
import {
  WifiOff,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ServerOff,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { Card } from './Card';
import { ConnectivityState } from '../types/connectivity';

// ----------------------------------------------------------------------------
// 1. ConnectivityBanner Component
// ----------------------------------------------------------------------------
export interface ConnectivityBannerProps {
  state?: ConnectivityState;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ConnectivityBanner: React.FC<ConnectivityBannerProps> = ({
  state,
  onRetry,
  style,
  testID,
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  if (!state || state.status === 'online') {
    return null;
  }

  const isOffline = state.status === 'offline';
  const isBackendDown = state.status === 'backend_unavailable';
  const isRecovering = state.status === 'recovering';

  const getBannerDetails = () => {
    if (isOffline) {
      return {
        icon: <WifiOff size={iconSize.sm} color={colors.offlineText} />,
        bg: colors.offlineBg,
        borderColor: colors.badgeWarningText,
        textColor: colors.offlineText,
        message: 'Offline Mode: Locally Cached Identity — Sensitive server operations are locked until online.',
        defaultTestId: 'connectivity-banner-offline',
        accessibilityLabel: 'Offline mode alert. You are disconnected from the internet.',
      };
    }
    if (isBackendDown) {
      return {
        icon: <AlertTriangle size={iconSize.sm} color={colors.badgeDangerText} />,
        bg: colors.badgeDangerBg,
        borderColor: colors.badgeDangerText,
        textColor: colors.badgeDangerText,
        message: 'Backend Unavailable — Unable to reach BeltFlow servers. Please try again shortly.',
        defaultTestId: 'connectivity-banner-backend-unavailable',
        accessibilityLabel: 'Backend unavailable alert. BeltFlow servers cannot be reached.',
      };
    }
    if (isRecovering) {
      return {
        icon: <ActivityIndicator size="small" color={colors.badgeInfoText} />,
        bg: colors.surfaceElevated,
        borderColor: colors.buttonPrimaryBg,
        textColor: colors.textPrimary,
        message: 'Reconnecting to BeltFlow servers...',
        defaultTestId: 'connectivity-banner-recovering',
        accessibilityLabel: 'Reconnecting to BeltFlow servers.',
      };
    }
    // Checking
    return {
      icon: <ActivityIndicator size="small" color={colors.textSecondary} />,
      bg: colors.surfaceElevated,
      borderColor: colors.border,
      textColor: colors.textSecondary,
      message: 'Checking connection...',
      defaultTestId: 'connectivity-banner-checking',
      accessibilityLabel: 'Checking network connection.',
    };
  };

  const details = getBannerDetails();

  return (
    <View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: details.bg,
          borderColor: details.borderColor,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
      testID={testID || details.defaultTestId}
      accessibilityRole="alert"
      accessibilityLabel={details.accessibilityLabel}
    >
      <View style={{ marginRight: 8 }}>{details.icon}</View>
      <Text style={[typography.caption, { color: details.textColor, fontWeight: '700', flex: 1 }]}>
        {details.message}
      </Text>
      {isBackendDown && onRetry ? (
        <View style={{ marginLeft: 8 }}>
          <Button
            label="Retry"
            size="sm"
            variant="outline"
            onPress={onRetry}
            testID="btn-connectivity-retry"
            accessibilityLabel="Retry connecting to BeltFlow servers"
          />
        </View>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 2. PermissionDeniedState Component
// ----------------------------------------------------------------------------
export interface PermissionDeniedStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const PermissionDeniedState: React.FC<PermissionDeniedStateProps> = ({
  title = 'Access Restricted',
  message = 'You do not have permission to view or manage these records. Please contact your Persatuan Administrator or Master.',
  actionLabel,
  onAction,
  style,
  testID = 'permission-denied-state',
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  return (
    <View
      style={[styles.centerContainer, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel="Access restricted notice"
    >
      <View style={[styles.iconWrapper, { backgroundColor: colors.badgeDangerBg, borderRadius: 999, padding: 14 }]}>
        <ShieldAlert size={iconSize.xl} color={colors.badgeDangerText} />
      </View>
      <Text style={[typography.sectionHeading, { color: colors.textPrimary, textAlign: 'center', marginTop: 12 }]}>
        {title}
      </Text>
      <Text style={[typography.bodyMedium, styles.descriptionText, { color: colors.textSecondary, textAlign: 'center' }]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" size="md" />
        </View>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 3. SessionExpiredState Component
// ----------------------------------------------------------------------------
export interface SessionExpiredStateProps {
  title?: string;
  message?: string;
  onLoginRedirect?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SessionExpiredState: React.FC<SessionExpiredStateProps> = ({
  title = 'Session Expired',
  message = 'Your security session has expired. Please sign in again to continue.',
  onLoginRedirect,
  style,
  testID = 'session-expired-state',
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  return (
    <View
      style={[styles.centerContainer, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel="Security session expired alert"
    >
      <View style={[styles.iconWrapper, { backgroundColor: colors.badgeWarningBg, borderRadius: 999, padding: 14 }]}>
        <Clock size={iconSize.xl} color={colors.badgeWarningText} />
      </View>
      <Text style={[typography.sectionHeading, { color: colors.textPrimary, textAlign: 'center', marginTop: 12 }]}>
        {title}
      </Text>
      <Text style={[typography.bodyMedium, styles.descriptionText, { color: colors.textSecondary, textAlign: 'center' }]}>
        {message}
      </Text>
      {onLoginRedirect ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Return to Sign In"
            onPress={onLoginRedirect}
            variant="primary"
            size="md"
            testID="btn-session-expired-login"
            accessibilityLabel="Return to sign in screen"
          />
        </View>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 4. ServiceUnavailableState Component
// ----------------------------------------------------------------------------
export interface ServiceUnavailableStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ServiceUnavailableState: React.FC<ServiceUnavailableStateProps> = ({
  title = 'Service Temporarily Unavailable',
  message = 'BeltFlow backend services are currently undergoing maintenance or experiencing an outage. Please try again in a few moments.',
  onRetry,
  style,
  testID = 'service-unavailable-state',
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  return (
    <View
      style={[styles.centerContainer, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel="Service temporarily unavailable alert"
    >
      <View style={[styles.iconWrapper, { backgroundColor: colors.badgeWarningBg, borderRadius: 999, padding: 14 }]}>
        <ServerOff size={iconSize.xl} color={colors.badgeWarningText} />
      </View>
      <Text style={[typography.sectionHeading, { color: colors.textPrimary, textAlign: 'center', marginTop: 12 }]}>
        {title}
      </Text>
      <Text style={[typography.bodyMedium, styles.descriptionText, { color: colors.textSecondary, textAlign: 'center' }]}>
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Try Again"
            onPress={onRetry}
            variant="secondary"
            size="md"
            testID="btn-service-unavailable-retry"
            accessibilityLabel="Retry connecting to BeltFlow service"
          />
        </View>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 5. InlineLoadingState Component
// ----------------------------------------------------------------------------
export interface InlineLoadingStateProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const InlineLoadingState: React.FC<InlineLoadingStateProps> = ({
  message = 'Loading...',
  style,
  testID = 'inline-loading-state',
}) => {
  const { colors, typography, spacing } = useTheme();

  return (
    <View
      style={[styles.inlineLoadingRow, style]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <ActivityIndicator size="small" color={colors.buttonPrimaryBg} />
      <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
        {message}
      </Text>
    </View>
  );
};

// ----------------------------------------------------------------------------
// 6. SkeletonCard and SkeletonList Components
// ----------------------------------------------------------------------------
export interface SkeletonCardProps {
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  height = 96,
  style,
  testID = 'skeleton-card',
}) => {
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <Card
      variant="standard"
      style={[
        {
          minHeight: height,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          justifyContent: 'center',
          padding: spacing.md,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading placeholder card"
    >
      <View
        style={[
          styles.skeletonBar,
          { width: '40%', height: 16, backgroundColor: colors.border, borderRadius: borderRadius.sm },
        ]}
      />
      <View
        style={[
          styles.skeletonBar,
          { width: '75%', height: 12, backgroundColor: colors.border, borderRadius: borderRadius.sm, marginTop: 8 },
        ]}
      />
      <View
        style={[
          styles.skeletonBar,
          { width: '55%', height: 12, backgroundColor: colors.border, borderRadius: borderRadius.sm, marginTop: 6 },
        ]}
      />
    </Card>
  );
};

export interface SkeletonListProps {
  count?: number;
  cardHeight?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 3,
  cardHeight,
  style,
  testID = 'skeleton-list',
}) => {
  const { spacing } = useTheme();

  return (
    <View style={[{ gap: spacing.sm }, style]} testID={testID}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} height={cardHeight} testID={`${testID}-item-${idx}`} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    width: '100%',
  },
  centerContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptionText: {
    marginTop: 8,
    maxWidth: 320,
    lineHeight: 20,
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skeletonBar: {
    opacity: 0.6,
  },
});
