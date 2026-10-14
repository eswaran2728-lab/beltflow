import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import { CheckCircle, Clock, AlertTriangle, Database } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { Button } from './Button';
import { StatusBadge } from './Badges';
import { SyncState } from '../types/sync';

export interface SyncFeedbackCardProps {
  state: SyncState;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SyncFeedbackCard: React.FC<SyncFeedbackCardProps> = ({
  state,
  onRetry,
  style,
  testID,
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  const getStatusContent = () => {
    switch (state.status) {
      case 'synced':
        return {
          icon: <CheckCircle size={iconSize.md} color={colors.badgeSuccessText} />,
          title: 'All changes synchronized',
          description: state.lastSyncedAt
            ? `Last synced at ${new Date(state.lastSyncedAt).toLocaleTimeString()}`
            : 'All records are up to date with BeltFlow servers.',
          badgeVariant: 'success' as const,
          badgeLabel: 'SYNCED',
          resolvedTestId: testID || 'sync-feedback-synced',
        };
      case 'pending':
        return {
          icon: <Clock size={iconSize.md} color={colors.badgeWarningText} />,
          title: state.pendingCount && state.pendingCount > 0
            ? `${state.pendingCount} changes waiting to sync`
            : 'Changes waiting to sync',
          description: 'Updates will upload automatically once online connectivity is restored.',
          badgeVariant: 'warning' as const,
          badgeLabel: 'PENDING',
          resolvedTestId: testID || 'sync-feedback-pending',
        };
      case 'syncing':
        return {
          icon: <ActivityIndicator size="small" color={colors.buttonPrimaryBg} />,
          title: 'Synchronizing with BeltFlow...',
          description: 'Uploading changes to the central academy server.',
          badgeVariant: 'info' as const,
          badgeLabel: 'SYNCING',
          resolvedTestId: testID || 'sync-feedback-syncing',
        };
      case 'failed':
        return {
          icon: <AlertTriangle size={iconSize.md} color={colors.badgeDangerText} />,
          title: 'Synchronization failed',
          description: state.errorMessage || 'Unable to complete sync. Please verify connection and retry.',
          badgeVariant: 'danger' as const,
          badgeLabel: 'FAILED',
          resolvedTestId: testID || 'sync-feedback-failed',
        };
      case 'unavailable':
      default:
        return {
          icon: <Database size={iconSize.md} color={colors.textMuted} />,
          title: 'Offline sync not configured',
          description: 'Offline queue is not configured for this device. Operations require verified online access.',
          badgeVariant: 'info' as const,
          badgeLabel: 'NOT CONFIGURED',
          resolvedTestId: testID || 'sync-feedback-unavailable',
        };
    }
  };

  const content = getStatusContent();

  return (
    <Card
      variant="standard"
      style={[styles.container, { borderColor: colors.border }, style]}
      testID={content.resolvedTestId}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrapper}>{content.icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
            {content.title}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {content.description}
          </Text>
        </View>
        <StatusBadge
          status={state.status}
          label={content.badgeLabel}
          variant={content.badgeVariant}
        />
      </View>

      {state.status === 'failed' && onRetry ? (
        <View style={[styles.actionRow, { marginTop: spacing.md }]}>
          <Button
            label="Retry Sync"
            onPress={onRetry}
            variant="secondary"
            size="sm"
            testID="btn-sync-retry"
            accessibilityLabel="Retry synchronization"
          />
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
