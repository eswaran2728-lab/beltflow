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
import { authService } from '../../services/authService';
import { AuthUser } from '../../types/auth';

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
      setEmailError('Please enter your email address');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter your password');
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
      setGeneralError(err?.message || 'Login failed. Please check your credentials.');
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
              Sign In to BeltFlow
            </Text>
            <Text style={[typography.bodyMedium, styles.subtitle, { color: colors.textSecondary }]}>
              Access your academy syllabus, attendance, and grading
            </Text>
          </View>

          {/* Error Feedback */}
          {generalError ? (
            <View style={{ marginBottom: spacing.lg }}>
              <ErrorState
                title="Sign In Error"
                message={generalError}
                testID="login-error-state"
              />
            </View>
          ) : null}

          {/* Form Fields */}
          <View style={styles.form}>
            <Input
              label="Email Address"
              placeholder="e.g. master@beltflow.com"
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
              label="Password"
              placeholder="Enter your password"
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
                accessibilityLabel="Forgot Password"
                testID="link-forgot-password"
              >
                <Text style={[typography.caption, { color: colors.buttonPrimaryBg, fontWeight: '600' }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Submit Button */}
            <View style={[styles.submitContainer, { marginTop: spacing.md }]}>
              <Button
                label="Sign In"
                onPress={handleSubmit}
                loading={isLoading}
                disabled={isLoading}
                variant="primary"
                size="lg"
                fullWidth
                testID="btn-login-submit"
                accessibilityLabel="Sign In Button"
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
                accessibilityLabel="Verify Official Certificate"
                testID="link-verify-cert"
              >
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Have a grading certificate code?{' '}
                  <Text style={{ color: colors.buttonPrimaryBg, fontWeight: '700' }}>
                    Verify Here
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
