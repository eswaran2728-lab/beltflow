import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import {
  CreditCard,
  Building2,
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Receipt,
  FileText,
} from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../../components/Layout';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { StatusBadge } from '../../../components/Badges';
import { PendingNextStep } from '../../../components/PendingNextStep';
import { OfflineBanner } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import {
  paymentGatewayService,
  MaskedMerchantConfig,
  PaymentIntentDetails,
  MALAYSIAN_FPX_BANKS,
} from '../../../services/paymentGatewayService';
import { apiClient } from '../../../services/apiClient';
import { onboardingService, FamilySummary } from '../../../services/onboardingService';
import { useI18n } from '../../../i18n';

export interface ParentFeesPaymentScreenProps {
  user: AuthUser;
  onLogout?: () => void;
  isOffline?: boolean;
  navigation?: any;
}

export interface StudentDueItem {
  id: string;
  class_id: string;
  student_id: string;
  billing_month: string;
  fee_amount: number;
  amount_paid: number;
  status: 'Pending' | 'Partially Paid' | 'Paid';
}

export interface StudentPaymentHistoryItem {
  id: string;
  receipt_no: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  is_online_gateway?: boolean;
}

export const ParentFeesPaymentScreen: React.FC<ParentFeesPaymentScreenProps> = ({
  user,
  isOffline,
}) => {
  const { colors, typography, spacing } = useTheme();
  const { t } = useI18n();

  const [loading, setLoading] = useState<boolean>(!isOffline);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const [merchantConfig, setMerchantConfig] = useState<MaskedMerchantConfig | null>(null);
  const [merchantConfigured, setMerchantConfigured] = useState<boolean>(false);
  const [familySummary, setFamilySummary] = useState<FamilySummary | null>(null);

  const [dues, setDues] = useState<StudentDueItem[]>([]);
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([]);
  const [history, setHistory] = useState<StudentPaymentHistoryItem[]>([]);

  // Checkout states
  const [paymentMethod, setPaymentMethod] = useState<'FPX' | 'DUITNOW_QR'>('FPX');
  const [selectedBankCode, setSelectedBankCode] = useState<string>('MBB0227');
  const [activeIntent, setActiveIntent] = useState<PaymentIntentDetails | null>(null);
  const [initiatingPayment, setInitiatingPayment] = useState<boolean>(false);
  const [pollingStatus, setPollingStatus] = useState<boolean>(false);

  // Active view tab: 'DUES' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<'DUES' | 'HISTORY'>('DUES');

  const loadChildFinances = useCallback(async (studentId: string) => {
    try {
      const [duesRes, payRes] = await Promise.all([
        apiClient.get<any>(`/billing/student/${studentId}`).catch(() => ({ dues: [] })),
        apiClient.get<any>(`/payments?studentId=${studentId}`).catch(() => ({ payments: [] })),
      ]);

      const duesList: StudentDueItem[] = duesRes.dues || duesRes || [];
      const historyList: StudentPaymentHistoryItem[] = payRes.payments || payRes || [];

      setDues(duesList);
      setHistory(historyList);

      // Auto-select unpaid dues
      const unpaid = duesList.filter(d => d.status !== 'Paid').map(d => d.id);
      setSelectedDueIds(unpaid);
    } catch (err) {
      console.error('[Load Child Finances error]', err);
    }
  }, []);

  // Load children for this parent
  const loadParentData = useCallback(async () => {
    if (isOffline) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch parent dashboard data and family summary
      const [dashRes, familyRes] = await Promise.all([
        apiClient.get<any>('/dashboard/parent').catch(() => ({ children: [] })),
        onboardingService.getFamilySummary().catch(() => null),
      ]);
      if (familyRes) {
        setFamilySummary(familyRes);
      }
      const kids = dashRes.children || [];
      setChildren(kids);

      const activeId = kids.length > 0 ? kids[0].id : null;
      if (activeId) {
        setSelectedChildId(prev => prev || activeId);
        await loadChildFinances(activeId);
      }

      // Fetch merchant config
      if (user.organizationId) {
        const mRes = await paymentGatewayService.getMerchantConfig(user.organizationId);
        setMerchantConfigured(mRes.configured);
        setMerchantConfig(mRes.merchant || null);
      }
    } catch (err: any) {
      console.error('[Load Parent Data error]', err);
    } finally {
      setLoading(false);
    }
  }, [user.organizationId, isOffline, loadChildFinances]);

  useEffect(() => {
    let isMounted = true;
    if (isOffline) {
      return;
    }

    Promise.all([
      apiClient.get<any>('/dashboard/parent').catch(() => ({ children: [] })),
      onboardingService.getFamilySummary().catch(() => null),
    ])
      .then(async ([dashRes, familyRes]) => {
        if (!isMounted) return;
        if (familyRes) {
          setFamilySummary(familyRes);
        }
        const kids = dashRes.children || [];
        setChildren(kids);

        const activeId = kids.length > 0 ? kids[0].id : null;
        if (activeId) {
          setSelectedChildId(prev => prev || activeId);
          await loadChildFinances(activeId);
        }

        if (user.organizationId) {
          const mRes = await paymentGatewayService.getMerchantConfig(user.organizationId);
          if (!isMounted) return;
          setMerchantConfigured(mRes.configured);
          setMerchantConfig(mRes.merchant || null);
        }
        setLoading(false);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('[Load Parent Data error]', err);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user.organizationId, isOffline, loadChildFinances]);

  const handleSelectChild = async (childId: string) => {
    setSelectedChildId(childId);
    setActiveIntent(null);
    await loadChildFinances(childId);
  };

  const toggleSelectDue = (id: string) => {
    if (selectedDueIds.includes(id)) {
      setSelectedDueIds(selectedDueIds.filter(x => x !== id));
    } else {
      setSelectedDueIds([...selectedDueIds, id]);
    }
  };

  // Calculate selected total
  const selectedDuesList = dues.filter(d => selectedDueIds.includes(d.id));
  const totalAmountRM = selectedDuesList.reduce((acc, d) => {
    const remaining = Math.max(0, Number(d.fee_amount) - Number(d.amount_paid));
    return acc + remaining;
  }, 0);

  // Initiate Online Payment Intent
  const handleInitiatePayment = async () => {
    if (!selectedChildId || selectedDueIds.length === 0) {
      Alert.alert(t('parentHome.fees.selectionRequiredTitle'), t('parentHome.fees.selectionRequiredMsg'));
      return;
    }

    if (!merchantConfigured) {
      Alert.alert(
        t('parentHome.fees.gatewayNotConfiguredTitle'),
        t('parentHome.fees.gatewayNotConfiguredMsg')
      );
      return;
    }

    try {
      setInitiatingPayment(true);
      const res = await paymentGatewayService.createPaymentIntent({
        studentId: selectedChildId,
        billingMonthIds: selectedDueIds,
        paymentMethod,
        fpxBankCode: paymentMethod === 'FPX' ? selectedBankCode : undefined,
        idempotencyKey: `pay_${selectedChildId}_${Date.now()}`,
      });

      setActiveIntent(res.intent);

      // Open checkout session if available
      if (res.intent.providerSessionUrl) {
        Linking.canOpenURL(res.intent.providerSessionUrl).then(supported => {
          if (supported) {
            Linking.openURL(res.intent.providerSessionUrl);
          }
        });
      }
    } catch (err: any) {
      Alert.alert(t('parentHome.fees.initiationFailedTitle'), err.message || t('parentHome.fees.initiationFailedMsg'));
    } finally {
      setInitiatingPayment(false);
    }
  };

  // Refresh status of active payment intent
  const handleCheckPaymentStatus = async () => {
    if (!activeIntent) return;
    try {
      setPollingStatus(true);
      const res = await paymentGatewayService.getPaymentIntent(activeIntent.id);
      setActiveIntent(res.intent);

      if (res.intent.status === 'SUCCEEDED') {
        // Refresh child finance data
        if (selectedChildId) {
          await loadChildFinances(selectedChildId);
        }
      }
    } catch (err: any) {
      console.error('[Check Payment Status error]', err);
    } finally {
      setPollingStatus(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer scrollable testID="parent-fees-payment-screen">
        <ScreenHeader title={t('parentHome.fees.loadingTitle')} subtitle={t('parentHome.fees.loadingSubtitle')} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('parentHome.fees.loading')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="parent-fees-payment-screen">
      <ScreenHeader
        title={t('parentHome.fees.title')}
        subtitle={t('parentHome.fees.subtitle')}
        rightAction={
          <TouchableOpacity
            onPress={loadParentData}
            style={[styles.refreshButton, { borderColor: colors.border }]}
            accessibilityLabel={t('parentHome.fees.refreshA11y')}
          >
            <RefreshCw size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />

      {isOffline && (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner message={t('parentHome.fees.offline')} />
        </View>
      )}

      {/* Linked Children Selector */}
      {children.length > 1 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
            {t('parentHome.fees.selectStudent')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            {children.map(child => {
              const isSelected = child.id === selectedChildId;
              return (
                <TouchableOpacity
                  key={child.id}
                  onPress={() => handleSelectChild(child.id)}
                  style={[
                    styles.childPill,
                    {
                      backgroundColor: isSelected ? colors.buttonPrimaryBg : colors.surfaceElevated,
                      borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                      marginRight: spacing.sm,
                    },
                  ]}
                  testID={`child-pill-${child.id}`}
                >
                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary, fontWeight: isSelected ? '700' : '500' },
                    ]}
                  >
                    {child.fullName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Multi-Persatuan Cross-Merchant Separation Banner */}
      {familySummary?.hasCrossMerchantChildren && (
        <Card
          variant="elevated"
          style={[
            styles.merchantBanner,
            {
              backgroundColor: '#FFFBEB',
              borderColor: '#F59E0B',
              marginBottom: spacing.md,
            },
          ]}
          testID="cross-merchant-warning-banner"
        >
          <View style={styles.bannerRow}>
            <Building2 size={24} color="#D97706" />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.titleMedium, { color: '#92400E', fontWeight: '700' }]}>
                {t('parentHome.fees.crossMerchantTitle')}
              </Text>
              <Text style={[typography.caption, { color: '#B45309', marginTop: 2 }]}>
                {t('parentHome.fees.crossMerchantBody')}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Persatuan Direct Merchant Routing Notice */}
      <Card
        variant="elevated"
        style={[
          styles.merchantBanner,
          {
            backgroundColor: merchantConfigured ? colors.surfaceElevated : '#FEF2F2',
            borderColor: merchantConfigured ? colors.border : '#F87171',
            marginBottom: spacing.md,
          },
        ]}
        testID="merchant-direct-card"
      >
        <View style={styles.bannerRow}>
          <Building2 size={24} color={merchantConfigured ? colors.buttonPrimaryBg : '#EF4444'} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
              {merchantConfigured && merchantConfig
                ? merchantConfig.merchantName
                : t('parentHome.fees.notConfiguredTitle')}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {merchantConfigured && merchantConfig
                ? t('parentHome.fees.fundsRoute', { bank: merchantConfig.settlementBankName || t('parentHome.fees.bankFallback'), account: merchantConfig.settlementAccountMasked || '' })
                : t('parentHome.fees.notConfiguredBody')}
            </Text>
          </View>
          <StatusBadge
            status={merchantConfigured ? 'ACTIVE' : 'UNCONFIGURED'}
            label={merchantConfigured ? t('parentHome.fees.badgeDirect') : t('parentHome.fees.badgeOffline')}
            variant={merchantConfigured ? 'success' : 'danger'}
          />
        </View>
      </Card>

      {/* Active Payment Intent Tracking Modal / Card */}
      {activeIntent && (
        <Card
          variant="elevated"
          style={[
            styles.activeIntentCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor:
                activeIntent.status === 'SUCCEEDED'
                  ? '#10B981'
                  : activeIntent.status === 'FAILED'
                  ? '#EF4444'
                  : colors.buttonPrimaryBg,
              marginBottom: spacing.md,
            },
          ]}
          testID="active-intent-card"
        >
          <View style={styles.intentHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {activeIntent.status === 'SUCCEEDED' ? (
                <CheckCircle2 size={24} color="#10B981" />
              ) : activeIntent.status === 'FAILED' ? (
                <XCircle size={24} color="#EF4444" />
              ) : (
                <Clock size={24} color={colors.buttonPrimaryBg} />
              )}
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.xs, fontWeight: '700' }]}>
                {activeIntent.status === 'SUCCEEDED'
                  ? t('parentHome.fees.intentConfirmed')
                  : activeIntent.status === 'FAILED'
                  ? t('parentHome.fees.intentFailed')
                  : activeIntent.status === 'EXPIRED'
                  ? t('parentHome.fees.intentExpired')
                  : t('parentHome.fees.intentPending')}
              </Text>
            </View>
            <StatusBadge
              status={activeIntent.status}
              label={activeIntent.status}
              variant={
                activeIntent.status === 'SUCCEEDED'
                  ? 'success'
                  : activeIntent.status === 'FAILED'
                  ? 'danger'
                  : 'warning'
              }
            />
          </View>

          <View style={[styles.intentDetails, { marginTop: spacing.sm }]}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {t('parentHome.fees.amountPayable')} <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>RM {activeIntent.amountRM}</Text> {t('parentHome.fees.amountSen', { cents: activeIntent.amountCents })}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {t('parentHome.fees.method')} <Text style={{ color: colors.textPrimary }}>{activeIntent.paymentMethod === 'FPX' ? t('parentHome.fees.fpx') : t('parentHome.fees.duitnow')}</Text>
            </Text>
            {activeIntent.receiptNo ? (
              <View style={[styles.receiptHighlight, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                <Receipt size={18} color="#059669" />
                <Text style={[typography.bodyMedium, { color: '#065F46', marginLeft: spacing.xs, fontWeight: '700' }]}>
                  {t('parentHome.fees.officialReceipt', { receipt: activeIntent.receiptNo })}
                </Text>
              </View>
            ) : null}
          </View>

          <PendingNextStep kind="PAYMENT" status={activeIntent.status} testID="payment-next-step" />

          {activeIntent.status === 'PENDING_PROCESSING' && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Button
                label={pollingStatus ? t('parentHome.fees.checkingStatus') : t('parentHome.fees.checkStatus')}
                onPress={handleCheckPaymentStatus}
                variant="primary"
                size="md"
                disabled={pollingStatus}
                fullWidth
                testID="btn-check-payment-status"
              />
              {activeIntent.providerSessionUrl ? (
                <Button
                  label={t('parentHome.fees.reopenCheckout')}
                  onPress={() => Linking.openURL(activeIntent.providerSessionUrl)}
                  variant="outline"
                  size="sm"
                  fullWidth
                />
              ) : null}
            </View>
          )}

          {activeIntent.status === 'SUCCEEDED' && (
            <Button
              label={t('parentHome.fees.dismissReceipt')}
              onPress={() => setActiveIntent(null)}
              variant="outline"
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          )}

          {activeIntent.status === 'FAILED' && (
            <Button
              label={t('parentHome.fees.tryAgain')}
              onPress={() => setActiveIntent(null)}
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          )}

          {activeIntent.status === 'EXPIRED' && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                {t('parentHome.fees.intentExpiredNote')}
              </Text>
              <Button
                label={t('parentHome.fees.startAgain')}
                onPress={() => {
                  setActiveIntent(null);
                  if (selectedChildId) loadChildFinances(selectedChildId);
                }}
                variant="secondary"
                size="sm"
                testID="btn-payment-start-again"
              />
            </View>
          )}
        </Card>
      )}

      {/* Navigation Tabs: Outstanding Dues vs History */}
      <View style={[styles.tabBar, { borderColor: colors.border, marginBottom: spacing.md }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('DUES')}
          style={[
            styles.tabItem,
            activeTab === 'DUES' && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 2 },
          ]}
          testID="tab-outstanding-dues"
        >
          <Text
            style={[
              typography.bodyMedium,
              { color: activeTab === 'DUES' ? colors.buttonPrimaryBg : colors.textSecondary, fontWeight: '700' },
            ]}
          >
            {t('parentHome.fees.tabDues', { count: dues.filter(d => d.status !== 'Paid').length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('HISTORY')}
          style={[
            styles.tabItem,
            activeTab === 'HISTORY' && { borderBottomColor: colors.buttonPrimaryBg, borderBottomWidth: 2 },
          ]}
          testID="tab-payment-history"
        >
          <Text
            style={[
              typography.bodyMedium,
              { color: activeTab === 'HISTORY' ? colors.buttonPrimaryBg : colors.textSecondary, fontWeight: '700' },
            ]}
          >
            {t('parentHome.fees.tabHistory', { count: history.length })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: OUTSTANDING DUES */}
      {activeTab === 'DUES' && (
        <View>
          {dues.length === 0 ? (
            <Card variant="standard" style={{ padding: spacing.lg, alignItems: 'center' }}>
              <CheckCircle2 size={40} color="#10B981" />
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
                {t('parentHome.fees.allSettledTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                {t('parentHome.fees.allSettledBody')}
              </Text>
            </Card>
          ) : (
            <View>
              {/* Separated Merchant Bundles Overview */}
              {familySummary?.checkoutBundles && familySummary.checkoutBundles.length > 1 && (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
                    {t('parentHome.fees.separatedCheckouts', { count: familySummary.checkoutBundles.length })}
                  </Text>
                  <View style={{ gap: spacing.xs }}>
                    {familySummary.checkoutBundles.map((bundle: any) => (
                      <Card
                        key={bundle.organizationId}
                        variant="standard"
                        style={[styles.dueRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                        testID={`checkout-bundle-${bundle.organizationId}`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                            {bundle.organizationName}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                            {t('parentHome.fees.bundlePending', { count: bundle.itemCount })}
                          </Text>
                        </View>
                        <Text style={[typography.titleMedium, { color: colors.buttonPrimaryBg, fontWeight: '800' }]}>
                          RM {bundle.totalAmountRM.toFixed(2)}
                        </Text>
                      </Card>
                    ))}
                  </View>
                </View>
              )}

              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
                {t('parentHome.fees.selectMonths')}
              </Text>
              <View style={{ gap: spacing.sm }}>
                {dues.map(due => {
                  const isPaid = due.status === 'Paid';
                  const isSelected = selectedDueIds.includes(due.id);
                  const remaining = Math.max(0, Number(due.fee_amount) - Number(due.amount_paid));

                  return (
                    <TouchableOpacity
                      key={due.id}
                      disabled={isPaid}
                      onPress={() => toggleSelectDue(due.id)}
                      style={[
                        styles.dueRow,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                          opacity: isPaid ? 0.6 : 1,
                        },
                      ]}
                      testID={`due-row-${due.id}`}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                          {t('parentHome.fees.month', { month: due.billing_month })}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {t('parentHome.fees.feeAndPaid', { fee: Number(due.fee_amount).toFixed(2), paid: Number(due.amount_paid).toFixed(2) })}
                        </Text>
                        <Text style={[typography.caption, { color: isPaid ? '#10B981' : '#D97706', fontWeight: '700', marginTop: 2 }]}>
                          {t('parentHome.fees.balance', { amount: remaining.toFixed(2) })}
                        </Text>
                      </View>
                      <StatusBadge
                        status={due.status}
                        label={due.status}
                        variant={isPaid ? 'success' : due.status === 'Partially Paid' ? 'warning' : 'neutral'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Checkout Configuration Card */}
              {totalAmountRM > 0 && merchantConfigured && (
                <Card variant="elevated" style={[styles.checkoutCard, { marginTop: spacing.md, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                    {t('parentHome.fees.paymentMethod')}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                    {t('parentHome.fees.paymentMethodDesc')}
                  </Text>

                  {/* Method Picker */}
                  <View style={styles.methodToggleRow}>
                    <TouchableOpacity
                      onPress={() => setPaymentMethod('FPX')}
                      style={[
                        styles.methodButton,
                        {
                          borderColor: paymentMethod === 'FPX' ? colors.buttonPrimaryBg : colors.border,
                          backgroundColor: paymentMethod === 'FPX' ? colors.surface : colors.surfaceElevated,
                        },
                      ]}
                      testID="method-fpx"
                    >
                      <CreditCard size={20} color={paymentMethod === 'FPX' ? colors.buttonPrimaryBg : colors.textSecondary} />
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4, fontWeight: '700' }]}>
                        {t('parentHome.fees.fpx')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setPaymentMethod('DUITNOW_QR')}
                      style={[
                        styles.methodButton,
                        {
                          borderColor: paymentMethod === 'DUITNOW_QR' ? colors.buttonPrimaryBg : colors.border,
                          backgroundColor: paymentMethod === 'DUITNOW_QR' ? colors.surface : colors.surfaceElevated,
                        },
                      ]}
                      testID="method-duitnow"
                    >
                      <QrCode size={20} color={paymentMethod === 'DUITNOW_QR' ? colors.buttonPrimaryBg : colors.textSecondary} />
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 4, fontWeight: '700' }]}>
                        {t('parentHome.fees.duitnow')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bank Selector for FPX */}
                  {paymentMethod === 'FPX' && (
                    <View style={{ marginTop: spacing.md }}>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
                        {t('parentHome.fees.selectBank')}
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {MALAYSIAN_FPX_BANKS.map(bank => {
                          const isBankSelected = selectedBankCode === bank.code;
                          return (
                            <TouchableOpacity
                              key={bank.code}
                              onPress={() => setSelectedBankCode(bank.code)}
                              style={[
                                styles.bankPill,
                                {
                                  borderColor: isBankSelected ? colors.buttonPrimaryBg : colors.border,
                                  backgroundColor: isBankSelected ? colors.surface : colors.surfaceElevated,
                                  marginRight: spacing.xs,
                                },
                              ]}
                              testID={`bank-pill-${bank.code}`}
                            >
                              <Text style={[typography.caption, { color: isBankSelected ? colors.buttonPrimaryBg : colors.textPrimary, fontWeight: isBankSelected ? '700' : '500' }]}>
                                {bank.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Total Amount Summary */}
                  <View style={[styles.totalRow, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }]}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                      {t('parentHome.fees.totalPayable')}
                    </Text>
                    <Text style={[typography.sectionHeading, { color: colors.buttonPrimaryBg, fontWeight: '800' }]} testID="total-payable-amount">
                      RM {totalAmountRM.toFixed(2)}
                    </Text>
                  </View>

                  <Button
                    label={initiatingPayment ? t('parentHome.fees.connecting') : t('parentHome.fees.payNow', { amount: totalAmountRM.toFixed(2) })}
                    onPress={handleInitiatePayment}
                    variant="primary"
                    size="lg"
                    disabled={initiatingPayment || isOffline}
                    fullWidth
                    style={{ marginTop: spacing.md }}
                    testID="btn-pay-now"
                  />

                  <View style={[styles.securityNotice, { marginTop: spacing.sm }]}>
                    <ShieldCheck size={14} color="#10B981" />
                    <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 4 }]}>
                      {t('parentHome.fees.securityNotice')}
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          )}
        </View>
      )}

      {/* TAB 2: PAYMENT HISTORY & DIGITAL RECEIPTS */}
      {activeTab === 'HISTORY' && (
        <View>
          {history.length === 0 ? (
            <Card variant="standard" style={{ padding: spacing.lg, alignItems: 'center' }}>
              <FileText size={40} color={colors.textSecondary} />
              <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
                {t('parentHome.fees.noReceiptsTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                {t('parentHome.fees.noReceiptsBody')}
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {history.map(item => (
                <Card
                  key={item.id}
                  variant="standard"
                  style={[styles.historyRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  testID={`history-item-${item.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Receipt size={16} color={colors.buttonPrimaryBg} />
                      <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700', marginLeft: spacing.xs }]}>
                        {item.receipt_no || t('parentHome.fees.receiptPending')}
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {t('parentHome.fees.historyMethod', { method: item.method, date: new Date(item.created_at).toLocaleDateString() })}
                    </Text>
                    <Text style={[typography.titleMedium, { color: colors.buttonPrimaryBg, fontWeight: '800', marginTop: 4 }]}>
                      RM {Number(item.amount).toFixed(2)}
                    </Text>
                  </View>
                  <StatusBadge
                    status={item.status}
                    label={item.status}
                    variant={item.status === 'Approved' || item.status === 'Paid' ? 'success' : 'neutral'}
                  />
                </Card>
              ))}
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
  childPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  merchantBanner: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkoutCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  methodToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  methodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  bankPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIntentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  intentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  intentDetails: {
    paddingTop: 8,
  },
  receiptHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
});
