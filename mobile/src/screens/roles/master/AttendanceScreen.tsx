import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Search,
  Users,
  Calendar,
  Clock,
  Save,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  QrCode,
} from 'lucide-react-native';
import { QRScannerModal } from './QRScannerModal';
import { useTheme } from '../../../theme/ThemeProvider';
import { resolveBeltDisplay } from '../../../theme/belts';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { OfflineBanner } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import {
  masterAttendanceService,
  AttendanceContext,
} from '../../../services/masterAttendanceService';
import {
  offlineSyncService,
  SyncEngineState,
} from '../../../services/offlineSyncService';
import {
  CachedClass,
  CachedTrainingGroup,
  CachedStudent,
  CachedSession,
  AttendanceStatus,
} from '../../../database/types';

export interface AttendanceScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({
  user,
  isOffline = false,
}) => {
  const { colors, iconSize } = useTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);
  const [classes, setClasses] = useState<CachedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [groups, setGroups] = useState<CachedTrainingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<CachedSession | null>(null);
  const [students, setStudents] = useState<CachedStudent[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus | null>>({});
  const [initialAttendanceMap, setInitialAttendanceMap] = useState<Record<string, AttendanceStatus | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncEngineState>(offlineSyncService.getState());
  const [showQRScanner, setShowQRScanner] = useState(false);

  const handleQRAttendanceRecorded = async (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    setInitialAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    const counts = await offlineSyncService.refreshCounts(user);
    setPendingCount(counts.pending);
  };

  useEffect(() => {
    offlineSyncService.setUser(user);
    const unsub = offlineSyncService.onSyncStateChange(setSyncState);
    return () => {
      unsub();
    };
  }, [user]);

  // Load Context on class/group switch
  const loadContext = useCallback(async (classId?: string, groupId?: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setSaveSuccessMsg(null);

      const ctx: AttendanceContext = await masterAttendanceService.loadAttendanceContext(user, {
        isOffline,
        classId: classId || selectedClassId || undefined,
        groupId: groupId !== undefined ? (groupId || undefined) : (selectedGroupId || undefined),
      });

      setClasses(ctx.classes);
      setSelectedClassId(ctx.selectedClass?.id || null);
      setGroups(ctx.groups);
      setActiveSession(ctx.activeSession);
      setStudents(ctx.students);
      setAttendanceMap(ctx.attendanceMap);
      setInitialAttendanceMap(ctx.attendanceMap);
      setPendingCount(ctx.pendingCount);
      setErrorMessage(ctx.errorMessage);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load attendance roster.');
    } finally {
      setLoading(false);
    }
  }, [user, isOffline, selectedClassId, selectedGroupId]);

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      try {
        const ctx: AttendanceContext = await masterAttendanceService.loadAttendanceContext(user, {
          isOffline,
          classId: selectedClassId || undefined,
          groupId: selectedGroupId || undefined,
        });

        if (isCancelled) return;
        setClasses(ctx.classes);
        setSelectedClassId(ctx.selectedClass?.id || null);
        setGroups(ctx.groups);
        setActiveSession(ctx.activeSession);
        setStudents(ctx.students);
        setAttendanceMap(ctx.attendanceMap);
        setInitialAttendanceMap(ctx.attendanceMap);
        setPendingCount(ctx.pendingCount);
        setErrorMessage(ctx.errorMessage);
        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        setErrorMessage(err.message || 'Failed to load attendance roster.');
        setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [user, isOffline, selectedClassId, selectedGroupId]);

  // Handle class selection
  const handleSelectClass = (clsId: string) => {
    setSelectedClassId(clsId);
    setSelectedGroupId(null);
    loadContext(clsId, '');
  };

  // Handle group filter selection
  const handleSelectGroup = (grpId: string | null) => {
    setSelectedGroupId(grpId);
    loadContext(selectedClassId || undefined, grpId || '');
  };

  // Handle roll call status selection
  const handleSelectStatus = (studentId: string, status: AttendanceStatus) => {
    const current = attendanceMap[studentId];
    if (current === status) {
      // Toggle off / reset to unmarked
      setAttendanceMap(prev => ({ ...prev, [studentId]: null }));
    } else {
      setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    }
  };

  // Filter students by search input
  const filteredStudents = useMemo(() => {
    return masterAttendanceService.filterStudents(students, searchQuery);
  }, [students, searchQuery]);

  // Roll-call stats summary
  const summary = useMemo(() => {
    return masterAttendanceService.calculateSummary(students, attendanceMap);
  }, [students, attendanceMap]);

  // Detect uncommitted local modifications
  const hasChanges = useMemo(() => {
    for (const stu of students) {
      if (attendanceMap[stu.id] !== initialAttendanceMap[stu.id]) {
        return true;
      }
    }
    return false;
  }, [students, attendanceMap, initialAttendanceMap]);

  // Manual sync trigger
  const handleManualSync = async () => {
    if (isOffline) {
      Alert.alert('Offline Mode', 'Cannot synchronize while device is offline.');
      return;
    }
    try {
      setManualSyncing(true);
      setErrorMessage(null);
      const res = await offlineSyncService.syncNow(user);
      if (res.error) {
        Alert.alert('Sync Feedback', res.error);
      } else {
        await loadContext();
      }
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Synchronization failed.');
    } finally {
      setManualSyncing(false);
    }
  };

  // Save attendance locally with robust failure protection
  const handleSaveAttendance = async () => {
    if (!activeSession) {
      Alert.alert('Session Required', 'No active training session found for this class.');
      return;
    }

    try {
      setSaving(true);
      setSaveSuccessMsg(null);
      setSaveError(null);

      let savedCount = 0;
      for (const student of students) {
        const currentStatus = attendanceMap[student.id];
        const prevStatus = initialAttendanceMap[student.id];

        // Save if set and differs from initial or if newly marked
        if (currentStatus && currentStatus !== prevStatus) {
          await masterAttendanceService.recordAttendanceMark(user, {
            sessionId: activeSession.id,
            studentId: student.id,
            status: currentStatus,
          });
          savedCount++;
        }
      }

      setInitialAttendanceMap({ ...attendanceMap });
      setSaveError(null);
      const counts = await offlineSyncService.refreshCounts(user);
      setPendingCount(counts.pending);
      setSaveSuccessMsg(
        `Saved locally to queue (${savedCount} updated, ${counts.pending} total pending sync).`
      );

      // Auto-trigger sync if connected
      if (!isOffline) {
        void offlineSyncService.syncNow(user, { silent: true });
      }
    } catch (err: any) {
      // Failed local persistence must never appear saved
      setSaveError(err.message || 'Storage write failed.');
      Alert.alert('Save Failed', 'Could not save attendance to local storage. Unsaved changes are present.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer testID="master-attendance-screen">
      <ScreenHeader
        title="Mat Attendance"
        subtitle="Offline Roll Call & Roster"
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Offline Banner Indicator */}
        {isOffline && (
          <View testID="attendance-offline-banner" style={styles.bannerMargin}>
            <OfflineBanner
              message="Operating in offline mode. Roll-call marks will be saved to the local queue."
            />
          </View>
        )}

        {/* Syncing Progress Banner */}
        {syncState.status === 'syncing' && (
          <View testID="attendance-syncing-banner" style={[styles.syncingContainer, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={[styles.syncingText, { color: '#1E40AF' }]}>
              Synchronizing attendance records with server...
            </Text>
          </View>
        )}

        {/* Sync Conflict Alert Banner */}
        {syncState.conflictCount > 0 && (
          <View testID="attendance-conflict-badge" style={[styles.conflictContainer, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
            <AlertTriangle size={iconSize.sm} color="#B91C1C" />
            <Text style={[styles.conflictText, { color: '#B91C1C' }]}>
              {syncState.conflictCount} attendance conflict(s) require review.
            </Text>
          </View>
        )}

        {/* Local Storage Save Failure Banner */}
        {saveError && (
          <View testID="attendance-save-failure-banner" style={[styles.failureContainer, { backgroundColor: '#FFF1F2', borderColor: '#E11D48' }]}>
            <AlertCircle size={iconSize.sm} color="#BE123C" />
            <View style={styles.failureTextContainer}>
              <Text style={[styles.failureTitle, { color: '#9F1239' }]}>Save Failed</Text>
              <Text style={[styles.failureSubtitle, { color: '#BE123C' }]}>
                Unsaved changes present. {saveError}
              </Text>
            </View>
            <TouchableOpacity
              testID="btn-retry-save"
              onPress={handleSaveAttendance}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry saving attendance"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Unsynchronized Mutations Badge with Sync Now Button */}
        {pendingCount > 0 && (
          <View
            testID="attendance-unsynced-badge"
            style={[styles.unsyncedContainer, { backgroundColor: colors.badgeWarningBg, borderColor: colors.badgeWarningText }]}
          >
            <View style={styles.unsyncedRow}>
              <CloudOff size={iconSize.sm} color={colors.badgeWarningText} />
              <Text style={[styles.unsyncedText, { color: colors.badgeWarningText }]}>
                {pendingCount} unsynchronized record(s) pending sync
              </Text>
            </View>

            {!isOffline && (
              <TouchableOpacity
                testID="btn-sync-now"
                onPress={handleManualSync}
                disabled={manualSyncing || syncState.status === 'syncing'}
                style={styles.syncNowButton}
                accessibilityRole="button"
                accessibilityLabel="Sync attendance records now"
              >
                <RefreshCw size={12} color="#FFFFFF" />
                <Text style={styles.syncNowButtonText}>
                  {manualSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Success Feedback */}
        {saveSuccessMsg && (
          <View style={[styles.successContainer, { backgroundColor: colors.badgeSuccessBg, borderColor: colors.badgeSuccessText }]}>
            <CheckCircle2 size={iconSize.sm} color={colors.badgeSuccessText} />
            <Text style={[styles.successText, { color: colors.badgeSuccessText }]}>{saveSuccessMsg}</Text>
          </View>
        )}

        {/* Class Selector */}
        {classes.length > 0 && (
          <View testID="attendance-class-selector" style={styles.sectionMargin}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ASSIGNED CLASS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {classes.map(cls => {
                const isSelected = cls.id === selectedClassId;
                return (
                  <TouchableOpacity
                    key={cls.id}
                    onPress={() => handleSelectClass(cls.id)}
                    style={[
                      styles.classPill,
                      {
                        backgroundColor: isSelected ? colors.buttonPrimaryBg : colors.surface,
                        borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Select class ${cls.name}`}
                  >
                    <Text
                      style={[
                        styles.classPillText,
                        { color: isSelected ? colors.buttonPrimaryText : colors.textPrimary },
                      ]}
                    >
                      {cls.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Training Group Selector */}
        {groups.length > 0 && (
          <View testID="attendance-group-selector" style={styles.sectionMargin}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TRAINING GROUP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              <TouchableOpacity
                onPress={() => handleSelectGroup(null)}
                style={[
                  styles.groupChip,
                  {
                    backgroundColor: selectedGroupId === null ? colors.buttonSecondaryBg : colors.surface,
                    borderColor: selectedGroupId === null ? colors.buttonSecondaryBg : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedGroupId === null }}
                accessibilityLabel="All groups"
              >
                <Text
                  style={[
                    styles.groupChipText,
                    { color: selectedGroupId === null ? '#0D2B47' : colors.textSecondary },
                  ]}
                >
                  All Groups
                </Text>
              </TouchableOpacity>

              {groups.map(grp => {
                const isSelected = grp.id === selectedGroupId;
                return (
                  <TouchableOpacity
                    key={grp.id}
                    onPress={() => handleSelectGroup(grp.id)}
                    style={[
                      styles.groupChip,
                      {
                        backgroundColor: isSelected ? colors.buttonSecondaryBg : colors.surface,
                        borderColor: isSelected ? colors.buttonSecondaryBg : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Group ${grp.name}`}
                  >
                    <Text
                      style={[
                        styles.groupChipText,
                        { color: isSelected ? '#0D2B47' : colors.textSecondary },
                      ]}
                    >
                      {grp.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Active Session Info Bar */}
        {activeSession && (
          <Card style={styles.sessionCard}>
            <View style={styles.sessionRow}>
              <View style={styles.sessionCol}>
                <View style={styles.iconTextRow}>
                  <Calendar size={iconSize.sm} color={colors.buttonSecondaryBg} />
                  <Text style={[styles.sessionDate, { color: colors.textPrimary }]}>
                    {activeSession.session_date} {activeSession.day_of_week ? `(${activeSession.day_of_week})` : ''}
                  </Text>
                </View>
                <View style={[styles.iconTextRow, { marginTop: 4 }]}>
                  <Clock size={iconSize.sm} color={colors.textSecondary} />
                  <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                    {activeSession.start_time || '17:00'} - {activeSession.end_time || '18:30'}
                  </Text>
                </View>
              </View>

              <View style={styles.sessionBadge}>
                <Text style={styles.sessionBadgeText}>{activeSession.status || 'Scheduled'}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Real-time Attendance Summary Stats */}
        <View style={styles.summaryGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.textPrimary }]} testID="stat-total-count">
              {summary.total}
            </Text>
            <Text style={[styles.statLbl, { color: colors.textSecondary }]}>TOTAL</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.statNum, { color: '#166534' }]} testID="stat-present-count">
              {summary.present}
            </Text>
            <Text style={[styles.statLbl, { color: '#166534' }]}>PRESENT</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statNum, { color: '#92400E' }]} testID="stat-late-count">
              {summary.late}
            </Text>
            <Text style={[styles.statLbl, { color: '#92400E' }]}>LATE</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.statNum, { color: '#991B1B' }]} testID="stat-absent-count">
              {summary.absent}
            </Text>
            <Text style={[styles.statLbl, { color: '#991B1B' }]}>ABSENT</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#E0E7FF' }]}>
            <Text style={[styles.statNum, { color: '#3730A3' }]} testID="stat-excused-count">
              {summary.excused}
            </Text>
            <Text style={[styles.statLbl, { color: '#3730A3' }]}>EXCUSED</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statNum, { color: colors.textSecondary }]} testID="stat-unmarked-count">
              {summary.unmarked}
            </Text>
            <Text style={[styles.statLbl, { color: colors.textSecondary }]}>UNMARKED</Text>
          </View>
        </View>

        {/* Student Search Bar & QR Scanner Action Row */}
        <View style={styles.searchAndScanRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
            <Search size={iconSize.sm} color={colors.textSecondary} />
            <TextInput
              testID="input-student-search"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search students by name..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              accessibilityLabel="Search students by name"
            />
          </View>

          <TouchableOpacity
            testID="btn-open-qr-scanner"
            onPress={() => setShowQRScanner(true)}
            style={[styles.qrScanButton, { backgroundColor: colors.buttonPrimaryBg }]}
            accessibilityRole="button"
            accessibilityLabel="Open camera QR scanner for student attendance"
          >
            <QrCode size={18} color="#FFFFFF" />
            <Text style={styles.qrScanButtonText}>Scan QR</Text>
          </TouchableOpacity>
        </View>

        {/* Roster State: Loading, Unavailable, or Student Cards */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.buttonPrimaryBg} style={styles.loader} />
        ) : errorMessage ? (
          <Card style={styles.emptyCard}>
            <Users size={iconSize.lg} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Roster Unavailable</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{errorMessage}</Text>
          </Card>
        ) : filteredStudents.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={iconSize.lg} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Students Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery ? 'No student names match your search query.' : 'No students enrolled in this group.'}
            </Text>
          </Card>
        ) : (
          <View style={styles.rosterList}>
            {filteredStudents.map(student => {
              const selectedStatus = attendanceMap[student.id];
              const beltInfo = resolveBeltDisplay(student.belt_rank);

              return (
                <Card
                  key={student.id}
                  testID={`student-row-${student.id}`}
                  style={styles.studentCard}
                >
                  <View style={styles.studentHeaderRow}>
                    <View style={styles.studentInfo}>
                      <Text style={[styles.studentName, { color: colors.textPrimary }]}>
                        {student.full_name}
                      </Text>

                      {/* Belt Label with Dynamic Color — Preserving Persatuan Belt Configuration */}
                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.beltBadge,
                            {
                              backgroundColor: beltInfo.colorHex,
                              borderColor: beltInfo.borderColor || '#CBD5E1',
                            },
                          ]}
                        >
                          <Text style={[styles.beltText, { color: beltInfo.textColor || '#0F172A' }]}>
                            {student.belt_rank}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Local Status Indicator */}
                    {selectedStatus && (
                      <View style={styles.statusIndicator}>
                        <Text style={styles.statusIndicatorText}>
                          {selectedStatus.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Fast Attendance 4-State Toggle Controls */}
                  <View style={styles.actionButtonGroup}>
                    {/* Present */}
                    <TouchableOpacity
                      testID={`btn-status-present-${student.id}`}
                      onPress={() => handleSelectStatus(student.id, 'Present')}
                      style={[
                        styles.statusButton,
                        selectedStatus === 'Present'
                          ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${student.full_name} Present`}
                      accessibilityState={{ selected: selectedStatus === 'Present' }}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          { color: selectedStatus === 'Present' ? '#FFFFFF' : '#16A34A' },
                        ]}
                      >
                        Present
                      </Text>
                    </TouchableOpacity>

                    {/* Late */}
                    <TouchableOpacity
                      testID={`btn-status-late-${student.id}`}
                      onPress={() => handleSelectStatus(student.id, 'Late')}
                      style={[
                        styles.statusButton,
                        selectedStatus === 'Late'
                          ? { backgroundColor: '#D97706', borderColor: '#D97706' }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${student.full_name} Late`}
                      accessibilityState={{ selected: selectedStatus === 'Late' }}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          { color: selectedStatus === 'Late' ? '#FFFFFF' : '#D97706' },
                        ]}
                      >
                        Late
                      </Text>
                    </TouchableOpacity>

                    {/* Absent */}
                    <TouchableOpacity
                      testID={`btn-status-absent-${student.id}`}
                      onPress={() => handleSelectStatus(student.id, 'Absent')}
                      style={[
                        styles.statusButton,
                        selectedStatus === 'Absent'
                          ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${student.full_name} Absent`}
                      accessibilityState={{ selected: selectedStatus === 'Absent' }}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          { color: selectedStatus === 'Absent' ? '#FFFFFF' : '#DC2626' },
                        ]}
                      >
                        Absent
                      </Text>
                    </TouchableOpacity>

                    {/* Excused */}
                    <TouchableOpacity
                      testID={`btn-status-excused-${student.id}`}
                      onPress={() => handleSelectStatus(student.id, 'Excused')}
                      style={[
                        styles.statusButton,
                        selectedStatus === 'Excused'
                          ? { backgroundColor: '#4F46E5', borderColor: '#4F46E5' }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${student.full_name} Excused`}
                      accessibilityState={{ selected: selectedStatus === 'Excused' }}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          { color: selectedStatus === 'Excused' ? '#FFFFFF' : '#4F46E5' },
                        ]}
                      >
                        Excused
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Save Attendance Action */}
        <View style={styles.footerActionContainer}>
          <Button
            label={saving ? 'Saving...' : 'Save Attendance to Local Queue'}
            onPress={handleSaveAttendance}
            disabled={saving || !activeSession || !hasChanges}
            testID="btn-attendance-save"
            variant="primary"
            leftIcon={<Save size={iconSize.md} color="#FFFFFF" />}
            accessibilityLabel="Save attendance records to local offline database"
          />
          <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            Records are persisted safely in local SQLite and will synchronize when online.
          </Text>
        </View>
      </ScrollView>

      {/* QR Scanner Camera Modal (Task 2.4) */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        user={user}
        activeSession={activeSession}
        roster={students}
        attendanceMap={attendanceMap}
        isOffline={isOffline}
        onAttendanceRecorded={handleQRAttendanceRecorded}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  bannerMargin: {
    marginBottom: 12,
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  syncingText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  conflictContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  conflictText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  failureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  failureTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  failureTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  failureSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  unsyncedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  unsyncedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  unsyncedText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D2B47',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  syncNowButtonText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionMargin: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  classPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  groupChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sessionCard: {
    padding: 12,
    marginBottom: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionCol: {
    flex: 1,
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  sessionTime: {
    fontSize: 12,
    marginLeft: 6,
  },
  sessionBadge: {
    backgroundColor: '#0D2B47',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  statNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    padding: 0,
  },
  loader: {
    marginVertical: 40,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  rosterList: {
    marginBottom: 20,
  },
  studentCard: {
    padding: 12,
    marginBottom: 10,
  },
  studentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  beltBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  beltText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusIndicator: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerActionContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  searchAndScanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  qrScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  qrScanButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
