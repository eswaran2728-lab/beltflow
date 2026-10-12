import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { BeltLevelConfig } from '../theme/belts';

// ----------------------------------------------------------------------------
// 1. StatusBadge Component
// ----------------------------------------------------------------------------
export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  variant?: StatusBadgeVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  variant,
  style,
  testID,
}) => {
  const { colors, typography, borderRadius } = useTheme();

  // Infer semantic variant if not explicitly provided
  const resolvedVariant: StatusBadgeVariant = variant || (() => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE' || s === 'PAID' || s === 'COMPLETED' || s === 'PRESENT' || s === 'PASS') {
      return 'success';
    }
    if (s === 'PENDING' || s === 'PARTIALLY PAID' || s === 'LATE' || s === 'PENDING_STUDENT' || s === 'PENDING_MASTER' || s === 'PENDING_ADMIN') {
      return 'warning';
    }
    if (s === 'OVERDUE' || s === 'UNPAID' || s === 'REJECTED' || s === 'ABSENT' || s === 'FAIL' || s === 'CANCELLED') {
      return 'danger';
    }
    if (s === 'EXCUSED' || s === 'UPCOMING' || s === 'REGISTERED') {
      return 'info';
    }
    return 'neutral';
  })();

  const getVariantStyles = (): { bg: string; text: string } => {
    switch (resolvedVariant) {
      case 'success':
        return { bg: colors.badgeSuccessBg, text: colors.badgeSuccessText };
      case 'warning':
        return { bg: colors.badgeWarningBg, text: colors.badgeWarningText };
      case 'danger':
        return { bg: colors.badgeDangerBg, text: colors.badgeDangerText };
      case 'info':
        return { bg: colors.badgeInfoBg, text: colors.badgeInfoText };
      case 'neutral':
      default:
        return { bg: colors.badgeNeutralBg, text: colors.badgeNeutralText };
    }
  };

  const { bg, text } = getVariantStyles();
  const displayLabel = label || status;

  return (
    <View
      style={[
        styles.badgeBase,
        { backgroundColor: bg, borderRadius: borderRadius.full },
        style,
      ]}
      testID={testID}
    >
      <View style={[styles.statusDot, { backgroundColor: text }]} />
      <Text style={[typography.caption, { color: text, fontWeight: '700' }]}>
        {displayLabel}
      </Text>
    </View>
  );
};

// ----------------------------------------------------------------------------
// 2. BeltBadge Component (CRITICAL MULTI-TENANT CONFIGURABLE COMPONENT)
// ----------------------------------------------------------------------------
export interface BeltBadgeProps {
  beltName: string;
  colorHex?: string;
  customBelts?: readonly BeltLevelConfig[];
  showDanBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const BeltBadge: React.FC<BeltBadgeProps> = ({
  beltName,
  colorHex: explicitColor,
  customBelts,
  showDanBadge = false,
  size = 'md',
  style,
  testID,
}) => {
  const { resolveBeltDisplay, getBeltTextColor, getBeltBorderColor, borderRadius, typography } = useTheme();

  // Resolve against active Persatuan custom belt system (accepts optional component override or context)
  const resolved = resolveBeltDisplay(beltName, customBelts);

  const finalColorHex = explicitColor || resolved.colorHex;
  const finalTextColor = resolved.textColor || getBeltTextColor(finalColorHex);
  const finalBorderColor = resolved.borderColor || getBeltBorderColor(finalColorHex);
  const isDan = resolved.isDanRank || (showDanBadge && (beltName.toLowerCase().includes('dan') || beltName.toLowerCase().includes('asan')));

  const sizeStyles = {
    sm: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, dotSize: 6 },
    md: { paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, dotSize: 8 },
    lg: { paddingHorizontal: 14, paddingVertical: 6, fontSize: 13, dotSize: 10 },
  }[size];

  return (
    <View style={styles.beltBadgeWrapper}>
      <View
        style={[
          styles.badgeBase,
          {
            backgroundColor: finalColorHex,
            borderColor: finalBorderColor,
            borderWidth: finalBorderColor !== 'transparent' ? 1 : 0,
            borderRadius: borderRadius.md,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            paddingVertical: sizeStyles.paddingVertical,
          },
          style,
        ]}
        testID={testID}
      >
        <View
          style={[
            styles.statusDot,
            {
              width: sizeStyles.dotSize,
              height: sizeStyles.dotSize,
              borderRadius: sizeStyles.dotSize / 2,
              backgroundColor: finalTextColor,
              opacity: 0.8,
            },
          ]}
        />
        <Text
          style={[
            typography.caption,
            {
              color: finalTextColor,
              fontSize: sizeStyles.fontSize,
              fontWeight: '700',
              letterSpacing: 0.3,
            },
          ]}
        >
          {resolved.name}
        </Text>
      </View>

      {showDanBadge && isDan && (
        <View
          style={[
            styles.danPill,
            { borderRadius: borderRadius.full },
          ]}
          testID={`${testID || 'belt-badge'}-dan-pill`}
        >
          <Text style={[typography.caption, styles.danPillText]}>
            DAN 1
          </Text>
        </View>
      )}
    </View>
  );
};

// ----------------------------------------------------------------------------
// 3. SyncStatusBadge Component (Offline/Online Synchronization Indicator)
// ----------------------------------------------------------------------------
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';

export interface SyncStatusBadgeProps {
  status: SyncStatus;
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  label,
  style,
  testID,
}) => {
  const { colors, typography, borderRadius } = useTheme();

  const getSyncMetadata = () => {
    switch (status) {
      case 'synced':
        return {
          bg: colors.badgeSuccessBg,
          text: colors.badgeSuccessText,
          defaultLabel: 'Synced',
        };
      case 'pending':
        return {
          bg: colors.badgeWarningBg,
          text: colors.badgeWarningText,
          defaultLabel: 'Pending Sync',
        };
      case 'offline':
        return {
          bg: colors.offlineBg,
          text: colors.offlineText,
          defaultLabel: 'Offline',
        };
      case 'error':
        return {
          bg: colors.badgeDangerBg,
          text: colors.badgeDangerText,
          defaultLabel: 'Sync Error',
        };
    }
  };

  const { bg, text, defaultLabel } = getSyncMetadata();

  return (
    <View
      style={[
        styles.badgeBase,
        { backgroundColor: bg, borderRadius: borderRadius.full },
        style,
      ]}
      testID={testID}
    >
      <View style={[styles.statusDot, { backgroundColor: text }]} />
      <Text style={[typography.caption, { color: text, fontWeight: '600' }]}>
        {label || defaultLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  beltBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  danPill: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#F2941C',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  danPillText: {
    color: '#F2941C',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
