import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Trash2,
  Send,
  ShieldAlert,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { AuthUser } from '../../../types/auth';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { resolveBeltDisplay, BeltLevelConfig, isLightBelt } from '../../../theme/belts';
import {
  curriculumService,
  CurriculumVersion,
} from '../../../services/curriculumService';

export interface CurriculumManagementScreenProps {
  user: AuthUser;
  onBack?: () => void;
  isOffline?: boolean;
}

function formatPublishedDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    return isoString.slice(0, 10);
  } catch {
    return isoString;
  }
}

export const CurriculumManagementScreen: React.FC<CurriculumManagementScreenProps> = ({
  user,
  onBack,
  isOffline,
}) => {
  const { colors, typography, spacing, iconSize } = useTheme();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Versions and active view state
  const [versions, setVersions] = useState<CurriculumVersion[]>([]);
  const [activeCurriculum, setActiveCurriculum] = useState<CurriculumVersion | null>(null);
  const [activeRanks, setActiveRanks] = useState<BeltLevelConfig[]>([]);

  // Selected version being inspected/edited
  const [selectedVersion, setSelectedVersion] = useState<CurriculumVersion | null>(null);
  const [selectedRanks, setSelectedRanks] = useState<BeltLevelConfig[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const orgId = user.organizationId || undefined;
      const [activeRes, versionsRes] = await Promise.all([
        curriculumService.getActiveCurriculum(orgId),
        curriculumService.listVersions(orgId),
      ]);

      setActiveCurriculum(activeRes.curriculum);
      setActiveRanks(activeRes.ranks);
      setVersions(versionsRes.curriculums);

      // Default selection to active curriculum
      setSelectedVersion(activeRes.curriculum);
      setSelectedRanks(activeRes.ranks);
      setError(null);
    } catch (err: any) {
      console.error('[CurriculumManagementScreen] Load error:', err);
      setError(err.message || 'Failed to load Persatuan curriculum.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.organizationId]);

  useEffect(() => {
    let isMounted = true;
    const orgId = user.organizationId || undefined;

    Promise.all([
      curriculumService.getActiveCurriculum(orgId),
      curriculumService.listVersions(orgId),
    ])
      .then(([activeRes, versionsRes]) => {
        if (!isMounted) return;
        setActiveCurriculum(activeRes.curriculum);
        setActiveRanks(activeRes.ranks);
        setVersions(versionsRes.curriculums);
        setSelectedVersion(activeRes.curriculum);
        setSelectedRanks(activeRes.ranks);
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error('[CurriculumManagementScreen] Load error:', err);
        setError(err.message || 'Failed to load Persatuan curriculum.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user.organizationId]);

  const handleSelectVersion = async (version: CurriculumVersion) => {
    try {
      setActionLoading(true);
      const detail = await curriculumService.getVersionById(version.id);
      setSelectedVersion(detail.curriculum);
      setSelectedRanks(detail.ranks);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load version details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDraft = async (cloneFromActive = true) => {
    try {
      setActionLoading(true);
      const cloneId = cloneFromActive && activeCurriculum ? activeCurriculum.id : undefined;
      const res = await curriculumService.createDraft({
        systemName: `Curriculum Syllabus v${versions.length + 1}`,
        martialArtStyle: activeCurriculum?.martial_art_style || 'Silambam',
        cloneFromVersionId: cloneId,
      });

      Alert.alert('Draft Created', `Created draft version v${res.curriculum.version}. You may now customize belt ranks and criteria.`);
      await loadData();
      await handleSelectVersion(res.curriculum);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create draft version.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return;

    Alert.alert(
      'Publish Syllabus Version',
      `Publishing version v${selectedVersion.version} will immediately make it the active official syllabus for all academy branches. Previous published versions will be archived. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish Officially',
          style: 'default',
          onPress: async () => {
            try {
              setActionLoading(true);
              const res = await curriculumService.publishVersion(selectedVersion.id);
              Alert.alert('Published', `Syllabus version v${res.curriculum.version} is now officially published!`);
              await loadData();
            } catch (err: any) {
              Alert.alert('Publication Failed', err.message || 'Could not publish curriculum.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteDraft = async () => {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return;

    Alert.alert(
      'Discard Draft Version',
      `Are you sure you want to delete draft version v${selectedVersion.version}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Draft',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await curriculumService.deleteDraft(selectedVersion.id);
              Alert.alert('Draft Deleted', 'Draft curriculum discarded.');
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete draft.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable testID="curriculum-management-screen">
      <ScreenHeader
        title="Belt Curriculum"
        subtitle="Tenant-Owned Syllabus & Progression System"
        onBack={onBack}
      />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            Loading Persatuan syllabus...
          </Text>
        </View>
      ) : error ? (
        <Card variant="standard" style={{ borderColor: colors.border, backgroundColor: colors.errorBg, marginVertical: spacing.md }}>
          <Text style={[typography.bodyMedium, { color: colors.errorText }]}>{error}</Text>
          <Button label="Retry" onPress={loadData} variant="secondary" size="sm" style={{ marginTop: spacing.sm }} />
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          {/* Governance Notice */}
          <Card variant="standard" style={[styles.governanceCard, { borderColor: colors.border }]}>
            <View style={styles.rowAlign}>
              <ShieldAlert size={20} color={colors.buttonPrimaryBg} />
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.xs, flex: 1 }]}>
                Persatuan Syllabus Governance
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
              Each Persatuan exercises full sovereignty over its martial art syllabus, belt rank requirements, and minimum session criteria. Revisions are versioned; published versions are permanently preserved.
            </Text>
          </Card>

          {/* Active Version Overview Card */}
          {activeCurriculum ? (
            <Card variant="elevated" style={[styles.activeCard, { borderColor: colors.border }]} testID="badge-active-curriculum">
              <View style={styles.activeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '700' }]}>
                    ACTIVE OFFICIAL SYLLABUS
                  </Text>
                  <Text style={[typography.pageTitle, { color: colors.textPrimary, fontSize: 20, marginTop: 2 }]}>
                    {activeCurriculum.system_name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    Style: {activeCurriculum.martial_art_style} • Version {activeCurriculum.version} • {activeRanks.length} Ranks
                  </Text>
                </View>
                <StatusBadge status="PUBLISHED" label="Active" variant="success" />
              </View>

              {activeCurriculum.published_at ? (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  Published on {formatPublishedDate(activeCurriculum.published_at)}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {/* Versions Selector Bar */}
          <Card variant="standard" style={{ borderColor: colors.border }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                Syllabus Versions ({versions.length})
              </Text>
              <Button
                label="+ New Draft"
                onPress={() => handleCreateDraft(true)}
                variant="primary"
                size="sm"
                testID="btn-create-draft"
                disabled={isOffline || actionLoading}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
              <View style={styles.versionChipsRow}>
                {versions.map((ver) => {
                  const isSelected = selectedVersion?.id === ver.id;
                  const isPublished = ver.status === 'PUBLISHED';
                  const isDraft = ver.status === 'DRAFT';

                  return (
                    <TouchableOpacity
                      key={ver.id}
                      onPress={() => handleSelectVersion(ver)}
                      style={[
                        styles.versionChip,
                        {
                          backgroundColor: isSelected ? colors.buttonPrimaryBg : colors.surfaceElevated,
                          borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                        },
                      ]}
                      testID={`curriculum-version-item-${ver.version}`}
                    >
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: isSelected ? colors.buttonPrimaryText : colors.textPrimary,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        v{ver.version} {isPublished ? '★' : isDraft ? '(Draft)' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Card>

          {/* Selected Version Detail Card */}
          {selectedVersion ? (
            <Card variant="elevated" style={{ borderColor: colors.border }}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                    {selectedVersion.system_name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    Version {selectedVersion.version} • Status: {selectedVersion.status}
                  </Text>
                </View>

                <StatusBadge
                  status={selectedVersion.status}
                  label={selectedVersion.status}
                  variant={selectedVersion.status === 'PUBLISHED' ? 'success' : selectedVersion.status === 'DRAFT' ? 'warning' : 'neutral'}
                />
              </View>

              {/* Action Buttons for Draft */}
              {selectedVersion.status === 'DRAFT' ? (
                <View style={[styles.draftActions, { marginTop: spacing.md }]}>
                  <Button
                    label="Publish Officially"
                    onPress={handlePublish}
                    variant="primary"
                    size="md"
                    leftIcon={<Send size={iconSize.sm} color={colors.buttonPrimaryText} />}
                    testID="btn-publish-curriculum"
                    disabled={isOffline || actionLoading}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Discard"
                    onPress={handleDeleteDraft}
                    variant="outline"
                    size="md"
                    leftIcon={<Trash2 size={iconSize.sm} color={colors.buttonDangerText} />}
                    testID="btn-delete-draft"
                    disabled={isOffline || actionLoading}
                  />
                </View>
              ) : null}

              {/* Belt Ranks Progression Table */}
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                  Rank Progression Sequence ({selectedRanks.length} Ranks)
                </Text>

                <View style={{ gap: spacing.xs }}>
                  {selectedRanks.map((rank) => {
                    const display = resolveBeltDisplay(rank.name, selectedRanks);
                    const isDan = rank.isDanRank || rank.danLevel;

                    return (
                      <View
                        key={rank.id || rank.name}
                        style={[
                          styles.rankRow,
                          {
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.border,
                          },
                        ]}
                        testID={`curriculum-rank-item-${rank.order || (rank as any).rank_order}`}
                      >
                        {/* Belt Color Swatch */}
                        <View
                          style={[
                            styles.beltSwatch,
                            {
                              backgroundColor: rank.colorHex || (rank as any).color_hex || '#FFFFFF',
                              borderColor: isLightBelt(rank.colorHex || (rank as any).color_hex) ? '#CBD5E1' : '#000000',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              typography.caption,
                              {
                                color: display.textColor,
                                fontSize: 10,
                                fontWeight: '700',
                              },
                            ]}
                          >
                            {rank.order || (rank as any).rank_order}
                          </Text>
                        </View>

                        {/* Rank Info */}
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <View style={styles.rowAlign}>
                            <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                              {rank.name}
                            </Text>
                            {isDan ? (
                              <View style={[styles.danBadge, { backgroundColor: colors.buttonPrimaryBg }]}>
                                <Text style={styles.danText}>DAN</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                            {rank.description || (rank as any).description || 'Standard syllabus requirements'}
                          </Text>
                        </View>

                        {/* Criteria Badge */}
                        <View style={{ alignItems: 'flex-end', marginLeft: spacing.xs }}>
                          <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600' }]}>
                            RM {(rank.gradingFee || (rank as any).grading_fee || 0)}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]}>
                            {(rank.minMonthsRequired ?? (rank as any).min_months ?? 0)}mo / {(rank.minSessionsRequired ?? (rank as any).min_sessions ?? 0)} sessions
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Card>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  governanceCard: {
    padding: 14,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeCard: {
    padding: 16,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  versionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  draftActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  beltSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  danText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
