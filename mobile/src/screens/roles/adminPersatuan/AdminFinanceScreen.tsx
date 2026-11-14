import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Building2,
  FileCheck2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { StatCard } from '../../../components/StatCard';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { OfflineBanner } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import {
  paymentGatewayService,
  AdminMerchantConfig,
  ReconciliationRecord,
} from '../../../services/paymentGatewayService';
import { StitchAppHeader, StitchStatCard } from '../../../components/stitch';
import { StitchTokens } from '../../../theme/tokens';
import { useI18n } from '../../../i18n';

export interface AdminFinanceScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export const AdminFinanceScreen: React.FC<AdminFinanceScreenProps> = ({
  user,
  onLogout,
  isOffline,
  navigation,
}) => {
  const { colors, typography, spacing } = useTheme();
  const { t } = useI18n();

  const [loading, setLoading] = useState<boolean>(!isOffline);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Merchant config
  const [merchant, setMerchant] = useState<AdminMerchantConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [showConfigForm, setShowConfigForm] = useState<boolean>(false);

  // Edit form state
  const [merchantAccountId, setMerchantAccountId] = useState<string>('');
  const [merchantName, setMerchantName] = useState<string>('');
  const [settlementBankName, setSettlementBankName] = useState<string>('');
  const [settlementAccountNumber, setSettlementAccountNumber] = useState<string>('');
  const [fpxEnabled, setFpxEnabled] = useState<boolean>(true);
  const [duitnowEnabled, setDuitnowEnabled] = useState<boolean>(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Reconciliation records
  const [reconciliationRecords, setReconciliationRecords] = useState<ReconciliationRecord[]>([]);

  // Active view tab: 'MERCHANT' | 'RECONCILIATION'
  const [activeTab, setActiveTab] = useState<'MERCHANT' | 'RECONCILIATION'>('MERCHANT');

  const loadFinanceData = useCallback(async () => {
    if (isOffline) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [mRes, recRes] = await Promise.all([
        paymentGatewayService.getAdminMerchantConfig().catch(() => ({ configured: false, merchant: null })),
        paymentGatewayService.getReconciliationRecords().catch(() => ({ reconciliationRecords: [] })),
      ]);

      setIsConfigured(mRes.configured);
      if (mRes.merchant) {
        setMerchant(mRes.merchant);
        setMerchantAccountId(mRes.merchant.merchant_account_id);
        setMerchantName(mRes.merchant.merchant_name);
        setSettlementBankName(mRes.merchant.settlement_bank_name || '');
        setFpxEnabled(mRes.merchant.fpx_enabled);
        setDuitnowEnabled(mRes.merchant.duitnow_enabled);
      }

      setReconciliationRecords(recRes.reconciliationRecords || []);
    } catch (err: any) {
      console.error('[Admin Finance Load error]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOffline]);

  useEffect(() => {
    let isMounted = true;
    if (isOffline) {
      return;
    }

    Promise.all([
      paymentGatewayService.getAdminMerchantConfig().catch(() => ({ configured: false, merchant: null })),
      paymentGatewayService.getReconciliationRecords().catch(() => ({ reconciliationRecords: [] })),
    ])
      .then(([mRes, recRes]) => {
        if (!isMounted) return;
        setIsConfigured(mRes.configured);
        if (mRes.merchant) {
          setMerchant(mRes.merchant);
          setMerchantAccountId(mRes.merchant.merchant_account_id);
          setMerchantName(mRes.merchant.merchant_name);
          setSettlementBankName(mRes.merchant.settlement_bank_name || '');
          setFpxEnabled(mRes.merchant.fpx_enabled);
          setDuitnowEnabled(mRes.merchant.duitnow_enabled);
        }
        setReconciliationRecords(recRes.reconciliationRecords || []);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error('[Admin Finance Load error]', err);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOffline]);

  const handleSaveMerchantConfig = async () => {
    if (!merchantAccountId.trim() || !merchantName.trim()) {
      Alert.alert(t('adminHome.finance.validationTitle'), t('adminHome.finance.validationMessage'));
      return;
    }

    try {
      setSavingConfig(true);
      const res = await paymentGatewayService.saveAdminMerchantConfig({
        merchantAccountId: merchantAccountId.trim(),
        merchantName: merchantName.trim(),
        provider: 'SANDBOX',
        settlementBankName: settlementBankName.trim() || undefined,
        settlementAccountNumber: settlementAccountNumber.trim() || undefined,
        fpxEnabled,
        duitnowEnabled,
      });

      setMerchant(res.merchant);
      setIsConfigured(true);
      setShowConfigForm(false);
      setSettlementAccountNumber(''); // Never keep plaintext account in form
      Alert.alert(t('adminHome.finance.savedTitle'), t('adminHome.finance.savedMessage'));
    } catch (err: any) {
      Alert.alert(t('adminHome.finance.saveFailedTitle'), err.message || t('adminHome.finance.saveFailedMessage'));
    } finally {
      setSavingConfig(false);
    }
  };

  const discrepancyCount = reconciliationRecords.filter(r => r.match_status.startsWith('DISCREPANCY')).length;
  const matchedCount = reconciliationRecords.filter(r => r.match_status === 'MATCHED').length;

  if (loading && !refreshing) {
    return (
      <ScreenContainer scrollable testID="admin-finance-screen">
        <ScreenHeader title={t('adminHome.finance.loadingTitle')} subtitle={t('adminHome.finance.loadingSubtitle')} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('adminHome.finance.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="admin-finance-screen" style={{ backgroundColor: colors.background }}>
      {/* Stitch App Header */}
      <StitchAppHeader
        roleBadgeText="ADMIN PERSATUAN"
        dojangName="PERSATUAN DOJANG"
      />

      <ScreenHeader
        title={t('adminHome.finance.title')}
        subtitle={t('adminHome.finance.subtitle')}
        rightAction={
          <TouchableOpacity
            onPress={loadFinanceData}
            style={[styles.refreshButton, { borderColor: colors.border }]}
            accessibilityLabel={t('adminHome.finance.refresh')}
          >
            <RefreshCw size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />

      {isOffline && (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner message={t('adminHome.finance.offline')} />
        </View>
      )}

      {/* KPI Overview Grid */}
      <View style={[styles.statsRow, { marginBottom: spacing.md }]}>
        <StitchStatCard
          label={t('adminHome.finance.statSettlements')}
          value={matchedCount}
          subtext={t('adminHome.finance.statReconciled')}
          hasAccentBorder
          accentColor={StitchTokens.colors.bfGreen}
          testID="stat-matched-settlements"
          style={{ flex: 1, marginRight: spacing.xs }}
        />
        <StitchStatCard
          label={t('adminHome.finance.statDiscrepancies')}
          value={discrepancyCount}
          subtext={discrepancyCount > 0 ? t('adminHome.finance.requiresReview') : t('adminHome.finance.zeroDiscrepancies')}
          hasAccentBorder
          accentColor={discrepancyCount > 0 ? StitchTokens.colors.bfRed : StitchTokens.colors.colorAccent}
          testID="stat-discrepancies"
          style={{ flex: 1, marginLeft: spacing.xs }}
        />
      </View>

      {/* Navigation Tabs */}
      <View style={[styles.tabBar, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('MERCHANT')}
          style={[
            styles.tabItem,
            activeTab === 'MERCHANT' && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 2 },
          ]}
          testID="tab-merchant-config"
        >
          <Text
            style={[
              typography.bodyMedium,
              { color: activeTab === 'MERCHANT' ? colors.buttonPrimaryBg : colors.textSecondary, fontWeight: '700' },
            ]}
          >
            {t('adminHome.finance.tabMerchant')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('RECONCILIATION')}
          style={[
            styles.tabItem,
            activeTab === 'RECONCILIATION' && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 2 },
          ]}
          testID="tab-reconciliation"
        >
          <Text
            style={[
              typography.bodyMedium,
              { color: activeTab === 'RECONCILIATION' ? colors.buttonPrimaryBg : colors.textSecondary, fontWeight: '700' },
            ]}
          >
            {t('adminHome.finance.tabLedger', { count: reconciliationRecords.length })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: MERCHANT ONBOARDING & CONFIGURATION */}
      {activeTab === 'MERCHANT' && (
        <View>
          <Card
            variant="elevated"
            style={[
              styles.merchantStatusCard,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginBottom: spacing.md },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Building2 size={22} color={colors.buttonPrimaryBg} />
                <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '700' }]}>
                  {t('adminHome.finance.directMerchant')}
                </Text>
              </View>
              <StatusBadge
                status={isConfigured ? 'ACTIVE' : 'UNCONFIGURED'}
                label={isConfigured ? t('adminHome.finance.activeGateway') : t('adminHome.finance.notConfigured')}
                variant={isConfigured ? 'success' : 'danger'}
              />
            </View>

            {isConfigured && merchant ? (
              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                <View style={styles.detailRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('adminHome.finance.provider')}</Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} testID="merchant-provider-value">
                    {merchant.provider}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('adminHome.finance.accountId')}</Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} testID="merchant-account-id-value">
                    {merchant.merchant_account_id}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('adminHome.finance.registeredName')}</Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                    {merchant.merchant_name}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('adminHome.finance.settlementBank')}</Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}>
                    {merchant.settlement_bank_name || t('adminHome.finance.notSpecified')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('adminHome.finance.maskedAccount')}</Text>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]} testID="merchant-masked-account">
                    {merchant.settlement_account_masked || t('adminHome.finance.none')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('adminHome.finance.rails')}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {merchant.fpx_enabled && <StatusBadge status="FPX" label={t('adminHome.finance.railFpx')} variant="info" />}
                    {merchant.duitnow_enabled && <StatusBadge status="DUITNOW" label={t('adminHome.finance.railDuitnow')} variant="info" />}
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                  {t('adminHome.finance.unconfiguredNotice')}
                </Text>
              </View>
            )}

            <Button
              label={showConfigForm ? t('adminHome.finance.cancelEditing') : isConfigured ? t('adminHome.finance.editSettings') : t('adminHome.finance.configureGateway')}
              onPress={() => setShowConfigForm(!showConfigForm)}
              variant={showConfigForm ? 'outline' : 'secondary'}
              size="sm"
              style={{ marginTop: spacing.md }}
              testID="btn-toggle-config-form"
            />
          </Card>

          {/* Configuration Form */}
          {showConfigForm && (
            <Card
              variant="elevated"
              style={[
                styles.formCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginBottom: spacing.lg },
              ]}
              testID="merchant-config-form"
            >
              <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.xs }]}>
                {t('adminHome.finance.formTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                {t('adminHome.finance.formNotice')}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
                  {t('adminHome.finance.fieldAccountId')}
                </Text>
                <TextInput
                  value={merchantAccountId}
                  onChangeText={setMerchantAccountId}
                  placeholder={t('adminHome.finance.placeholderAccountId')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  testID="input-merchant-account-id"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
                  {t('adminHome.finance.fieldMerchantName')}
                </Text>
                <TextInput
                  value={merchantName}
                  onChangeText={setMerchantName}
                  placeholder={t('adminHome.finance.placeholderMerchantName')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  testID="input-merchant-name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
                  {t('adminHome.finance.fieldBankName')}
                </Text>
                <TextInput
                  value={settlementBankName}
                  onChangeText={setSettlementBankName}
                  placeholder={t('adminHome.finance.placeholderBankName')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }]}>
                  {t('adminHome.finance.fieldAccountNumber')}
                </Text>
                <TextInput
                  value={settlementAccountNumber}
                  onChangeText={setSettlementAccountNumber}
                  placeholder={t('adminHome.finance.placeholderAccountNumber')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  testID="input-account-number"
                />
              </View>

              <Button
                label={savingConfig ? t('adminHome.finance.saving') : t('adminHome.finance.save')}
                onPress={handleSaveMerchantConfig}
                variant="primary"
                size="md"
                disabled={savingConfig || isOffline}
                fullWidth
                style={{ marginTop: spacing.md }}
                testID="btn-save-merchant-config"
              />
            </Card>
          )}
        </View>
      )}

      {/* TAB 2: AUDITED RECONCILIATION LEDGER */}
      {activeTab === 'RECONCILIATION' && (
        <View>
          {reconciliationRecords.length === 0 ? (
            <Card variant="standard" style={{ padding: spacing.lg, alignItems: 'center' }}>
              <FileCheck2 size={40} color="#10B981" />
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
                {t('adminHome.finance.emptyTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                {t('adminHome.finance.emptyMessage')}
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {reconciliationRecords.map(rec => {
                const isMatched = rec.match_status === 'MATCHED';
                return (
                  <Card
                    key={rec.id}
                    variant="standard"
                    style={[
                      styles.recCard,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: isMatched ? colors.border : '#EF4444',
                      },
                    ]}
                    testID={`rec-record-${rec.id}`}
                  >
                    <View style={styles.recHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        {isMatched ? (
                          <CheckCircle size={18} color="#10B981" />
                        ) : (
                          <AlertTriangle size={18} color="#EF4444" />
                        )}
                        <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: 6, fontWeight: '700' }]}>
                          {rec.student_name}
                        </Text>
                      </View>
                      <StatusBadge
                        status={rec.match_status}
                        label={isMatched ? t('adminHome.finance.matched') : t('adminHome.finance.discrepancy')}
                        variant={isMatched ? 'success' : 'danger'}
                      />
                    </View>

                    <View style={{ marginTop: spacing.xs, gap: 2 }}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        {t('adminHome.finance.expected')} <Text style={{ color: colors.textPrimary }}>RM {(rec.expected_amount_cents / 100).toFixed(2)}</Text> • {t('adminHome.finance.settled')} <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>RM {(rec.settled_amount_cents / 100).toFixed(2)}</Text>
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        {t('adminHome.finance.providerRef', { ref: rec.provider_tx_id })}
                      </Text>
                      {rec.receipt_no && (
                        <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '700' }]}>
                          {t('adminHome.finance.digitalReceipt', { receipt: rec.receipt_no })}
                        </Text>
                      )}
                      {rec.notes && (
                        <Text style={[typography.caption, { color: isMatched ? colors.textMuted : '#DC2626', fontStyle: 'italic', marginTop: 2 }]}>
                          {t('adminHome.finance.notes', { notes: rec.notes })}
                        </Text>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
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
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  merchantStatusCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  recCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  recHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
