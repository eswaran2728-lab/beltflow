import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Upload,
  FileText,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { StitchAppHeader, StitchStatCard } from '../../../components/stitch';
import { StitchTokens } from '../../../theme/tokens';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { OfflineBanner } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import {
  onboardingService,
  AcademyReadinessResponse,
  ImportPreviewResponse,
  CommitImportResponse,
} from '../../../services/onboardingService';
import { useI18n } from '../../../i18n';

export interface AdminAcademySetupScreenProps {
  user?: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
  onBack?: () => void;
  organizationId?: string;
}

const SAMPLE_IMPORT_JSON = JSON.stringify(
  [
    {
      fullName: 'Muhammad Harith Danial',
      icNumber: '110304-10-5566',
      beltRank: 'Yellow Belt',
      className: 'Saturday Silat Youth',
      parentName: 'Encik Danial',
      parentPhone: '0129876543',
      parentEmail: 'danial_p@test.com',
    },
    {
      fullName: 'Nur Aisyah Binti Roslan',
      icNumber: '120915-10-8899',
      beltRank: 'White Belt',
      className: 'Saturday Silat Youth',
      parentName: 'Puan Roslan',
      parentPhone: '0139988776',
      parentEmail: 'roslan_p@test.com',
    },
    {
      fullName: 'Amirul Haziq',
      icNumber: '130404-14-3322',
      beltRank: 'Green Belt',
      className: 'Saturday Silat Youth',
      parentName: 'Encik Haziq',
      parentPhone: '0176655443',
      parentEmail: 'haziq_p@test.com',
    },
  ],
  null,
  2
);

