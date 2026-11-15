import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Bell } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { BrandMark } from '../BrandMark';
import { StitchTokens } from '../../theme/tokens';
import { useI18n } from '../../i18n';

export interface StitchAppHeaderProps {
  dojangName?: string;
  roleBadgeText?: string;
  hasUnreadNotifications?: boolean;
  onNotificationPress?: () => void;
  /** Overrides the bell's screen-reader label, e.g. with the unread count. */
  notificationAccessibilityLabel?: string;
  /**
   * Set when the header is the first child of a padded, scrolling
   * ScreenContainer: it then stretches edge to edge and to the top, and leaves
   * the status-bar spacing to the container's safe area.
   */
  inContainer?: boolean;
  style?: ViewStyle;
}

export const StitchAppHeader: React.FC<StitchAppHeaderProps> = ({
  dojangName: dojangNameProp,
  roleBadgeText,
  hasUnreadNotifications = true,
  onNotificationPress,
  notificationAccessibilityLabel,
  inContainer = false,
  style,
}) => {
  const { t } = useI18n();
  const dojangName = dojangNameProp ?? t('components.header.defaultDojang');
  return (
    <View style={[styles.headerContainer, inContainer && styles.inContainer, style]} testID="stitch-app-header">
      {/* Depth: a lit navy gradient with two soft glows instead of a flat bar */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="bfHeaderBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1B4A75" />
              <Stop offset="0.55" stopColor="#0D2B47" />
              <Stop offset="1" stopColor="#071B2E" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bfHeaderBg)" />
          <Circle cx="96%" cy="0%" r="110" fill="#F2941C" opacity={0.07} />
        </Svg>
      </View>
      <View style={styles.topRow}>
        {/* Brand */}
        <View style={styles.brandGroup}>
          <BrandMark size={30} />
          <Text style={styles.brandTitle}>BELTFLOW</Text>
        </View>

        <TouchableOpacity
          style={styles.bellButton}
          onPress={onNotificationPress}
          accessibilityLabel={notificationAccessibilityLabel ?? t('components.header.notificationsA11y')}
          accessibilityRole="button"
          testID="header-bell-btn"
        >
          <Bell size={20} color="#FFFFFF" />
          {hasUnreadNotifications && <View style={styles.bellDot} testID="bell-unread-dot" />}
        </TouchableOpacity>
      </View>

      {/* Who and where: role + academy, on their own line so nothing is cut off */}
      <View style={styles.contextRow}>
        {roleBadgeText ? (
          <View style={styles.roleChip} testID="header-role-chip">
            <Text style={styles.roleChipText} numberOfLines={1}>{roleBadgeText}</Text>
          </View>
        ) : null}
        <View style={styles.dojangChip} testID="header-dojang-chip">
          <Text style={styles.dojangChipText} numberOfLines={1}>{dojangName}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: StitchTokens.colors.brandNavy,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    // thickness under the header
    borderBottomWidth: 4,
    borderBottomColor: '#061828',
  },
  inContainer: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
    paddingTop: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dojangChip: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: StitchTokens.radii.pill,
    backgroundColor: 'rgba(242, 148, 28, 0.18)',
  },
  dojangChipText: {
    color: '#FFC566',
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  roleChip: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: StitchTokens.radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  roleChipText: {
    color: '#FFFFFF',
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bellButton: {
    position: 'relative',
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: StitchTokens.colors.colorAccent,
    borderWidth: 1.5,
    borderColor: StitchTokens.colors.brandNavy,
  },
});
