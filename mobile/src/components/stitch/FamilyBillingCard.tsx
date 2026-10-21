import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { CreditCard, Building2, Receipt, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';
import { SiblingDiscountBanner } from './SiblingDiscountBanner';

export interface MerchantBillingItem {
  organizationId: string;
  merchantName: string;
  currency: string;
  totalFeeAmount: number;
  totalAmountPaid: number;
  totalOutstandingAmount: number;
  duesCount?: number;
  hasSiblingDiscount?: boolean;
  siblingDiscountAmount?: number;
}

export interface FamilyBillingCardProps {
  merchants: MerchantBillingItem[];
  totalFamilyOutstanding: number;
  currency?: string;
  hasSiblingDiscount?: boolean;
  siblingDiscountLabel?: string;
  siblingDiscountDetails?: string;
  siblingDiscountSavings?: number;
  onPayNow?: (organizationId?: string) => void;
  onViewHistory?: () => void;
  style?: ViewStyle;
}

export const FamilyBillingCard: React.FC<FamilyBillingCardProps> = ({
  merchants,
  totalFamilyOutstanding,
  currency = 'MYR',
  hasSiblingDiscount = false,
  siblingDiscountLabel = '10% Sibling Discount Applied',
  siblingDiscountDetails = 'Multi-child enrollment saving',
  siblingDiscountSavings,
  onPayNow,
  onViewHistory,
  style,
}) => {
  const isAllPaid = totalFamilyOutstanding <= 0;

  return (
    <View style={[styles.card, style]} testID="family-billing-card">
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconCircle}>
            <CreditCard size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.titleText}>Family Dues & Billing</Text>
            <Text style={styles.subtitleText}>Direct Persatuan Settlement</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, isAllPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
          <Text style={[styles.statusBadgeText, isAllPaid ? styles.statusTextPaid : styles.statusTextPending]}>
            {isAllPaid ? 'ALL SETTLED' : 'DUE'}
          </Text>
        </View>
      </View>

      {/* Sibling Discount Banner (rendered when server reports sibling discount) */}
      {hasSiblingDiscount && (
        <View style={styles.bannerSpacing} testID="family-sibling-discount-banner">
          <SiblingDiscountBanner
            discountLabel={siblingDiscountLabel}
            siblingDetails={siblingDiscountDetails}
            discountAmountText={siblingDiscountSavings ? `-RM ${siblingDiscountSavings.toFixed(2)}` : 'ACTIVE'}
          />
        </View>
      )}

      {/* Total Outstanding Amount Display */}
      <View style={styles.amountDisplayContainer}>
        <Text style={styles.amountLabel}>Total Outstanding</Text>
        <Text style={styles.amountNumber}>
          {currency} {totalFamilyOutstanding.toFixed(2)}
        </Text>
      </View>

      {/* Merchant Separation Partition List */}
      <View style={styles.merchantListContainer}>
        <Text style={styles.merchantSectionTitle}>ACADEMY MERCHANT BREAKDOWN</Text>
        {merchants.length === 0 ? (
          <Text style={styles.emptyMerchantText}>No active billing records found.</Text>
        ) : (
          merchants.map((m) => (
            <View key={m.organizationId} style={styles.merchantRow} testID={`merchant-billing-${m.organizationId}`}>
              <View style={styles.merchantLeft}>
                <Building2 size={14} color={StitchTokens.colors.brandNavy} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.merchantName} numberOfLines={1}>
                    {m.merchantName}
                  </Text>
                  <Text style={styles.merchantSub}>
                    Paid: RM {m.totalAmountPaid.toFixed(2)} • Total: RM {m.totalFeeAmount.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.merchantRight}>
                <Text
                  style={[
                    styles.merchantDueAmount,
                    m.totalOutstandingAmount > 0 ? styles.duePositive : styles.dueZero,
                  ]}
                >
                  {m.totalOutstandingAmount > 0
                    ? `RM ${m.totalOutstandingAmount.toFixed(2)}`
                    : 'Settled'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {onPayNow && !isAllPaid && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => onPayNow()}
            testID="btn-family-pay-now"
            accessibilityRole="button"
            accessibilityLabel="Pay outstanding dues online"
          >
            <ShieldCheck size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.payButtonText}>Pay via FPX / DuitNow</Text>
          </TouchableOpacity>
        )}

        {onViewHistory && (
          <TouchableOpacity
            style={styles.historyButton}
            onPress={onViewHistory}
            testID="btn-family-view-history"
            accessibilityRole="button"
            accessibilityLabel="View payment history and receipts"
          >
            <Receipt size={14} color={StitchTokens.colors.brandNavy} style={{ marginRight: 4 }} />
            <Text style={styles.historyButtonText}>Receipts</Text>
            <ArrowRight size={14} color={StitchTokens.colors.brandNavy} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: StitchTokens.radii.cardLarge,
    borderWidth: 1,
    borderColor: StitchTokens.colors.slateBorder,
    padding: StitchTokens.spacing.cardPad,
    ...StitchTokens.shadows.cardElevated,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: StitchTokens.colors.brandNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.bodyLg,
    fontWeight: StitchTokens.typography.weights.bold,
    color: StitchTokens.colors.brandNavy,
  },
  subtitleText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.caption,
    color: StitchTokens.colors.slateTextMuted,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: StitchTokens.radii.pill,
  },
  statusBadgePaid: {
    backgroundColor: StitchTokens.colors.bfGreenSoft,
  },
  statusBadgePending: {
    backgroundColor: StitchTokens.colors.colorAccentSoft,
  },
  statusBadgeText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.tag,
    fontWeight: StitchTokens.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  statusTextPaid: {
    color: StitchTokens.colors.bfGreenDark,
  },
  statusTextPending: {
    color: '#9A3412',
  },
  bannerSpacing: {
    marginBottom: 12,
  },
  amountDisplayContainer: {
    backgroundColor: StitchTokens.colors.slateBackground,
    borderRadius: StitchTokens.radii.cardMini,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: StitchTokens.colors.slateBorder,
  },
  amountLabel: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.caption,
    color: StitchTokens.colors.slateTextMuted,
    fontWeight: StitchTokens.typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountNumber: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.title,
    fontWeight: StitchTokens.typography.weights.extraBold,
    color: StitchTokens.colors.brandNavy,
    marginTop: 2,
  },
  merchantListContainer: {
    marginBottom: 12,
  },
  merchantSectionTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.tag,
    fontWeight: StitchTokens.typography.weights.bold,
    color: StitchTokens.colors.slateTextMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyMerchantText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.bodySm,
    color: StitchTokens.colors.slateTextMuted,
    fontStyle: 'italic',
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: StitchTokens.colors.slateBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  merchantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  merchantName: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.bodySm,
    fontWeight: StitchTokens.typography.weights.semiBold,
    color: StitchTokens.colors.brandNavy,
  },
  merchantSub: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    color: StitchTokens.colors.slateTextMuted,
    marginTop: 1,
  },
  merchantRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  merchantDueAmount: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.bodySm,
    fontWeight: StitchTokens.typography.weights.bold,
  },
  duePositive: {
    color: StitchTokens.colors.bfRedDark,
  },
  dueZero: {
    color: StitchTokens.colors.bfGreenDark,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  payButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: StitchTokens.colors.colorAccent,
    borderRadius: StitchTokens.radii.btn,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  payButtonText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.bodySm,
    fontWeight: StitchTokens.typography.weights.bold,
    color: '#FFFFFF',
  },
  historyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 43, 71, 0.06)',
    borderRadius: StitchTokens.radii.btn,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  historyButtonText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: StitchTokens.typography.sizes.bodySm,
    fontWeight: StitchTokens.typography.weights.bold,
    color: StitchTokens.colors.brandNavy,
    marginRight: 2,
  },
});