export const AdminAcademySetupScreen: React.FC<AdminAcademySetupScreenProps> = ({
  user,
  isOffline,
  organizationId,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();
  const { t } = useI18n();
  const enumLabel = (key: string, raw: string) => {
    const value = t(key);
    return value === key ? raw : value;
  };

  const targetOrgId = (organizationId || user?.organizationId) ?? undefined;

  const [readiness, setReadiness] = useState<AcademyReadinessResponse | null>(null);
  const [loading, setLoading] = useState(!isOffline);
  const [error, setError] = useState<string | null>(null);

  // Import State
  const [importInput, setImportInput] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResponse | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitImportResponse | null>(null);
  const [showCommitModal, setShowCommitModal] = useState(false);

  const fetchReadiness = useCallback(async () => {
    if (isOffline) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await onboardingService.getAcademyReadiness(targetOrgId);
      setReadiness(res);
    } catch (err: any) {
      setError(err?.message || t('adminOps.setup.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [targetOrgId, isOffline, t]);

  useEffect(() => {
    let isMounted = true;
    if (isOffline) {
      return;
    }
    onboardingService.getAcademyReadiness(targetOrgId)
      .then(res => {
        if (!isMounted) return;
        setReadiness(res);
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err?.message || t('adminOps.setup.loadFailed'));
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetOrgId, isOffline, t]);

  const handleRunPreview = async () => {
    if (!importInput.trim()) {
      Alert.alert(t('adminOps.setup.emptyInputTitle'), t('adminOps.setup.emptyInputMsg'));
      return;
    }

    try {
      setPreviewing(true);
      setCommitResult(null);

      let parsedRows: any[];
      try {
        parsedRows = JSON.parse(importInput.trim());
      } catch {
        const lines = importInput.trim().split('\n').filter(Boolean);
        const headers = lines[0].split(',').map(h => h.trim());
        parsedRows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((h, idx) => {
            obj[h] = vals[idx] || '';
          });
          return obj;
        });
      }

      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        throw new Error(t('adminOps.setup.inputNotArray'));
      }

      const res = await onboardingService.previewImport(parsedRows, 'legacy_onboarding_batch.json');
      setPreviewResult(res);
    } catch (err: any) {
      Alert.alert(t('adminOps.setup.previewFailedTitle'), err?.message || t('adminOps.setup.previewFailedMsg'));
    } finally {
      setPreviewing(false);
    }
  };

  const executeCommit = async () => {
    if (!previewResult || !previewResult.canCommit) {
      Alert.alert(t('adminOps.setup.cannotCommitTitle'), t('adminOps.setup.cannotCommitMsg'));
      return;
    }

    try {
      setCommitting(true);
      const idempotencyKey = `commit_${previewResult.previewId}_${Date.now()}`;
      const res = await onboardingService.commitImport(previewResult.previewId, idempotencyKey);
      setCommitResult(res);
      setPreviewResult(null);
      setShowCommitModal(false);
      setImportInput('');
      fetchReadiness();
    } catch (err: any) {
      Alert.alert(t('adminOps.setup.commitFailedTitle'), err?.message || t('adminOps.setup.commitFailedMsg'));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <ScreenContainer scrollable testID="admin-academy-setup-screen">
      <StitchAppHeader
        dojangName="PERSATUAN DOJANG"
        roleBadgeText="ADMIN PERSATUAN"
        hasUnreadNotifications={false}
      />

      <View style={styles.bodyContent}>
        <Text style={[typography.pageTitle, styles.screenTitle]}>
          {t('adminOps.setup.title')}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
          {t('adminOps.setup.subtitle')}
        </Text>

        {isOffline && (
          <View style={{ marginBottom: spacing.md }}>
            <OfflineBanner
              message={t('adminOps.setup.offline')}
              testID="offline-onboarding-banner"
            />
          </View>
        )}

        {loading && !readiness && !isOffline ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={StitchTokens.colors.brandNavy} />
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              {t('adminOps.setup.evaluating')}
            </Text>
          </View>
        ) : error ? (
          <Card variant="standard" style={{ borderColor: colors.badgeDangerText, marginBottom: spacing.md }}>
            <Text style={[typography.bodyMedium, { color: colors.badgeDangerText }]}>{error}</Text>
            <Button label={t('adminOps.common.retry')} onPress={fetchReadiness} size="sm" style={{ marginTop: spacing.sm }} />
          </Card>
        ) : (
          <>
            {readiness && (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <StitchStatCard
                  label={t('adminOps.setup.readiness')}
                  value={`${readiness.readinessScorePercent}%`}
                  subtext={readiness.isReadyForOperations ? t('adminOps.setup.readyForOps') : t('adminOps.setup.setupPending')}
                  hasAccentBorder
                  accentColor={readiness.isReadyForOperations ? StitchTokens.colors.bfGreen : StitchTokens.colors.colorAccent}
                  style={{ flex: 1 }}
                />
                <StitchStatCard
                  label={t('adminOps.setup.checklist')}
                  value={`${readiness.checklist.filter(i => i.status === 'COMPLETE').length}/${readiness.checklist.length}`}
                  subtext={t('adminOps.setup.completedItems')}
                  hasAccentBorder
                  accentColor={StitchTokens.colors.brandNavy}
                  style={{ flex: 1 }}
                />
              </View>
            )}

            {/* Readiness Score Card */}
            {readiness && (
            <Card
              variant="elevated"
              style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: StitchTokens.colors.brandNavyTint }]}
            >
            <View style={styles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                  {readiness.organizationName}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {t('adminOps.setup.academyMeta', { style: readiness.martialArtStyle, state: readiness.state })}
                </Text>
              </View>
              <StatusBadge
                status={readiness.isReadyForOperations ? 'OPERATIONAL' : 'SETUP_PENDING'}
                label={readiness.isReadyForOperations ? t('adminOps.setup.badgeReady') : t('adminOps.setup.badgePending')}
                variant={readiness.isReadyForOperations ? 'success' : 'warning'}
                testID="badge-readiness-status"
              />
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={[typography.caption, { color: colors.textSecondary }]} testID="readiness-score-value">
                  {t('adminOps.setup.readinessScore', { score: readiness.readinessScorePercent })}
                </Text>
                <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '700' }]}>
                  {t('adminOps.setup.completeCount', {
                    done: readiness.checklist.filter(i => i.status === 'COMPLETE').length,
                    total: readiness.checklist.length,
                  })}
                </Text>
              </View>
              <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${readiness.readinessScorePercent}%`,
                      backgroundColor: readiness.isReadyForOperations ? '#22C55E' : colors.buttonPrimaryBg,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Checklist */}
            <View style={{ marginTop: spacing.md }}>
              {readiness.checklist.map((item, idx) => (
                <View
                  key={item.key || idx}
                  style={[
                    styles.checklistItem,
                    { borderBottomColor: colors.border, borderBottomWidth: idx < readiness.checklist.length - 1 ? 1 : 0 },
                  ]}
                  testID={`checklist-item-${item.key || idx}`}
                >
                  <View style={styles.checkIconCol}>
                    {item.status === 'COMPLETE' ? (
                      <CheckCircle2 size={iconSize.sm} color="#22C55E" />
                    ) : item.status === 'PENDING' ? (
                      <Clock size={iconSize.sm} color={colors.badgeWarningText} />
                    ) : (
                      <ShieldCheck size={iconSize.sm} color={colors.textSecondary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {item.title}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {item.description}
                    </Text>
                  </View>
                  <StatusBadge
                    status={item.status}
                    label={enumLabel(`adminOps.setup.itemStatus.${item.status}`, item.status)}
                    variant={item.status === 'COMPLETE' ? 'success' : item.status === 'PENDING' ? 'warning' : 'neutral'}
                  />
                </View>
              ))}
            </View>
          </Card>
          )}

          {/* Legacy Roster Migration Section */}
          <Card variant="standard" style={[styles.importCard, { borderColor: colors.border }]}>
            <View style={styles.importHeaderRow}>
              <View style={styles.importIconWrap}>
                <Upload size={iconSize.md} color={colors.buttonPrimaryBg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                  {t('adminOps.setup.importTitle')}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {t('adminOps.setup.importDesc')}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginVertical: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setImportInput(SAMPLE_IMPORT_JSON)}
                style={[styles.sampleBtn, { borderColor: colors.buttonPrimaryBg }]}
              >
                <Sparkles size={14} color={colors.buttonPrimaryBg} />
                <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600', marginLeft: 4 }]}>
                  {t('adminOps.setup.loadSample')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setImportInput('');
                  setPreviewResult(null);
                }}
                style={[styles.sampleBtn, { borderColor: colors.border }]}
              >
                <RotateCcw size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
                  {t('adminOps.setup.reset')}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.background,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              multiline
              numberOfLines={8}
              value={importInput}
              onChangeText={setImportInput}
              placeholder={t('adminOps.setup.inputPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              testID="input-import-data"
            />

            <View style={styles.actionRow}>
              <Button
                label={t('adminOps.setup.clear')}
                variant="outline"
                size="sm"
                onPress={() => {
                  setImportInput('');
                  setPreviewResult(null);
                }}
                disabled={previewing || committing}
              />
              <Button
                label={previewing ? t('adminOps.setup.validating') : t('adminOps.setup.previewDryRun')}
                onPress={handleRunPreview}
                disabled={previewing || committing || isOffline}
                leftIcon={previewing ? <ActivityIndicator size="small" color="#fff" /> : <FileText size={iconSize.sm} color="#fff" />}
                testID="btn-dry-run-preview"
              />
            </View>
          </Card>

          {/* Dry Run Preview Results */}
          {previewResult && (
            <Card variant="elevated" style={[styles.previewCard, { borderColor: colors.border }]} testID="import-preview-card">
              <View style={styles.previewHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {t('adminOps.setup.previewTitle')}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('adminOps.setup.previewBatch', { id: previewResult.previewId })}
                  </Text>
                </View>
                <StatusBadge
                  status={previewResult.canCommit ? 'READY' : 'BLOCKED'}
                  label={previewResult.canCommit ? t('adminOps.setup.badgeCanCommit') : t('adminOps.setup.badgeBlocked')}
                  variant={previewResult.canCommit ? 'success' : 'danger'}
                  testID="badge-preview-committable"
                />
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={[styles.statBox, { backgroundColor: colors.background }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('adminOps.setup.totalRows')}</Text>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]} testID="preview-total-rows">
                    {previewResult.totalRows}
                  </Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.background }]}>
                  <Text style={[typography.caption, { color: '#22C55E' }]}>{t('adminOps.setup.validRows')}</Text>
                  <Text style={[typography.sectionHeading, { color: '#22C55E' }]} testID="preview-valid-rows">
                    {previewResult.validRowsCount}
                  </Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.background }]}>
                  <Text style={[typography.caption, { color: colors.badgeWarningText }]}>{t('adminOps.setup.duplicates')}</Text>
                  <Text style={[typography.sectionHeading, { color: colors.badgeWarningText }]}>
                    {previewResult.duplicateRowsCount}
                  </Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.background }]}>
                  <Text style={[typography.caption, { color: colors.badgeDangerText }]}>{t('adminOps.setup.errors')}</Text>
                  <Text style={[typography.sectionHeading, { color: colors.badgeDangerText }]} testID="preview-invalid-rows">
                    {previewResult.malformedRowsCount + previewResult.wrongTenantRowsCount + previewResult.unverifiedParentRowsCount}
                  </Text>
                </View>
              </View>

              {/* Row Preview List */}
              {previewResult.previewRows && previewResult.previewRows.length > 0 && (
                <View style={{ marginTop: spacing.sm, gap: 6 }}>
                  {previewResult.previewRows.map(row => (
                    <View
                      key={row.rowIndex}
                      style={[
                        styles.previewRowItem,
                        {
                          backgroundColor: colors.background,
                          borderColor: row.status === 'VALID' ? '#22C55E' : '#EF4444',
                        },
                      ]}
                      testID={`preview-row-${row.rowIndex}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                          {t('adminOps.setup.rowTitle', { index: row.rowIndex, name: row.data?.fullName || t('adminOps.setup.unknownStudent') })}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {t('adminOps.setup.rowDetails', {
                            ic: row.data?.icNumber || '-',
                            rank: row.data?.beltRank || '-',
                            guardian: row.data?.parentName || '-',
                          })}
                        </Text>
                        {row.errorMessage && (
                          <Text style={[typography.caption, { color: '#EF4444', marginTop: 2, fontWeight: '600' }]}>
                            {t('adminOps.setup.rowError', { message: row.errorMessage })}
                          </Text>
                        )}
                      </View>
                      <StatusBadge
                        status={row.status}
                        label={enumLabel(`adminOps.setup.rowStatus.${row.status}`, row.status)}
                        variant={row.status === 'VALID' ? 'success' : 'danger'}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* Warnings / Errors */}
              {previewResult.errors.length > 0 && (
                <View style={[styles.errorSection, { backgroundColor: '#FEE2E2', borderColor: '#F87171' }]}>
                  <Text style={[typography.caption, { color: '#991B1B', fontWeight: '700', marginBottom: 4 }]}>
                    {t('adminOps.setup.warningsTitle', { count: previewResult.errors.length })}
                  </Text>
                  {previewResult.errors.map((err, i) => (
                    <Text key={i} style={[typography.caption, { color: '#B91C1C', marginTop: 2 }]}>
                      {t('adminOps.setup.warningItem', {
                        index: err.rowIndex,
                        status: enumLabel(`adminOps.setup.rowStatus.${err.status}`, err.status),
                        error: err.error,
                      })}
                    </Text>
                  ))}
                </View>
              )}

              {/* Commit Button */}
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label={committing ? t('adminOps.setup.committing') : t('adminOps.setup.commitVerified', { count: previewResult.validRowsCount })}
                  onPress={() => setShowCommitModal(true)}
                  disabled={committing || !previewResult.canCommit || isOffline}
                  variant="primary"
                  leftIcon={committing ? <ActivityIndicator size="small" color="#fff" /> : <Check size={iconSize.sm} color="#fff" />}
                  testID="btn-open-commit-modal"
                />
              </View>
            </Card>
          )}

          {/* Modal / Confirmation Box for Commit */}
          {showCommitModal && previewResult && (
            <View style={styles.modalOverlay} testID="import-commit-modal">
              <Card variant="elevated" style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                  {t('adminOps.setup.confirmTitle')}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 8 }]}>
                  {t('adminOps.setup.confirmBody', { count: previewResult.validRowsCount })}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                  <Button
                    label={t('adminOps.common.cancel')}
                    variant="outline"
                    size="sm"
                    onPress={() => setShowCommitModal(false)}
                  />
                  <Button
                    label={t('adminOps.setup.commitImport')}
                    variant="primary"
                    size="sm"
                    onPress={executeCommit}
                    testID="btn-confirm-commit-import"
                  />
                </View>
              </Card>
            </View>
          )}

          {/* Commit Success Confirmation */}
          {commitResult && (
            <Card variant="standard" style={[styles.successCard, { borderColor: '#22C55E', backgroundColor: '#F0FDF4' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CheckCircle2 size={iconSize.md} color="#22C55E" style={{ marginRight: spacing.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: '#166534' }]}>
                    {t('adminOps.setup.successTitle')}
                  </Text>
                  <Text style={[typography.caption, { color: '#15803D', marginTop: 2 }]}>
                    {t('adminOps.setup.batchId', { id: commitResult.batchId })}
                  </Text>
                </View>
              </View>
              <Text style={[typography.bodyMedium, { color: '#166534', marginTop: spacing.sm }]}>
                {commitResult.message}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                <Text style={[typography.caption, { color: '#15803D', marginRight: spacing.md }]}>
                  {t('adminOps.setup.studentsCount', { count: commitResult.importedStudentsCount })}
                </Text>
                <Text style={[typography.caption, { color: '#15803D', marginRight: spacing.md }]}>
                  {t('adminOps.setup.guardiansCount', { count: commitResult.importedGuardiansCount })}
                </Text>
                <Text style={[typography.caption, { color: '#15803D' }]}>
                  {t('adminOps.setup.ranksCount', { count: commitResult.importedRanksCount })}
                </Text>
              </View>
            </Card>
          )}
        </>
      )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  screenTitle: {
    color: StitchTokens.colors.brandNavy,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  centerBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCard: {
    marginBottom: 16,
    padding: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkIconCol: {
    marginRight: 12,
  },
  importCard: {
    marginBottom: 16,
    padding: 16,
  },
  importHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  importIconWrap: {
    marginRight: 12,
  },
  sampleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  previewCard: {
    marginBottom: 16,
    padding: 16,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorSection: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 100,
  },
  modalCard: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
  },
  successCard: {
    marginBottom: 16,
    padding: 16,
  },
});
