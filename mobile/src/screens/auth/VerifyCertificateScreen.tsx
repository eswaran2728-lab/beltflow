import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle, Search } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer, ScreenHeader } from '../../components/Layout';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatusBadge, BeltBadge } from '../../components/Badges';
import { ErrorState } from '../../components/Feedback';
import { certificateService, VerifiedCertificate } from '../../services/certificateService';
import { useI18n } from '../../i18n';

export interface VerifyCertificateScreenProps {
  onBack: () => void;
  initialCode?: string;
}

export const VerifyCertificateScreen: React.FC<VerifyCertificateScreenProps> = ({
  onBack,
  initialCode = '',
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const { t } = useI18n();

  const [code, setCode] = useState(initialCode);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedCert, setVerifiedCert] = useState<VerifiedCertificate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError(t('auth.verify.codeRequired'));
      return;
    }

    setCodeError(undefined);
    setErrorMessage(undefined);
    setVerifiedCert(null);
    setIsLoading(true);

    try {
      const result = await certificateService.verifyCertificate(trimmed);
      if (result && result.certificate) {
        setVerifiedCert(result.certificate);
      } else {
        setErrorMessage(t('auth.verify.notFound'));
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || t('auth.verify.failed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable testID="verify-certificate-screen">
      <ScreenHeader
        title={t('auth.verify.title')}
        subtitle={t('auth.verify.subtitle')}
        onBack={onBack}
        testID="verify-cert-header"
      />

      <View style={[styles.content, { paddingVertical: spacing.md }]}>
        {/* Verification Input Form */}
        <Card variant="standard" style={styles.inputCard}>
          <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 8 }]}>
            {t('auth.verify.lookupTitle')}
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: 16 }]}>
            {t('auth.verify.lookupBody')}
          </Text>

          <Input
            label={t('auth.verify.codeLabel')}
            placeholder={t('auth.verify.codePlaceholder')}
            value={code}
            onChangeText={text => {
              setCode(text);
              if (codeError) setCodeError(undefined);
            }}
            errorText={codeError}
            autoCapitalize="characters"
            leftIcon={<Search size={iconSize.md} color={colors.textSecondary} />}
            disabled={isLoading}
            testID="input-cert-code"
          />

          <View style={{ marginTop: spacing.sm }}>
            <Button
              label={t('auth.verify.submit')}
              onPress={handleVerify}
              loading={isLoading}
              disabled={isLoading}
              variant="primary"
              size="md"
              fullWidth
              testID="btn-verify-submit"
            />
          </View>
        </Card>

        {/* Error Feedback */}
        {errorMessage ? (
          <View style={{ marginTop: spacing.lg }}>
            <ErrorState
              title={t('auth.verify.errorTitle')}
              message={errorMessage}
              testID="verify-error-state"
            />
          </View>
        ) : null}

        {/* Verified Certificate Display */}
        {verifiedCert ? (
          <View style={{ marginTop: spacing.lg }}>
            <Card
              variant="elevated"
              style={[
                styles.verifiedCard,
                verifiedCert.status === 'REVOKED' ? { borderColor: colors.badgeDangerText } : { borderColor: '#10B981' }
              ]}
              testID="card-verified-cert"
            >
              {/* Header Badge */}
              <View style={styles.certHeaderRow}>
                <View style={styles.verifiedBadge}>
                  <CheckCircle
                    size={20}
                    color={verifiedCert.status === 'REVOKED' ? colors.badgeDangerText : colors.badgeSuccessText}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: verifiedCert.status === 'REVOKED' ? colors.badgeDangerText : colors.badgeSuccessText,
                        fontWeight: '700'
                      }
                    ]}
                  >
                    {verifiedCert.status === 'REVOKED' ? t('auth.verify.revokedBanner') : t('auth.verify.verifiedBanner')}
                  </Text>
                </View>

                {verifiedCert.status === 'REVOKED' ? (
                  <StatusBadge status="CANCELLED" label={t('auth.verify.revoked')} variant="danger" />
                ) : (
                  <StatusBadge status="ACTIVE" label={t('auth.verify.valid')} variant="success" />
                )}
              </View>

              {verifiedCert.status === 'REVOKED' && verifiedCert.revocationReason ? (
                <View
                  style={{
                    backgroundColor: colors.badgeDangerBg,
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: colors.badgeDangerText,
                  }}
                >
                  <Text style={[typography.caption, { color: colors.badgeDangerText, fontWeight: '700' }]}>
                    {t('auth.verify.revocationNotice')}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textPrimary, marginTop: 2 }]}>
                    {verifiedCert.revocationReason}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Certificate Details */}
              <View style={styles.certBody}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('auth.verify.studentName')}
                </Text>
                <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginBottom: 12 }]}>
                  {verifiedCert.studentName}
                </Text>

                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('auth.verify.rank')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6 }}>
                  <BeltBadge beltName={verifiedCert.rankOrTitle} showDanBadge size="md" />
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: 10, fontWeight: '600' }]}>
                    {verifiedCert.rankOrTitle}
                  </Text>
                </View>

                <View style={{ height: 12 }} />

                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('auth.verify.academy')}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: 12 }]}>
                  {verifiedCert.organizationName}
                </Text>

                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('auth.verify.examiner')}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: 12 }]}>
                  {verifiedCert.masterName}
                </Text>

                <View style={styles.metaRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{t('auth.verify.issueDate')}</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                      {verifiedCert.issueDate}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{t('auth.verify.code')}</Text>
                    <Text style={[typography.bodyMedium, { color: colors.buttonPrimaryBg, fontWeight: '700' }]}>
                      {verifiedCert.code}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 4,
  },
  inputCard: {
    padding: 20,
  },
  verifiedCard: {
    padding: 20,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  certHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
  },
  certBody: {
    width: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
});
