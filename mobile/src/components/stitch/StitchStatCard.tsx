import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { StitchTokens } from '../../theme/tokens';
import { useCountUp } from '../motion';

export interface StitchStatCardProps {
  label?: string;
  kpiLabel?: string;
  value?: string | number;
  kpiValue?: string | number;
  subtext?: string;
  kpiSubtext?: string;
  trendText?: string;
  isPositiveTrend?: boolean;
  hasAccentBorder?: boolean;
  accentColor?: string;
  style?: ViewStyle;
  testID?: string;
}

export const StitchStatCard: React.FC<StitchStatCardProps> = ({
  label,
  kpiLabel,
  value,
  kpiValue,
  subtext,
  kpiSubtext,
  trendText,
  isPositiveTrend = true,
  hasAccentBorder = false,
  accentColor,
  style,
  testID,
}) => {
  const displayLabel = label || kpiLabel || '';
  const displayValue = value ?? kpiValue ?? '';
  const displaySubtext = subtext || kpiSubtext;
  const shownValue = useCountUp(displayValue);

  return (
    <View
      style={[
        styles.card,
        hasAccentBorder && styles.accentBorder,
        accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
        style,
      ]}
      testID={testID || "stitch-stat-card"}
    >
      <Text style={styles.label} numberOfLines={2}>{displayLabel}</Text>
      <Text style={[styles.valueText, accentColor && displayValue !== '0' && displayValue !== 'RM 0' && displayValue !== 'RM 0.00' ? { color: accentColor } : null]}>
        {shownValue}
      </Text>
      {trendText ? (
        <Text
          style={[
            styles.trendText,
            isPositiveTrend ? styles.positiveTrend : styles.neutralTrend,
          ]}
        >
          {trendText}
        </Text>
      ) : displaySubtext ? (
        <Text style={styles.subtext}>{displaySubtext}</Text>
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
    padding: 14,
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
    letterSpacing: 0.3,
    lineHeight: 14,
    minHeight: 28,
  },
  valueText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: StitchTokens.colors.brandNavy,
    marginTop: 6,
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
