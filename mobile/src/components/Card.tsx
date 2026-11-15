import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  AccessibilityRole,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { depth } from '../theme/spacing';

// Skipped under Jest so tests stay synchronous.
const CARD_MOTION = process.env.NODE_ENV !== 'test';

export type CardVariant = 'standard' | 'elevated' | 'interactive';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'standard',
  padding,
  onPress,
  style,
  testID,
  accessibilityLabel,
  accessibilityRole,
}) => {
  const { colors, borderRadius, spacing, elevation, isDark } = useTheme();

  const cardPadding = padding !== undefined ? padding : spacing.lg;

  // Cards fade in and rise slightly when they first appear.
  const [appear] = useState(() => new Animated.Value(CARD_MOTION ? 0 : 1));
  useEffect(() => {
    if (!CARD_MOTION) return;
    const animation = Animated.timing(appear, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [appear]);
  const entrance = {
    opacity: appear,
    transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };

  const cardStyle: ViewStyle = {
    backgroundColor: variant === 'elevated' ? colors.surfaceElevated : colors.surface,
    borderColor: colors.borderLight,
    borderWidth: 1,
    borderBottomWidth: depth.cardEdge,
    borderBottomColor: isDark ? colors.border : depth.edge.surface,
    borderRadius: borderRadius.lg,
    padding: cardPadding,
    ...(variant === 'elevated' ? elevation.md : elevation.sm),
  };

  if (variant === 'interactive' && onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[cardStyle, style]}
        testID={testID}
        accessibilityRole={accessibilityRole || 'button'}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View
      style={[cardStyle, style, entrance]}
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Animated.View>
  );
};
