import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';

/**
 * The BeltFlow mark: a tied belt with depth (gold band, white knot, two tails).
 * Same artwork as assets/brand/logo-mark.svg, which the app icon is rendered from.
 */
export interface BrandMarkProps {
  /** Width and height of the mark. */
  size?: number;
  /** Draws the mark on a rounded navy tile (for light backgrounds). */
  tile?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32, tile = false, style, testID }) => {
  const mark = (
    <Svg width={tile ? size * 0.8 : size} height={tile ? size * 0.8 : size} viewBox="0 100 1024 1024">
      <Defs>
        <LinearGradient id="bfGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFD27A" />
          <Stop offset="1" stopColor="#F2941C" />
        </LinearGradient>
        <LinearGradient id="bfGoldDeep" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F2941C" />
          <Stop offset="1" stopColor="#D0760A" />
        </LinearGradient>
        <LinearGradient id="bfKnot" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E3E9F2" />
        </LinearGradient>
      </Defs>
      {/* tails: thickness, then face */}
      <Path d="M436 546 L548 546 L420 864 Q412 884 392 876 L318 848 Q298 840 306 820 Z" fill="#8F4F05" />
      <Path d="M476 546 L588 546 L718 820 Q726 840 706 848 L632 876 Q612 884 604 864 Z" fill="#A85F07" />
      <Path d="M436 520 L548 520 L420 838 Q412 858 392 850 L318 822 Q298 814 306 794 Z" fill="url(#bfGoldDeep)" />
      <Path d="M476 520 L588 520 L718 794 Q726 814 706 822 L632 850 Q612 858 604 838 Z" fill="url(#bfGold)" />
      {/* band: thickness, face, highlight */}
      <Rect x="112" y="412" width="800" height="124" rx="30" fill="#A85F07" />
      <Rect x="112" y="386" width="800" height="124" rx="30" fill="url(#bfGold)" />
      <Rect x="140" y="398" width="744" height="22" rx="11" fill="#FFFFFF" opacity={0.38} />
      {/* knot: thickness, face, fold */}
      <Rect x="396" y="374" width="232" height="204" rx="44" fill="#A9B6C9" />
      <Rect x="396" y="346" width="232" height="204" rx="44" fill="url(#bfKnot)" />
      <Path d="M452 346 L512 346 L452 550 L440 550 Q396 550 396 506 L396 470 Z" fill="#D5DDE9" />
    </Svg>
  );

  if (!tile) {
    return (
      <View style={style} testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {mark}
      </View>
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: '#0D2B47',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {mark}
    </View>
  );
};
