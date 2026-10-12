import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Info, ShieldAlert, PhoneCall } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBack }) => {
  const { colors, typography, iconSize, spacing } = useTheme();

  return (
    <ScreenContainer scrollable testID="forgot-password-screen">
      <ScreenHeader
        title="Password Assistance"
        subtitle="Academy credential policy"
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
                Managed Academy Security
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Multi-tenant BeltFlow account guidelines
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[typography.bodyMedium, { color: colors.textPrimary, lineHeight: 22 }]}>
            In accordance with martial arts academy security standards, student, parent, and master
            passwords are administrative credentials managed by each active Persatuan.
          </Text>

          <View style={{ height: 16 }} />

          <View style={[styles.bulletRow, { backgroundColor: colors.surfaceElevated }]}>
            <Info size={iconSize.sm} color={colors.buttonPrimaryBg} style={styles.bulletIcon} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              Please contact your Persatuan Admin or Academy Master to request a secure password
              reset or temporary credential voucher.
            </Text>
          </View>

          <View style={{ height: 12 }} />

          <View style={[styles.bulletRow, { backgroundColor: colors.surfaceElevated }]}>
            <PhoneCall size={iconSize.sm} color={colors.buttonPrimaryBg} style={styles.bulletIcon} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              For privacy protection, automated self-service email resets are not permitted to reveal
              membership or account existence.
            </Text>
          </View>
        </Card>

        {/* Action Button */}
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label="Return to Sign In"
            onPress={onBack}
            variant="primary"
            size="lg"
            fullWidth
            testID="btn-forgot-back"
            accessibilityLabel="Return to Sign In"
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
