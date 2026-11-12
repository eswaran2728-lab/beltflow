import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import { CheckCircle, Clock, AlertTriangle, Database } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { Button } from './Button';
import { StatusBadge } from './Badges';
import { SyncState } from '../types/sync';
import { useI18n } from '../i18n';

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
  const { t } = useI18n();

  const getStatusContent = () => {
    switch (state.status) {
      case 'synced':
        return {
          icon: <CheckCircle size={iconSize.md} color={colors.badgeSuccessText} />,
          title: t('components.sync.synced.title'),
          description: state.lastSyncedAt
            ? t('components.sync.synced.lastSynced', { time: new Date(state.lastSyncedAt).toLocaleTimeString() })
            : t('components.sync.synced.description'),
          badgeVariant: 'success' as const,
          badgeLabel: t('components.sync.synced.badge'),
          resolvedTestId: testID || 'sync-feedback-synced',
        };
      case 'pending':
        return {
          icon: <Clock size={iconSize.md} color={colors.badgeWarningText} />,
          title: state.pendingCount && state.pendingCount > 0
            ? t('components.sync.pending.titleCount', { count: state.pendingCount })
            : t('components.sync.pending.title'),
          description: t('components.sync.pending.description'),
          badgeVariant: 'warning' as const,
          badgeLabel: t('components.sync.pending.badge'),
          resolvedTestId: testID || 'sync-feedback-pending',
        };
      case 'syncing':
        return {
          icon: <ActivityIndicator size="small" color={colors.buttonPrimaryBg} />,
          title: t('components.sync.syncing.title'),
          description: t('components.sync.syncing.description'),
          badgeVariant: 'info' as const,
          badgeLabel: t('components.sync.syncing.badge'),
          resolvedTestId: testID || 'sync-feedback-syncing',
        };
      case 'failed':
        return {
          icon: <AlertTriangle size={iconSize.md} color={colors.badgeDangerText} />,
          title: t('components.sync.failed.title'),
          description: state.errorMessage || t('components.sync.failed.description'),
          badgeVariant: 'danger' as const,
          badgeLabel: t('components.sync.failed.badge'),
          resolvedTestId: testID || 'sync-feedback-failed',
        };
      case 'unavailable':
      default:
        return {
          icon: <Database size={iconSize.md} color={colors.textMuted} />,
          title: t('components.sync.unavailable.title'),
          description: t('components.sync.unavailable.description'),
          badgeVariant: 'info' as const,
          badgeLabel: t('components.sync.unavailable.badge'),
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
            label={t('components.sync.retry')}
            onPress={onRetry}
            variant="secondary"
            size="sm"
            testID="btn-sync-retry"
            accessibilityLabel={t('components.sync.retryA11y')}
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
