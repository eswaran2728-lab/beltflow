import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { useCountUp } from './motion';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  loading = false,
  empty = false,
  style,
  testID,
}) => {
  const { colors, typography } = useTheme();
  const shownValue = useCountUp(value);

  return (
    <Card variant="standard" style={[styles.card, style]} testID={testID}>
      <View style={styles.headerRow}>
        <Text
          style={[
            typography.caption,
            styles.title,
            { color: colors.textSecondary },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {title}
        </Text>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
      </View>

      {loading ? (
        <View style={styles.loadingContainer} testID={`${testID}-loading`}>
          <ActivityIndicator size="small" color={colors.buttonPrimaryBg} />
        </View>
      ) : (
        <Text
          style={[
            typography.statNumber,
            styles.valueText,
            { color: empty ? colors.textMuted : colors.textPrimary },
          ]}
        >
          {empty ? '—' : shownValue}
        </Text>
      )}

      {subtitle && !loading && (
        <Text
          style={[
            typography.caption,
            styles.subtitleText,
            { color: colors.textMuted },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 96,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconContainer: {
    opacity: 0.85,
  },
  loadingContainer: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  valueText: {
    marginVertical: 2,
  },
  subtitleText: {
    marginTop: 4,
    fontWeight: '500',
  },
});
