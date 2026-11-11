import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Mail, Shield } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { ScreenContainer } from '../../components/Layout';
import { Input, PasswordInput } from '../../components/Input';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/Feedback';
import { DevEnvironmentPanel } from '../../components/DevEnvironmentPanel';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types/auth';
import { useI18n } from '../../i18n';

export interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  onNavigateForgotPassword?: () => void;
  onNavigateVerifyCert?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onNavigateForgotPassword,
  onNavigateVerifyCert,
}) => {
  const { colors, typography, iconSize, spacing } = useTheme();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [generalError, setGeneralError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError(undefined);
    setPasswordError(undefined);
    setGeneralError(undefined);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError(t('auth.login.emailRequired'));
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError(t('auth.login.emailInvalid'));
      isValid = false;
    }

    if (!password) {
      setPasswordError(t('auth.login.passwordRequired'));
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (isLoading) return; // Prevent duplicate submits

    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError(undefined);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
      });

      if (response && response.user) {
        onLoginSuccess(response.user);
      }
    } catch (err: any) {
      setGeneralError(err?.message || t('auth.login.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable testID="login-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <View style={styles.content}>
          {/* Top Brand Logo */}
          <View style={styles.header}>
            <View
              style={[
                styles.logoWrapper,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Shield size={36} color={colors.buttonPrimaryBg} />
            </View>
            <Text style={[typography.pageTitle, styles.title, { color: colors.textPrimary }]}>
              {t('auth.login.title')}
            </Text>
            <Text style={[typography.bodyMedium, styles.subtitle, { color: colors.textSecondary }]}>
              {t('auth.login.subtitle')}
            </Text>
          </View>

          {/* Error Feedback */}
          {generalError ? (
            <View style={{ marginBottom: spacing.lg }}>
              <ErrorState
                title={t('auth.login.errorTitle')}
                message={generalError}
                testID="login-error-state"
              />
            </View>
          ) : null}

          {/* Development Network & Test Accounts Helper */}
          <DevEnvironmentPanel
            onSelectTestAccount={(testEmail, testPass) => {
              setEmail(testEmail);
              setPassword(testPass);
              setEmailError(undefined);
              setPasswordError(undefined);
              setGeneralError(undefined);
            }}
          />

          {/* Form Fields */}
          <View style={styles.form}>
            <Input
              label={t('auth.login.emailLabel')}
              placeholder={t('auth.login.emailPlaceholder')}
              value={email}
              onChangeText={text => {
                setEmail(text);
                if (emailError) setEmailError(undefined);
              }}
              errorText={emailError}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              disabled={isLoading}
              leftIcon={<Mail size={iconSize.md} color={colors.textSecondary} />}
              testID="input-email"
            />

            <PasswordInput
              label={t('auth.login.passwordLabel')}
              placeholder={t('auth.login.passwordPlaceholder')}
              value={password}
              onChangeText={text => {
                setPassword(text);
                if (passwordError) setPasswordError(undefined);
              }}
              errorText={passwordError}
              disabled={isLoading}
              testID="input-password"
            />

            {/* Forgot Password Link */}
            {onNavigateForgotPassword ? (
              <TouchableOpacity
                onPress={onNavigateForgotPassword}
                disabled={isLoading}
                style={styles.forgotPasswordLink}
                accessibilityRole="button"
                accessibilityLabel={t('auth.login.forgotPasswordA11y')}
                testID="link-forgot-password"
              >
                <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600' }]}>
                  {t('auth.login.forgotPassword')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Submit Button */}
            <View style={[styles.submitContainer, { marginTop: spacing.md }]}>
              <Button
                label={t('auth.login.submit')}
                onPress={handleSubmit}
                loading={isLoading}
                disabled={isLoading}
                variant="primary"
                size="lg"
                fullWidth
                testID="btn-login-submit"
                accessibilityLabel={t('auth.login.submitA11y')}
              />
            </View>
          </View>

          {/* Footer Options */}
          {onNavigateVerifyCert ? (
            <View style={[styles.footer, { marginTop: spacing.xl }]}>
              <TouchableOpacity
                onPress={onNavigateVerifyCert}
                disabled={isLoading}
                style={styles.verifyCertLink}
                accessibilityRole="button"
                accessibilityLabel={t('auth.common.verifyOfficialCertificate')}
                testID="link-verify-cert"
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {t('auth.login.haveCode')}{' '}
                  <Text style={{ color: colors.buttonPrimaryBg, fontWeight: '700' }}>
                    {t('auth.login.verifyHere')}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  form: {
    width: '100%',
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  submitContainer: {
    width: '100%',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  verifyCertLink: {
    padding: 8,
  },
});
