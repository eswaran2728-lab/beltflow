import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Modal,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { AlertTriangle, WifiOff, Inbox } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

// ----------------------------------------------------------------------------
// 1. LoadingState Component
// ----------------------------------------------------------------------------
export interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  fullScreen = false,
  style,
  testID,
}) => {
  const { colors, typography } = useTheme();

  return (
    <View
      style={[
        styles.centerContainer,
        fullScreen && styles.fullScreenContainer,
        { backgroundColor: fullScreen ? colors.background : 'transparent' },
        style,
      ]}
      testID={testID}
    >
      <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
      {message ? (
        <Text
          style={[
            typography.bodyMedium,
            styles.feedbackMessage,
            { color: colors.textSecondary },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 2. EmptyState Component
// ----------------------------------------------------------------------------
export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
  testID,
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  return (
    <View style={[styles.centerContainer, style]} testID={testID}>
      <View style={styles.iconWrapper}>
        {icon || <Inbox size={iconSize.xl} color={colors.textMuted} />}
      </View>

      <Text style={[typography.sectionHeading, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>

      {description ? (
        <Text
          style={[
            typography.bodyMedium,
            styles.descriptionText,
            { color: colors.textSecondary, textAlign: 'center' },
          ]}
        >
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button label={actionLabel} onPress={onAction} variant="primary" size="md" />
        </View>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 3. ErrorState Component
// ----------------------------------------------------------------------------
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  style,
  testID,
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  return (
    <View style={[styles.centerContainer, style]} testID={testID}>
      <View style={[styles.iconWrapper, { backgroundColor: colors.badgeDangerBg, borderRadius: 999, padding: 12 }]}>
        <AlertTriangle size={iconSize.lg} color={colors.badgeDangerText} />
      </View>

      <Text style={[typography.sectionHeading, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>

      <Text
        style={[
          typography.bodyMedium,
          styles.descriptionText,
          { color: colors.textSecondary, textAlign: 'center' },
        ]}
      >
        {message}
      </Text>

      {onRetry ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Try Again"
            onPress={onRetry}
            variant="secondary"
            size="md"
            testID={testID ? `${testID}-retry` : 'btn-error-retry'}
            accessibilityLabel="Retry failed operation"
          />
        </View>
      ) : null}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 4. OfflineBanner Component
// ----------------------------------------------------------------------------
export interface OfflineBannerProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  message = 'Offline Mode — Changes will sync when connected',
  style,
  testID,
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  return (
    <View
      style={[
        styles.offlineBanner,
        {
          backgroundColor: colors.offlineBg,
          borderColor: colors.badgeWarningText,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        style,
      ]}
      testID={testID}
    >
      <WifiOff size={iconSize.sm} color={colors.offlineText} style={{ marginRight: 8 }} />
      <Text style={[typography.caption, { color: colors.offlineText, fontWeight: '700', flex: 1 }]}>
        {message}
      </Text>
    </View>
  );
};

// ----------------------------------------------------------------------------
// 5. ConfirmationDialog Component
// ----------------------------------------------------------------------------
export interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
  testID,
}) => {
  const { colors, typography, borderRadius, spacing } = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onCancel}
      testID={testID}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
              padding: spacing.xl,
            },
          ]}
        >
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 8 }]}>
            {title}
          </Text>

          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: 20 }]}>
            {message}
          </Text>

          <View style={styles.dialogActions}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Button label={cancelLabel} variant="outline" onPress={onCancel} size="md" fullWidth />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Button
                label={confirmLabel}
                variant={isDestructive ? 'danger' : 'primary'}
                onPress={onConfirm}
                size="md"
                fullWidth
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenContainer: {
    flex: 1,
  },
  iconWrapper: {
    marginBottom: 12,
  },
  feedbackMessage: {
    marginTop: 12,
    fontWeight: '500',
  },
  descriptionText: {
    marginTop: 6,
    maxWidth: 280,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
  },
  dialogActions: {
    flexDirection: 'row',
  },
});
