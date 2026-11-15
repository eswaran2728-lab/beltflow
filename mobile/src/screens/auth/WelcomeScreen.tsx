import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Award, Users, CheckCircle2 } from 'lucide-react-native';
import { AnimatedLogo } from '../../components/AnimatedLogo';
import { Entrance, PopIn } from '../../components/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer } from '../../components/Layout';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LanguageSelector } from '../../components/LanguageSelector';
import { LegalLinks } from '../../components/LegalLinks';
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
          <PopIn>
            <View style={[styles.logoTile, styles.logoTileFace]}>
              <AnimatedLogo size={80} glow={false} />
            </View>
          </PopIn>
          <Text style={[typography.display, styles.title, { color: colors.textPrimary }]}>
            {t('app.name')}
          </Text>
          <Text style={[typography.bodyMedium, styles.subtitle, { color: colors.textSecondary }]}>
            {t('auth.common.tagline')}
          </Text>
        </View>

        {/* Feature Highlights Card */}
        <Entrance delay={120}>
        <Card variant="standard" style={styles.card}>
          <View style={styles.featureItem}>
            <View style={[styles.featureBubble, { backgroundColor: colors.surfaceHighlight }]}>
              <Users size={22} color={colors.buttonSecondaryBg} />
            </View>
            <View style={styles.featureText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                {t('auth.welcome.feature1.title')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.welcome.feature1.body')}
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureBubble, { backgroundColor: colors.surfaceHighlight }]}>
              <Award size={22} color={colors.buttonSecondaryBg} />
            </View>
            <View style={styles.featureText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                {t('auth.welcome.feature2.title')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.welcome.feature2.body')}
              </Text>
            </View>
          </View>

          <View style={[styles.featureItem, { marginBottom: 0 }]}>
            <View style={[styles.featureBubble, { backgroundColor: colors.surfaceHighlight }]}>
              <CheckCircle2 size={22} color={colors.buttonSecondaryBg} />
            </View>
            <View style={styles.featureText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                {t('auth.welcome.feature3.title')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {t('auth.welcome.feature3.body')}
              </Text>
            </View>
          </View>
        </Card>
        </Entrance>

        {/* Action Buttons */}
        <Entrance delay={220} style={[styles.actions, { marginTop: spacing.xl }]}>
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
        </Entrance>

        {/* H28: language choice, below the main actions */}
        <View style={styles.language}>
          <LanguageSelector testID="welcome-language-selector" />
        </View>

        {/* Legal pages: always reachable before signing in */}
        <LegalLinks style={{ marginTop: 16 }} />
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
  logoTileFace: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#0D2B47',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTile: {
    marginBottom: 18,
    // the tile sits on a thick edge, like the buttons
    borderBottomWidth: 6,
    borderBottomColor: '#061828',
    shadowColor: '#0D2B47',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
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
  featureBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderBottomWidth: 3,
    borderBottomColor: '#FED7AA',
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
