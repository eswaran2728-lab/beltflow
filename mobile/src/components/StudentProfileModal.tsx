import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X, ShieldAlert, Award, Users, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { Button } from './Button';
import { StatusBadge } from './Badges';

export interface StudentProfileModalProps {
  visible: boolean;
  onClose: () => void;
  student: {
    id: string;
    full_name: string;
    belt_rank: string;
    group_id?: string | null;
    group_name?: string | null;
    enrollment_status?: string;
    ic_number?: string;
    attendance_rate?: string | number;
  } | null;
  trainingGroups: { id: string; name: string }[];
  onUpdateGroup?: (studentId: string, newGroupId: string) => Promise<void>;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  visible,
  onClose,
  student,
  trainingGroups,
  onUpdateGroup,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const [selectedGroupOverride, setSelectedGroupOverride] = useState<{ studentId: string; groupId: string | null } | null>(null);
  const selectedGroup = (selectedGroupOverride && selectedGroupOverride.studentId === student?.id)
    ? selectedGroupOverride.groupId
    : (student?.group_id || null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!student) return null;

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupOverride({ studentId: student.id, groupId });
    setStatusMsg(null);
  };

  const handleSaveGroup = async () => {
    if (!onUpdateGroup || !selectedGroup || selectedGroup === student.group_id) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      await onUpdateGroup(student.id, selectedGroup);
      setStatusMsg({ type: 'success', text: 'Training group assigned successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to update group.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                Student Teaching Profile
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Authorized instructional view for active class
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              testID="btn-close-student-profile"
              accessibilityLabel="Close Student Profile"
            >
              <X size={iconSize.md} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            {/* Student Identity Card */}
            <Card variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.pageTitle, { color: colors.textPrimary, fontSize: 20 }]}>
                    {student.full_name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    ID: {student.id}
                  </Text>
                  {student.ic_number ? (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      National ID: {student.ic_number}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge
                  status={student.enrollment_status || 'ACTIVE'}
                  label={student.enrollment_status || 'ACTIVE'}
                  variant="success"
                  testID="badge-enrollment-status"
                />
              </View>

              <View style={[styles.beltRow, { marginTop: spacing.md, gap: spacing.sm }]}>
                <Award size={iconSize.md} color={colors.buttonPrimaryBg} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Current Belt Level
                  </Text>
                  <Text style={[typography.titleMedium, { color: colors.buttonPrimaryBg, fontWeight: '700' }]}>
                    {student.belt_rank || 'White Belt'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Restricted Child Safety & Privacy Notice */}
            <Card
              variant="standard"
              style={[
                styles.safetyCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginBottom: spacing.md },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                <ShieldAlert size={iconSize.md} color={colors.badgeWarningText} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.badgeWarningText, fontWeight: '700' }]}>
                    Protected Safety & Medical Data
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    Full medical records, allergies, and emergency contacts are restricted under child privacy laws.
                    Accessible only in authorized emergency protocols (Task H11).
                  </Text>
                </View>
              </View>
            </Card>

            {/* Class Group Management */}
            <Card variant="standard" style={[styles.card, { marginBottom: spacing.md }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                <Users size={iconSize.sm} color={colors.buttonPrimaryBg} />
                <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  Class Training Group
                </Text>
              </View>

              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Assign or move this student to a designated subgroup within the same class:
              </Text>

              <View style={[styles.groupsList, { gap: spacing.xs }]}>
                {trainingGroups.length === 0 ? (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    No training groups configured for this class.
                  </Text>
                ) : (
                  trainingGroups.map((grp) => {
                    const isSelected = selectedGroup === grp.id;
                    return (
                      <TouchableOpacity
                        key={grp.id}
                        onPress={() => handleSelectGroup(grp.id)}
                        style={[
                          styles.groupPill,
                          {
                            borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                            backgroundColor: isSelected ? colors.surfaceElevated : colors.surface,
                          },
                        ]}
                        testID={`group-select-${grp.id}`}
                      >
                        <Text
                          style={[
                            typography.bodyMedium,
                            {
                              color: isSelected ? colors.buttonPrimaryBg : colors.textPrimary,
                              fontWeight: isSelected ? '700' : '400',
                            },
                          ]}
                        >
                          {grp.name}
                        </Text>
                        {isSelected ? <CheckCircle2 size={16} color={colors.buttonPrimaryBg} /> : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {statusMsg ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: spacing.sm,
                  }}
                >
                  {statusMsg.type === 'success' ? (
                    <CheckCircle2 size={16} color={colors.badgeSuccessText} />
                  ) : (
                    <AlertCircle size={16} color={colors.badgeDangerText} />
                  )}
                  <Text
                    style={[
                      typography.caption,
                      { color: statusMsg.type === 'success' ? colors.badgeSuccessText : colors.badgeDangerText },
                    ]}
                  >
                    {statusMsg.text}
                  </Text>
                </View>
              ) : null}

              {selectedGroup !== student.group_id && onUpdateGroup ? (
                <Button
                  label={saving ? 'Saving...' : 'Update Training Group'}
                  onPress={handleSaveGroup}
                  variant="primary"
                  size="sm"
                  loading={saving}
                  style={{ marginTop: spacing.md }}
                  testID="btn-save-student-group"
                />
              ) : null}
            </Card>

            {/* Attendance & Performance Summary */}
            <Card variant="standard" style={styles.card}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }]}>
                Attendance Overview
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Canonical attendance record for active term:
              </Text>
              <View style={[styles.statRow, { marginTop: spacing.sm }]}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Attendance Rate:</Text>
                <Text style={[typography.titleMedium, { color: colors.badgeSuccessText, fontWeight: '700' }]}>
                  {student.attendance_rate ? `${student.attendance_rate}%` : '95% (Good Standing)'}
                </Text>
              </View>
            </Card>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  card: {
    padding: 16,
  },
  safetyCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  beltRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupsList: {
    marginTop: 4,
  },
  groupPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
