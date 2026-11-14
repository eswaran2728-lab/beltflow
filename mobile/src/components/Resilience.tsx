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
import { useI18n } from '../i18n';

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
  const { t } = useI18n();

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
        message: t('components.connectivity.offline.message'),
        defaultTestId: 'connectivity-banner-offline',
        accessibilityLabel: t('components.connectivity.offline.a11y'),
      };
    }
    if (isBackendDown) {
      return {
        icon: <AlertTriangle size={iconSize.sm} color={colors.badgeDangerText} />,
        bg: colors.badgeDangerBg,
        borderColor: colors.badgeDangerText,
        textColor: colors.badgeDangerText,
        message: t('components.connectivity.backendDown.message'),
        defaultTestId: 'connectivity-banner-backend-unavailable',
        accessibilityLabel: t('components.connectivity.backendDown.a11y'),
      };
    }
    if (isRecovering) {
      return {
        icon: <ActivityIndicator size="small" color={colors.badgeInfoText} />,
        bg: colors.surfaceElevated,
        borderColor: colors.buttonPrimaryBg,
        textColor: colors.textPrimary,
        message: t('components.connectivity.recovering.message'),
        defaultTestId: 'connectivity-banner-recovering',
        accessibilityLabel: t('components.connectivity.recovering.a11y'),
      };
    }
    // Checking
    return {
      icon: <ActivityIndicator size="small" color={colors.textSecondary} />,
      bg: colors.surfaceElevated,
      borderColor: colors.border,
      textColor: colors.textSecondary,
      message: t('components.connectivity.checking.message'),
      defaultTestId: 'connectivity-banner-checking',
      accessibilityLabel: t('components.connectivity.checking.a11y'),
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
            label={t('components.common.retry')}
            size="sm"
            variant="outline"
            onPress={onRetry}
            testID="btn-connectivity-retry"
            accessibilityLabel={t('components.connectivity.retryA11y')}
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
  title: titleProp,
  message: messageProp,
  actionLabel,
  onAction,
  style,
  testID = 'permission-denied-state',
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const { t } = useI18n();
  const title = titleProp ?? t('components.permissionDenied.title');
  const message = messageProp ?? t('components.permissionDenied.message');

  return (
    <View
      style={[styles.centerContainer, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={t('components.permissionDenied.a11y')}
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
  title: titleProp,
  message: messageProp,
  onLoginRedirect,
  style,
  testID = 'session-expired-state',
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const { t } = useI18n();
  const title = titleProp ?? t('components.sessionExpired.title');
  const message = messageProp ?? t('components.sessionExpired.message');

  return (
    <View
      style={[styles.centerContainer, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={t('components.sessionExpired.a11y')}
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
            label={t('components.sessionExpired.button')}
            onPress={onLoginRedirect}
            variant="primary"
            size="md"
            testID="btn-session-expired-login"
            accessibilityLabel={t('components.sessionExpired.buttonA11y')}
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
  title: titleProp,
  message: messageProp,
  onRetry,
  style,
  testID = 'service-unavailable-state',
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const { t } = useI18n();
  const title = titleProp ?? t('components.serviceUnavailable.title');
  const message = messageProp ?? t('components.serviceUnavailable.message');

  return (
    <View
      style={[styles.centerContainer, style]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={t('components.serviceUnavailable.a11y')}
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
            label={t('components.common.tryAgain')}
            onPress={onRetry}
            variant="secondary"
            size="md"
            testID="btn-service-unavailable-retry"
            accessibilityLabel={t('components.serviceUnavailable.buttonA11y')}
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
  message: messageProp,
  style,
  testID = 'inline-loading-state',
}) => {
  const { colors, typography, spacing } = useTheme();
  const { t } = useI18n();
  const message = messageProp ?? t('components.common.loading');

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
  const { t } = useI18n();

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
      accessibilityLabel={t('components.skeleton.a11y')}
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
