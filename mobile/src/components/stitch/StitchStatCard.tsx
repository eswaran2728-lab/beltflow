import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { StitchTokens } from '../../theme/tokens';

export interface StitchStatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trendText?: string;
  isPositiveTrend?: boolean;
  hasAccentBorder?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const StitchStatCard: React.FC<StitchStatCardProps> = ({
  label,
  value,
  subtext,
  trendText,
  isPositiveTrend = true,
  hasAccentBorder = false,
  style,
  testID,
}) => {
  return (
    <View
      style={[
        styles.card,
        hasAccentBorder && styles.accentBorder,
        style,
      ]}
      testID={testID || "stitch-stat-card"}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
      {trendText ? (
        <Text
          style={[
            styles.trendText,
            isPositiveTrend ? styles.positiveTrend : styles.neutralTrend,
          ]}
        >
          {trendText}
        </Text>
      ) : subtext ? (
        <Text style={styles.subtext}>{subtext}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: StitchTokens.colors.slateBorder,
    borderRadius: StitchTokens.radii.cardMini,
    padding: 16,
    ...StitchTokens.shadows.card,
  },
  accentBorder: {
    borderLeftWidth: 4,
    borderLeftColor: StitchTokens.colors.colorAccent,
  },
  label: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: StitchTokens.colors.slateTextMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  valueText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 26,
    fontWeight: '800',
    color: StitchTokens.colors.brandNavy,
    marginTop: 4,
  },
  trendText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  positiveTrend: {
    color: StitchTokens.colors.bfGreenDark,
  },
  neutralTrend: {
    color: StitchTokens.colors.slateTextMuted,
  },
  subtext: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    color: StitchTokens.colors.slateTextMuted,
    marginTop: 3,
  },
});
