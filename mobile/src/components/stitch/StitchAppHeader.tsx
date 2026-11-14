import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Bell, Shield } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';
import { useI18n } from '../../i18n';

export interface StitchAppHeaderProps {
  dojangName?: string;
  roleBadgeText?: string;
  hasUnreadNotifications?: boolean;
  onNotificationPress?: () => void;
  /** Overrides the bell's screen-reader label, e.g. with the unread count. */
  notificationAccessibilityLabel?: string;
  style?: ViewStyle;
}

export const StitchAppHeader: React.FC<StitchAppHeaderProps> = ({
  dojangName: dojangNameProp,
  roleBadgeText,
  hasUnreadNotifications = true,
  onNotificationPress,
  notificationAccessibilityLabel,
  style,
}) => {
  const { t } = useI18n();
  const dojangName = dojangNameProp ?? t('components.header.defaultDojang');
  return (
    <View style={[styles.headerContainer, style]} testID="stitch-app-header">
      {/* Brand & Logo Area */}
      <View style={styles.brandGroup}>
        <View style={styles.logoBadge}>
          <Shield size={16} color={StitchTokens.colors.brandNavy} />
        </View>
        <Text style={styles.brandTitle}>BELTFLOW</Text>
      </View>

      {/* Dojang & Notifications Controls */}
      <View style={styles.controlGroup}>
        {roleBadgeText ? (
          <View style={styles.roleChip} testID="header-role-chip">
            <Text style={styles.roleChipText}>{roleBadgeText}</Text>
          </View>
        ) : null}

        <View style={styles.dojangChip} testID="header-dojang-chip">
          <Text style={styles.dojangChipText}>{dojangName}</Text>
        </View>

        <TouchableOpacity
          style={styles.bellButton}
          onPress={onNotificationPress}
          accessibilityLabel={notificationAccessibilityLabel ?? t('components.header.notificationsA11y')}
          accessibilityRole="button"
          testID="header-bell-btn"
        >
          <Bell size={18} color="#FFFFFF" />
          {hasUnreadNotifications && <View style={styles.bellDot} testID="bell-unread-dot" />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: StitchTokens.colors.brandNavy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dojangChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: StitchTokens.radii.chip,
    backgroundColor: 'rgba(242, 148, 28, 0.25)',
  },
  dojangChipText: {
    color: StitchTokens.colors.colorAccent,
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  roleChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  roleChipText: {
    color: '#FFFFFF',
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
    fontWeight: '600',
  },
  bellButton: {
    position: 'relative',
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: StitchTokens.colors.colorAccent,
    borderWidth: 1.5,
    borderColor: StitchTokens.colors.brandNavy,
  },
});
