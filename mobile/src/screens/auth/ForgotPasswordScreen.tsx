import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info, ShieldAlert, PhoneCall } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n';

export interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBack }) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const { t } = useI18n();

  return (
    <ScreenContainer scrollable testID="forgot-password-screen">
      <ScreenHeader
        title={t('auth.forgot.title')}
        subtitle={t('auth.forgot.subtitle')}
        onBack={onBack}
        testID="forgot-password-header"
      />

      <View style={[styles.content, { paddingVertical: spacing.lg }]}>
        {/* Notice Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: colors.badgeWarningBg, borderColor: colors.badgeWarningText },
              ]}
            >
              <ShieldAlert size={iconSize.md} color={colors.badgeWarningText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {t('auth.forgot.cardTitle')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.forgot.cardSubtitle')}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[typography.bodyMedium, { color: colors.textPrimary, lineHeight: 22 }]}>
            {t('auth.forgot.policy')}
          </Text>

          <View style={{ height: 16 }} />

          <View style={[styles.bulletRow, { backgroundColor: colors.surfaceElevated }]}>
            <Info size={iconSize.sm} color={colors.buttonPrimaryBg} style={styles.bulletIcon} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {t('auth.forgot.contact')}
            </Text>
          </View>

          <View style={{ height: 12 }} />

          <View style={[styles.bulletRow, { backgroundColor: colors.surfaceElevated }]}>
            <PhoneCall size={iconSize.sm} color={colors.buttonPrimaryBg} style={styles.bulletIcon} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {t('auth.forgot.privacy')}
            </Text>
          </View>
        </Card>

        {/* Action Button */}
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={t('auth.forgot.back')}
            onPress={onBack}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-forgot-back"
            accessibilityLabel={t('auth.forgot.back')}
          />
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 4,
  },
  card: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
  },
  bulletIcon: {
    marginRight: 10,
    marginTop: 2,
  },
});
