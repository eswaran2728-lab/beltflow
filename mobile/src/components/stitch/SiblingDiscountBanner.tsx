import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Users2 } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';

export interface SiblingDiscountBannerProps {
  discountLabel?: string;
  siblingDetails: string;
  discountAmountText: string;
  style?: ViewStyle;
}

export const SiblingDiscountBanner: React.FC<SiblingDiscountBannerProps> = ({
  discountLabel = '10% Sibling Discount Applied',
  siblingDetails,
  discountAmountText,
  style,
}) => {
  return (
    <View style={[styles.banner, style]} testID="sibling-discount-banner">
      <View style={styles.leftGroup}>
        <View style={styles.iconCircle}>
          <Users2 size={14} color="#C2410C" />
        </View>
        <View>
          <Text style={styles.titleText}>{discountLabel}</Text>
          <Text style={styles.detailsText}>{siblingDetails}</Text>
        </View>
      </View>

      <View style={styles.pillBadge}>
        <Text style={styles.pillText}>{discountAmountText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: StitchTokens.colors.colorAccentSoft,
    borderWidth: 1,
    borderColor: StitchTokens.colors.colorAccentBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(242, 148, 28, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
  },
  detailsText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    color: '#C2410C',
    marginTop: 1,
  },
  pillBadge: {
    backgroundColor: 'rgba(13, 43, 71, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '800',
    color: StitchTokens.colors.brandNavy,
  },
});
