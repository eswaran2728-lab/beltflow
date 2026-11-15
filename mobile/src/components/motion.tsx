import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/**
 * Motion for the 3D theme. Short, purposeful, and never blocking:
 *  - Entrance: content fades in and rises a few points.
 *  - PopIn: the logo springs in, then floats gently.
 *  - usePressDepth: a button sinks onto its edge while pressed.
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
