import React from 'react';
import {
  Animated,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  View,
  StyleProp,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { depth } from '../theme/spacing';
import { usePressDepth } from './motion';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label?: string;
  title?: string;
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
  title,
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
  const { colors, typography, borderRadius, layout, spacing, elevation, isDark } = useTheme();
  const displayLabel = label || title || '';
  const press = usePressDepth(size === 'sm' ? 2 : 3);

  const isInteractive = !disabled && !loading;

  // Resolve container styles based on variant
  const getContainerStyle = (): ViewStyle => {
    // Every button has a darker bottom edge (its thickness) so it reads as raised.
    const edge = size === 'sm' ? 3 : depth.buttonEdge;
    if (disabled) {
      return {
        backgroundColor: colors.disabled,
        borderColor: colors.disabled,
        borderBottomWidth: edge,
        borderBottomColor: isDark ? colors.border : depth.edge.disabled,
      };
    }

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.buttonPrimaryBg,
          borderColor: colors.buttonPrimaryBg,
          borderBottomWidth: edge,
          borderBottomColor: isDark ? depth.edge.amber : depth.edge.navy,
          ...elevation.sm,
        };
      case 'secondary':
        return {
          backgroundColor: colors.buttonSecondaryBg,
          borderColor: colors.buttonSecondaryBg,
          borderBottomWidth: edge,
          borderBottomColor: isDark ? depth.edge.navy : depth.edge.amber,
          ...elevation.sm,
        };
      case 'outline':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
          borderBottomWidth: edge,
          borderBottomColor: isDark ? colors.border : depth.edge.surface,
        };
      case 'danger':
        return {
          backgroundColor: colors.buttonDangerBg,
          borderColor: colors.buttonDangerBg,
          borderBottomWidth: edge,
          borderBottomColor: depth.edge.danger,
          ...elevation.sm,
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
          minHeight: 40,
          paddingHorizontal: spacing.lg,
          paddingVertical: 8,
        };
      case 'md':
        return {
          minHeight: Math.max(layout.minTouchTarget, 48),
          paddingHorizontal: spacing.xl,
          paddingVertical: 12,
        };
      case 'lg':
        return {
          minHeight: 56,
          paddingHorizontal: spacing.xxl,
          paddingVertical: 16,
        };
    }
  };

  return (
    <AnimatedTouchable
      onPress={isInteractive ? onPress : undefined}
      onPressIn={isInteractive ? press.onPressIn : undefined}
      onPressOut={press.onPressOut}
      activeOpacity={isInteractive ? 0.9 : 1}
      disabled={!isInteractive}
      style={[
        styles.baseButton,
        { borderRadius: borderRadius.md },
        getSizeStyle(),
        getContainerStyle(),
        fullWidth && styles.fullWidth,
        style,
        press.animatedStyle,
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || displayLabel}
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
          <Text style={[typography.button, size === 'sm' && { fontSize: 13.5 }, { color: getLabelColor(), flexShrink: 1 }]} numberOfLines={1}>
            {displayLabel}
          </Text>
          {rightIcon && <View style={styles.rightIconWrapper}>{rightIcon}</View>}
        </View>
      )}
    </AnimatedTouchable>
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
