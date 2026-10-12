import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  StyleProp,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  testID,
  accessibilityLabel,
}) => {
  const { colors, typography, borderRadius, layout, spacing } = useTheme();

  const isInteractive = !disabled && !loading;

  // Resolve container styles based on variant
  const getContainerStyle = (): ViewStyle => {
    if (disabled) {
      return {
        backgroundColor: colors.disabled,
        borderColor: colors.disabled,
      };
    }

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.buttonPrimaryBg,
          borderColor: colors.buttonPrimaryBg,
        };
      case 'secondary':
        return {
          backgroundColor: colors.buttonSecondaryBg,
          borderColor: colors.buttonSecondaryBg,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.buttonOutlineBorder,
        };
      case 'danger':
        return {
          backgroundColor: colors.buttonDangerBg,
          borderColor: colors.buttonDangerBg,
        };
    }
  };

  // Resolve label color
  const getLabelColor = (): string => {
    if (disabled) return colors.disabledText;

    switch (variant) {
      case 'primary':
        return colors.buttonPrimaryText;
      case 'secondary':
        return colors.buttonSecondaryText;
      case 'outline':
        return colors.buttonOutlineText;
      case 'danger':
        return colors.buttonDangerText;
    }
  };

  // Resolve height & padding based on size (min touch target >= 44pt for md/lg)
  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          minHeight: 36,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
        };
      case 'md':
        return {
          minHeight: layout.minTouchTarget, // 44pt
          paddingHorizontal: spacing.lg,
          paddingVertical: 10,
        };
      case 'lg':
        return {
          minHeight: 52,
          paddingHorizontal: spacing.xl,
          paddingVertical: 14,
        };
    }
  };

  return (
    <TouchableOpacity
      onPress={isInteractive ? onPress : undefined}
      activeOpacity={isInteractive ? 0.75 : 1}
      disabled={!isInteractive}
      style={[
        styles.baseButton,
        { borderRadius: borderRadius.md },
        getSizeStyle(),
        getContainerStyle(),
        fullWidth && styles.fullWidth,
        style,
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={getLabelColor()}
          testID={`${testID}-spinner`}
        />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}
          <Text style={[typography.button, { color: getLabelColor() }]}>
            {label}
          </Text>
          {rightIcon && <View style={styles.rightIconWrapper}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIconWrapper: {
    marginRight: 8,
  },
  rightIconWrapper: {
    marginLeft: 8,
  },
});
