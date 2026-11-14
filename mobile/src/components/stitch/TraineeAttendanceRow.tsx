import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { StitchTokens } from '../../theme/tokens';
import { useI18n } from '../../i18n';

export interface TraineeAttendanceRowProps {
  studentId: string;
  name: string;
  initials: string;
  beltRank: string;
  currentStatus?: 'PRESENT' | 'LATE' | 'ABSENT' | null;
  onMarkPresent: (studentId: string) => void;
  onMarkLate: (studentId: string) => void;
  onMarkAbsent?: (studentId: string) => void;
  style?: ViewStyle;
}

export const TraineeAttendanceRow: React.FC<TraineeAttendanceRowProps> = ({
  studentId,
  name,
  initials,
  beltRank,
  currentStatus,
  onMarkPresent,
  onMarkLate,
  onMarkAbsent,
  style,
}) => {
  const { t } = useI18n();
  const isPresent = currentStatus === 'PRESENT';
  const isLate = currentStatus === 'LATE';
  const isAbsent = currentStatus === 'ABSENT';

  return (
    <View style={[styles.card, style]} testID={`trainee-row-${studentId}`}>
      <View style={styles.leftGroup}>
        {/* Avatar with Initials */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Student Info */}
        <View style={styles.infoGroup}>
          <Text style={styles.studentName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.beltTag}>
            <Text style={styles.beltTagText}>{beltRank}</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionGroup}>
        <TouchableOpacity
          style={[
            styles.statusBtn,
            styles.presentBtn,
            isPresent && styles.presentActiveBtn,
          ]}
          onPress={() => onMarkPresent(studentId)}
          testID={`btn-present-${studentId}`}
          accessibilityLabel={t('components.trainee.markPresentA11y', { name })}
        >
          <Text
            style={[
              styles.presentBtnText,
              isPresent && styles.presentActiveBtnText,
            ]}
          >
            {t('status.present')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusBtn,
            styles.lateBtn,
            isLate && styles.lateActiveBtn,
          ]}
          onPress={() => onMarkLate(studentId)}
          testID={`btn-late-${studentId}`}
          accessibilityLabel={t('components.trainee.markLateA11y', { name })}
        >
          <Text
            style={[
              styles.lateBtnText,
              isLate && styles.lateActiveBtnText,
            ]}
          >
            {t('status.late')}
          </Text>
        </TouchableOpacity>

        {onMarkAbsent && (
          <TouchableOpacity
            style={[
              styles.statusBtn,
              styles.absentBtn,
              isAbsent && styles.absentActiveBtn,
            ]}
            onPress={() => onMarkAbsent(studentId)}
            testID={`btn-absent-${studentId}`}
            accessibilityLabel={t('components.trainee.markAbsentA11y', { name })}
          >
            <Text
              style={[
                styles.absentBtnText,
                isAbsent && styles.absentActiveBtnText,
              ]}
            >
              {t('status.absent')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: StitchTokens.colors.slateBorder,
    borderRadius: StitchTokens.radii.cardMini,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    ...StitchTokens.shadows.card,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: StitchTokens.colors.brandNavyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: StitchTokens.colors.brandNavy,
  },
  infoGroup: {
    flex: 1,
  },
  studentName: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: StitchTokens.colors.slateTextMain,
  },
  beltTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: StitchTokens.radii.tagMini,
    marginTop: 3,
  },
  beltTagText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  statusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: StitchTokens.radii.btnSm,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentBtn: {
    backgroundColor: StitchTokens.colors.bfGreenSoft,
  },
  presentBtnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: StitchTokens.colors.bfGreenDark,
  },
  presentActiveBtn: {
    backgroundColor: StitchTokens.colors.bfGreenDark,
  },
  presentActiveBtnText: {
    color: '#FFFFFF',
  },
  lateBtn: {
    backgroundColor: '#F1F5F9',
  },
  lateBtnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '500',
    color: StitchTokens.colors.slateTextMuted,
  },
  lateActiveBtn: {
    backgroundColor: '#E2E8F0',
  },
  lateActiveBtnText: {
    fontWeight: '700',
    color: StitchTokens.colors.slateTextMain,
  },
  absentBtn: {
    backgroundColor: '#FFF1F2',
  },
  absentBtnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    color: StitchTokens.colors.bfRed,
  },
  absentActiveBtn: {
    backgroundColor: StitchTokens.colors.bfRed,
  },
  absentActiveBtnText: {
    color: '#FFFFFF',
  },
});
