import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';

/**
 * The BeltFlow mark, built in motion and shown in real 3D perspective.
 *
 * Sequence (about 1.3 s):
 *   1. the belt band sweeps in,
 *   2. the two tails drop from the knot,
 *   3. the knot flips in on its vertical axis and lands with a spring,
 *   4. the finished mark keeps tilting slowly in perspective over a soft,
 *      pulsing glow.
 * Under Jest the finished mark is rendered immediately (no timers).
 */
const MOTION_ENABLED = process.env.NODE_ENV !== 'test';
const VIEW_BOX = '0 100 1024 1024';

const Gradients = () => (
  <Defs>
    <LinearGradient id="alGold" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#FFD27A" />
      <Stop offset="1" stopColor="#F2941C" />
    </LinearGradient>
    <LinearGradient id="alGoldDeep" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#F2941C" />
      <Stop offset="1" stopColor="#D0760A" />
    </LinearGradient>
    <LinearGradient id="alKnot" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor="#FFFFFF" />
      <Stop offset="1" stopColor="#E3E9F2" />
    </LinearGradient>
  </Defs>
);

const Tails = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox={VIEW_BOX}>
    <Gradients />
    <Path d="M436 546 L548 546 L420 864 Q412 884 392 876 L318 848 Q298 840 306 820 Z" fill="#8F4F05" />
    <Path d="M476 546 L588 546 L718 820 Q726 840 706 848 L632 876 Q612 884 604 864 Z" fill="#A85F07" />
    <Path d="M436 520 L548 520 L420 838 Q412 858 392 850 L318 822 Q298 814 306 794 Z" fill="url(#alGoldDeep)" />
    <Path d="M476 520 L588 520 L718 794 Q726 814 706 822 L632 850 Q612 858 604 838 Z" fill="url(#alGold)" />
  </Svg>
);

const Band = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox={VIEW_BOX}>
    <Gradients />
    <Rect x="112" y="412" width="800" height="124" rx="30" fill="#A85F07" />
    <Rect x="112" y="386" width="800" height="124" rx="30" fill="url(#alGold)" />
    <Rect x="140" y="398" width="744" height="22" rx="11" fill="#FFFFFF" opacity={0.38} />
  </Svg>
);

const Knot = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox={VIEW_BOX}>
    <Gradients />
    <Rect x="396" y="374" width="232" height="204" rx="44" fill="#A9B6C9" />
    <Rect x="396" y="346" width="232" height="204" rx="44" fill="url(#alKnot)" />
    <Path d="M452 346 L512 346 L452 550 L440 550 Q396 550 396 506 L396 470 Z" fill="#D5DDE9" />
  </Svg>
);

export interface AnimatedLogoProps {
  size?: number;
  /** Keep tilting in 3D after the build. */
  loop?: boolean;
  /** Soft pulsing glow behind the mark (for dark backgrounds). */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ size = 132, loop = true, glow = true, style, testID }) => {
  const start = MOTION_ENABLED ? 0 : 1;
  const [band] = useState(() => new Animated.Value(start));
  const [tails] = useState(() => new Animated.Value(start));
  const [knot] = useState(() => new Animated.Value(start));
  const [tilt] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!MOTION_ENABLED) return;
    const build = Animated.sequence([
      Animated.timing(band, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tails, { toValue: 1, duration: 340, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.spring(knot, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]);
    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(tilt, { toValue: -1, duration: 4400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    build.start(() => {
      if (loop) tiltLoop.start();
    });
    if (glow) pulseLoop.start();
    return () => {
      build.stop();
      tiltLoop.stop();
      pulseLoop.stop();
    };
  }, [band, tails, knot, tilt, pulse, loop, glow]);

  const layer = StyleSheet.absoluteFill;

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {glow ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: size * 0.9,
            height: size * 0.9,
            borderRadius: size,
            backgroundColor: '#F2941C',
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.24] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
          }}
        />
      ) : null}

      {/* The whole mark tilts in perspective */}
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [
            { perspective: 700 },
            { rotateY: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-22deg', '22deg'] }) },
            { rotateX: tilt.interpolate({ inputRange: [-1, 0, 1], outputRange: ['6deg', '0deg', '6deg'] }) },
          ],
        }}
      >
        <Animated.View
          style={[
            layer,
            {
              opacity: tails,
              transform: [
                { translateY: tails.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.22, 0] }) },
                { scaleY: tails.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              ],
            },
          ]}
        >
          <Tails size={size} />
        </Animated.View>

        <Animated.View
          style={[
            layer,
            {
              opacity: band.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              transform: [{ scaleX: band.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }],
            },
          ]}
        >
          <Band size={size} />
        </Animated.View>

        <Animated.View
          style={[
            layer,
            {
              opacity: knot.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
              transform: [
                { perspective: 600 },
                { rotateY: knot.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '0deg'] }) },
                { scale: knot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ],
            },
          ]}
        >
          <Knot size={size} />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

export interface AnimatedWordmarkProps {
  text: string;
  color?: string;
  accentColor?: string;
  /** Characters from this index on use the accent colour ("Belt" + "Flow"). */
  accentFrom?: number;
  fontSize?: number;
  /** Milliseconds to wait before the first letter rises. */
  delay?: number;
}

/** The app name, each letter rising into place one after another. */
export const AnimatedWordmark: React.FC<AnimatedWordmarkProps> = ({
  text,
  color = '#FFFFFF',
  accentColor = '#F2941C',
  accentFrom = 4,
  fontSize = 38,
  delay = 900,
}) => {
  const letters = Array.from(text);
  const [values] = useState(() => letters.map(() => new Animated.Value(MOTION_ENABLED ? 0 : 1)));

  useEffect(() => {
    if (!MOTION_ENABLED) return;
    const animation = Animated.stagger(
      45,
      values.map(v => Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }))
    );
    const timer = setTimeout(() => animation.start(), delay);
    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [values, delay]);

  return (
    <View style={{ flexDirection: 'row' }} accessible accessibilityRole="header" accessibilityLabel={text}>
      {letters.map((ch, i) => (
        <Animated.Text
          key={`${ch}-${i}`}
          style={{
            fontSize,
            lineHeight: fontSize * 1.2,
            fontWeight: '800',
            letterSpacing: -0.6,
            color: i >= accentFrom ? accentColor : color,
            opacity: values[i],
            transform: [{ translateY: values[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }}
        >
          {ch}
        </Animated.Text>
      ))}
    </View>
  );
};
