import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield, Award, Users, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LanguageSelector } from '../../components/LanguageSelector';
import { useI18n } from '../../i18n';

export interface WelcomeScreenProps {
  onNavigateLogin: () => void;
  onNavigateVerify: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onNavigateLogin,
  onNavigateVerify,
}) => {
  const { colors, typography, spacing } = useTheme();
  const { t } = useI18n();

  return (
    <ScreenContainer scrollable testID="welcome-screen">
      <View style={styles.content}>
        {/* Header Branding */}
        <View style={styles.header}>
          <View
            style={[
              styles.logoWrapper,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Shield size={44} color={colors.buttonPrimaryBg} />
          </View>
          <Text style={[typography.display, styles.title, { color: colors.textPrimary }]}>
            BeltFlow
          </Text>
          <Text style={[typography.bodyMedium, styles.subtitle, { color: colors.textSecondary }]}>
            {t('auth.common.tagline')}
          </Text>
        </View>

        {/* Feature Highlights Card */}
        <Card variant="standard" style={styles.card}>
          <View style={styles.featureItem}>
            <Users size={22} color={colors.buttonPrimaryBg} style={styles.featureIcon} />
            <View style={styles.featureText}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {t('auth.welcome.feature1.title')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.welcome.feature1.body')}
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Award size={22} color={colors.buttonPrimaryBg} style={styles.featureIcon} />
            <View style={styles.featureText}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {t('auth.welcome.feature2.title')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.welcome.feature2.body')}
              </Text>
            </View>
          </View>

          <View style={[styles.featureItem, { marginBottom: 0 }]}>
            <CheckCircle2 size={22} color={colors.buttonPrimaryBg} style={styles.featureIcon} />
            <View style={styles.featureText}>
              <Text style={[typography.sectionHeading, { color: colors.textPrimary }]}>
                {t('auth.welcome.feature3.title')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.welcome.feature3.body')}
              </Text>
            </View>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={[styles.actions, { marginTop: spacing.xl }]}>
          <Button
            label={t('auth.welcome.signIn')}
            onPress={onNavigateLogin}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-welcome-signin"
            accessibilityLabel={t('auth.welcome.signIn')}
          />

          <View style={{ height: 12 }} />

          <Button
            label={t('auth.common.verifyOfficialCertificate')}
            onPress={onNavigateVerify}
            variant="outline"
            size="lg"
            fullWidth
            testID="btn-welcome-verify"
            accessibilityLabel={t('auth.common.verifyOfficialCertificate')}
          />
        </View>

        {/* H28: language choice, below the main actions */}
        <View style={styles.language}>
          <LanguageSelector testID="welcome-language-selector" />
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingVertical: 24,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
  },
  card: {
    padding: 20,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureIcon: {
    marginRight: 14,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
  },
  actions: {
    width: '100%',
  },
  language: {
    marginTop: 8,
    width: '100%',
  },
});
