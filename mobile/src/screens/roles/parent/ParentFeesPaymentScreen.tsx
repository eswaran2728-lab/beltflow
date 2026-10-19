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
import { OfflineBanner } from '../../../components/Feedback';
import { AuthUser } from '../../../types/auth';
import {
  paymentGatewayService,
  MaskedMerchantConfig,
  PaymentIntentDetails,
  MALAYSIAN_FPX_BANKS,
} from '../../../services/paymentGatewayService';
import { apiClient } from '../../../services/apiClient';

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

  const [loading, setLoading] = useState<boolean>(!isOffline);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const [merchantConfig, setMerchantConfig] = useState<MaskedMerchantConfig | null>(null);
  const [merchantConfigured, setMerchantConfigured] = useState<boolean>(false);

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
      // Fetch parent dashboard data to find linked children
      const dashRes = await apiClient.get<any>('/dashboard/parent');
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

    apiClient.get<any>('/dashboard/parent')
      .then(async dashRes => {
        if (!isMounted) return;
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
      Alert.alert('Selection Required', 'Please select at least one outstanding billing month to pay.');
      return;
    }

    if (!merchantConfigured) {
      Alert.alert(
        'Gateway Not Configured',
        'Online payment gateway is not configured for this Persatuan. Please pay in person or via direct bank transfer.'
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
      Alert.alert('Payment Initiation Failed', err.message || 'Unable to start payment session.');
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
        <ScreenHeader title="Tuition Fees & Payments" subtitle="Online FPX & DuitNow Direct Settlement" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.buttonPrimaryBg} />
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
            Loading tuition records...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable testID="parent-fees-payment-screen">
      <ScreenHeader
        title="Tuition Fees & Receipts"
        subtitle="Persatuan-Owned Direct Settlement"
        rightAction={
          <TouchableOpacity
            onPress={loadParentData}
            style={[styles.refreshButton, { borderColor: colors.border }]}
            accessibilityLabel="Refresh fee records"
          >
            <RefreshCw size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />

      {isOffline && (
        <View style={{ marginBottom: spacing.md }}>
          <OfflineBanner message="Offline Mode: Viewing cached billing details. Online FPX and DuitNow payments are disabled until connected." />
        </View>
      )}

      {/* Linked Children Selector */}
      {children.length > 1 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
            SELECT STUDENT
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
                : 'Direct Settlement Not Configured'}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {merchantConfigured && merchantConfig
                ? `Funds route directly to Persatuan account (${merchantConfig.settlementBankName || 'Bank'} ${merchantConfig.settlementAccountMasked || ''}). BeltFlow does not pool academy payments.`
                : 'This Persatuan has not yet configured its direct merchant account. Online payments are unavailable.'}
            </Text>
          </View>
          <StatusBadge
            status={merchantConfigured ? 'ACTIVE' : 'UNCONFIGURED'}
            label={merchantConfigured ? 'Direct Merchant' : 'Offline Only'}
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
                  ? 'Payment Confirmed'
                  : activeIntent.status === 'FAILED'
                  ? 'Payment Failed'
                  : 'Payment Pending Authoritative Confirmation'}
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
              Amount Payable: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>RM {activeIntent.amountRM}</Text> ({activeIntent.amountCents} sen)
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              Method: <Text style={{ color: colors.textPrimary }}>{activeIntent.paymentMethod === 'FPX' ? 'FPX Online Banking' : 'DuitNow QR'}</Text>
            </Text>
            {activeIntent.receiptNo ? (
              <View style={[styles.receiptHighlight, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                <Receipt size={18} color="#059669" />
                <Text style={[typography.bodyMedium, { color: '#065F46', marginLeft: spacing.xs, fontWeight: '700' }]}>
                  Official Receipt: {activeIntent.receiptNo}
                </Text>
              </View>
            ) : null}
          </View>

          {activeIntent.status === 'PENDING_PROCESSING' && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Button
                label={pollingStatus ? 'Checking Bank Evidence...' : 'I Have Completed Payment (Check Status)'}
                onPress={handleCheckPaymentStatus}
                variant="primary"
                size="md"
                disabled={pollingStatus}
                fullWidth
                testID="btn-check-payment-status"
              />
              {activeIntent.providerSessionUrl ? (
                <Button
                  label="Reopen Bank Checkout Portal"
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
              label="Dismiss / View Receipt"
              onPress={() => setActiveIntent(null)}
              variant="outline"
              size="sm"
              style={{ marginTop: spacing.md }}
            />
          )}

          {activeIntent.status === 'FAILED' && (
            <Button
              label="Try Again"
              onPress={() => setActiveIntent(null)}
              variant="secondary"
              size="sm"
              style={{ marginTop: spacing.md }}
            />
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
            Outstanding Dues ({dues.filter(d => d.status !== 'Paid').length})
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
            Payment History ({history.length})
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
                All Tuition Fees Settled
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                There are no pending or outstanding monthly dues recorded for this student.
              </Text>
            </Card>
          ) : (
            <View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
                SELECT MONTHS TO SETTLE
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
                          Month: {due.billing_month}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          Fee: RM {Number(due.fee_amount).toFixed(2)} • Paid: RM {Number(due.amount_paid).toFixed(2)}
                        </Text>
                        <Text style={[typography.caption, { color: isPaid ? '#10B981' : '#D97706', fontWeight: '700', marginTop: 2 }]}>
                          Balance: RM {remaining.toFixed(2)}
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
                    Payment Method
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                    Direct server-authoritative settlement with Persatuan merchant
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
                        FPX Online Banking
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
                        DuitNow QR
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Bank Selector for FPX */}
                  {paymentMethod === 'FPX' && (
                    <View style={{ marginTop: spacing.md }}>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
                        SELECT MALAYSIAN BANK
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
                      Total Payable:
                    </Text>
                    <Text style={[typography.sectionHeading, { color: colors.buttonPrimaryBg, fontWeight: '800' }]} testID="total-payable-amount">
                      RM {totalAmountRM.toFixed(2)}
                    </Text>
                  </View>

                  <Button
                    label={initiatingPayment ? 'Connecting to Gateway...' : `Pay RM ${totalAmountRM.toFixed(2)} Now`}
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
                      Protected by TLS 1.3 & HMAC-SHA256 authoritative settlement.
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
                No Historical Receipts
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                Confirmed tuition receipts will be permanently archived and available here.
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
                        {item.receipt_no || 'Receipt Pending'}
                      </Text>
                    </View>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      Method: {item.method} • {new Date(item.created_at).toLocaleDateString()}
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
