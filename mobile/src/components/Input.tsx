import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TextInputProps,
} from 'react-native';
import { Eye, EyeOff, Search, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  errorText?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  errorText,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  disabled = false,
  testID,
  ...textInputProps
}) => {
  const { colors, typography, borderRadius, spacing } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!errorText;

  const getBorderColor = (): string => {
    if (hasError) return colors.badgeDangerText;
    if (isFocused) return colors.borderFocused;
    return colors.border;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            typography.caption,
            styles.label,
            { color: hasError ? colors.badgeDangerText : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: disabled ? colors.disabled : colors.surface,
            borderColor: getBorderColor(),
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}

        <TextInput
          {...textInputProps}
          editable={!disabled}
          onFocus={e => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          placeholderTextColor={colors.textMuted}
          style={[
            typography.bodyLarge,
            styles.textInput,
            { color: disabled ? colors.disabledText : colors.textPrimary },
          ]}
          testID={testID}
        />

        {rightIcon && <View style={styles.rightIconWrapper}>{rightIcon}</View>}
      </View>

      {hasError && (
        <Text style={[typography.caption, styles.feedbackText, { color: colors.badgeDangerText }]}>
          {errorText}
        </Text>
      )}

      {helperText && (
        <Text style={[typography.caption, styles.feedbackText, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      )}
    </View>
  );
};

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'>;

export const PasswordInput: React.FC<PasswordInputProps> = props => {
  const [isSecure, setIsSecure] = useState(true);
  const { colors, iconSize } = useTheme();
  const { t } = useI18n();

  return (
    <Input
      {...props}
      secureTextEntry={isSecure}
      rightIcon={
        <TouchableOpacity
          onPress={() => setIsSecure(!isSecure)}
          activeOpacity={0.7}
          testID={`${props.testID || 'input-password'}-toggle`}
          accessibilityRole="button"
          accessibilityLabel={isSecure ? t('components.input.showPassword') : t('components.input.hidePassword')}
        >
          {isSecure ? (
            <EyeOff size={iconSize.md} color={colors.textSecondary} />
          ) : (
            <Eye size={iconSize.md} color={colors.buttonPrimaryBg} />
          )}
        </TouchableOpacity>
      }
    />
  );
};

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onClear,
  value,
  ...props
}) => {
  const { colors, iconSize } = useTheme();
  const { t } = useI18n();

  return (
    <Input
      {...props}
      value={value}
      leftIcon={<Search size={iconSize.md} color={colors.textSecondary} />}
      rightIcon={
        value && value.length > 0 && onClear ? (
          <TouchableOpacity
            onPress={onClear}
            activeOpacity={0.7}
            testID="search-clear-btn"
            accessibilityRole="button"
            accessibilityLabel={t('components.input.clearSearch')}
          >
            <X size={iconSize.sm} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
  },
  leftIconWrapper: {
    marginRight: 10,
  },
  rightIconWrapper: {
    marginLeft: 10,
  },
  feedbackText: {
    marginTop: 4,
    marginLeft: 2,
  },
});
