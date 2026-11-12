import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ViewStyle, Alert } from 'react-native';
import { AlertCircle, MessageCircle } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';
import { useI18n } from '../../i18n';

export interface AtRiskStudentItem {
  id: string;
  name: string;
  missedCount: number;
  parentPhone?: string;
}

export interface AtRiskAttendanceAlertProps {
  students: AtRiskStudentItem[];
  onPingParent?: (student: AtRiskStudentItem) => void;
  style?: ViewStyle;
}

export const AtRiskAttendanceAlert: React.FC<AtRiskAttendanceAlertProps> = ({
  students,
  onPingParent,
  style,
}) => {
  const { t } = useI18n();
  if (!students || students.length === 0) return null;

  const handlePing = (student: AtRiskStudentItem) => {
    if (onPingParent) {
      onPingParent(student);
      return;
    }
    if (!student.parentPhone) {
      Alert.alert(t('components.atRisk.contactUnavailableTitle'), t('components.atRisk.contactUnavailableBody', { name: student.name }));
      return;
    }

    Alert.alert(
      t('components.atRisk.guardianTitle'),
      t('components.atRisk.guardianBody', { name: student.name }),
      [
        { text: t('components.common.cancel'), style: 'cancel' },
        {
          text: t('components.atRisk.openWhatsApp'),
          onPress: () => {
            const cleanPhone = (student.parentPhone || '').replace(/[^0-9]/g, '');
            const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
              `Salam, this is your Master from the Dojang regarding ${student.name}'s attendance.`
            )}`;
            Linking.openURL(url).catch(() => {});
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, style]} testID="at-risk-attendance-alert">
      <View style={styles.headerRow}>
        <AlertCircle size={16} color={StitchTokens.colors.bfRed} />
        <Text style={styles.headerTitle}>
          {t(students.length > 1 ? 'components.atRisk.headerMany' : 'components.atRisk.headerOne', { count: students.length })}
        </Text>
      </View>

      {students.map((student, idx) => (
        <View
          key={student.id}
          style={[styles.studentRow, idx > 0 && styles.studentRowBorder]}
          testID={`at-risk-row-${student.id}`}
        >
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.absentCountText}>{t('components.atRisk.absentCount', { count: student.missedCount })}</Text>
          </View>

          <TouchableOpacity
            style={styles.pingBtn}
            onPress={() => handlePing(student)}
            testID={`btn-ping-parent-${student.id}`}
            accessibilityLabel={t('components.atRisk.pingA11y', { name: student.name })}
          >
            <MessageCircle size={12} color="#FFFFFF" />
            <Text style={styles.pingBtnText}>{t('components.atRisk.ping')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: StitchTokens.colors.bfRedSoft,
    borderWidth: 1,
    borderColor: StitchTokens.colors.bfRedBorder,
    borderRadius: StitchTokens.radii.cardMini,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: StitchTokens.colors.bfRedDark,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  studentRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#FFE4E6',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: StitchTokens.colors.slateTextMain,
  },
  absentCountText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    color: '#E11D48',
    marginTop: 1,
  },
  pingBtn: {
    backgroundColor: StitchTokens.colors.bfGreen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: StitchTokens.radii.btnSm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
  },
  pingBtnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
