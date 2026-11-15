import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';

/**
 * Motion for the 3D theme. Short, purposeful, and never blocking:
 *  - Entrance: content fades in and rises a few points.
 *  - PopIn: the logo springs in, then floats gently.
 *  - usePressDepth: a button sinks onto its edge while pressed.
 *  - useCountUp: numbers count up to their value.
 *  - Shimmer: loading placeholder bars with a moving highlight.
 * Animations are skipped under Jest so tests stay synchronous.
 */
const MOTION_ENABLED = process.env.NODE_ENV !== 'test';

export interface EntranceProps {
  children: React.ReactNode;
  /** Milliseconds before the animation starts (use to stagger a list). */
  delay?: number;
  /** How far the content rises, in points. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

export const Entrance: React.FC<EntranceProps> = ({ children, delay = 0, distance = 14, style }) => {
  const [progress] = useState(() => new Animated.Value(MOTION_ENABLED ? 0 : 1));

  useEffect(() => {
    if (!MOTION_ENABLED) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export interface PopInProps {
  children: React.ReactNode;
  /** Keep floating up and down after the entrance. */
  float?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const PopIn: React.FC<PopInProps> = ({ children, float = false, style }) => {
  const [scale] = useState(() => new Animated.Value(MOTION_ENABLED ? 0.6 : 1));
  const [opacity] = useState(() => new Animated.Value(MOTION_ENABLED ? 0 : 1));
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!MOTION_ENABLED) return;
    const entrance = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    entrance.start(() => {
      if (float) loop.start();
    });
    return () => {
      entrance.stop();
      loop.stop();
    };
  }, [scale, opacity, drift, float]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ scale }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

/**
 * Press feedback for raised (3D) buttons: the face moves down by `depth`
 * points while pressed, as if the key were pushed onto its edge.
 */
export function usePressDepth(depth = 3) {
  const [pressed] = useState(() => new Animated.Value(0));
  const to = (toValue: number) => {
    if (!MOTION_ENABLED) return;
    Animated.timing(pressed, { toValue, duration: toValue ? 60 : 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  return {
    onPressIn: () => to(1),
    onPressOut: () => to(0),
    animatedStyle: {
      transform: [
        { translateY: pressed.interpolate({ inputRange: [0, 1], outputRange: [0, depth] }) },
        { scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) },
      ],
    },
  };
}

/**
 * Counts up to a whole number (returns other values unchanged), so figures on
 * dashboards arrive instead of just appearing. "12" and 12 both count.
 */
export function useCountUp<T extends string | number>(value: T, duration = 700): T | string | number {
  const target = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : NaN;
  const animate = MOTION_ENABLED && Number.isInteger(target) && target > 0 && target < 100000;
  const [shown, setShown] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) return;
    let frame = 0;
    const startedAt = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, duration]);

  if (!animate) return value;
  return typeof value === 'number' ? shown : String(shown);
}

export interface ShimmerProps {
  /** Number of placeholder bars. */
  lines?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Placeholder bars that pulse while content loads. */
export const Shimmer: React.FC<ShimmerProps> = ({ lines = 3, color = '#DDE3EC', style }) => {
  const [phase] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!MOTION_ENABLED) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  const widths = ['92%', '74%', '58%', '82%'] as const;
  return (
    <View style={[{ width: '100%', gap: 10 }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            height: 14,
            width: widths[i % widths.length],
            borderRadius: 7,
            backgroundColor: color,
            opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
          }}
        />
      ))}
    </View>
  );
};
