import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Users, Clock, CheckCircle } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';
import { useI18n } from '../../i18n';

export interface LiveSessionCardProps {
  categoryLabel?: string;
  className: string;
  scheduleTime: string;
  enrolledCount: number;
  capacity?: number;
  onRosterCheckPress?: () => void;
  onManagePress?: () => void;
  style?: ViewStyle;
}

export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({
  categoryLabel: categoryLabelProp,
  className,
  scheduleTime,
  enrolledCount,
  capacity,
  onRosterCheckPress,
  onManagePress,
  style,
}) => {
  const { t } = useI18n();
  const categoryLabel = categoryLabelProp ?? t('components.liveSession.defaultCategory');
  return (
    <View style={[styles.cardContainer, style]} testID="live-session-card">
      <Text style={styles.categoryLabel}>{categoryLabel}</Text>
      <Text style={styles.classTitle}>{className}</Text>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Clock size={12} color="#94A3B8" />
          <Text style={styles.metaText}>{scheduleTime}</Text>
        </View>
        <Text style={styles.metaDivider}>·</Text>
        <View style={styles.metaItem}>
          <Users size={12} color="#94A3B8" />
          <Text style={styles.metaText}>
            {capacity
              ? t('components.liveSession.enrolledCapacity', { count: enrolledCount, capacity })
              : t('components.liveSession.enrolled', { count: enrolledCount })}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onRosterCheckPress}
          activeOpacity={0.85}
          testID="btn-roster-check"
        >
          <CheckCircle size={14} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{t('components.liveSession.rosterCheck')}</Text>
        </TouchableOpacity>

        {onManagePress && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onManagePress}
            activeOpacity={0.8}
            testID="btn-session-manage"
          >
            <Text style={styles.secondaryBtnText}>{t('components.liveSession.manage')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: StitchTokens.colors.brandNavy,
    borderRadius: StitchTokens.radii.cardLarge,
    padding: 16,
    ...StitchTokens.shadows.cardElevated,
  },
  categoryLabel: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: StitchTokens.colors.colorAccent,
    textTransform: 'uppercase',
  },
  classTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    color: '#94A3B8',
  },
  metaDivider: {
    color: '#64748B',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: StitchTokens.colors.colorAccent,
    borderRadius: StitchTokens.radii.btn,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  primaryBtnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    borderRadius: StitchTokens.radii.btn,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryBtnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
