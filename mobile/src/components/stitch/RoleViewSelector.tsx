import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { StitchTokens } from '../../theme/tokens';

export interface RoleViewSelectorProps {
  roles: { key: string; label: string; icon?: string }[];
  activeRoleKey: string;
  onSelectRole: (key: string) => void;
  style?: ViewStyle;
}

export const RoleViewSelector: React.FC<RoleViewSelectorProps> = ({
  roles,
  activeRoleKey,
  onSelectRole,
  style,
}) => {
  return (
    <View style={[styles.container, style]} testID="role-view-selector">
      {roles.map((r) => {
        const isActive = activeRoleKey === r.key;
        return (
          <TouchableOpacity
            key={r.key}
            style={[styles.btn, isActive && styles.activeBtn]}
            onPress={() => onSelectRole(r.key)}
            testID={`btn-role-select-${r.key}`}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, isActive && styles.activeBtnText]}>
              {r.icon ? `${r.icon} ` : ''}
              {r.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: StitchTokens.colors.brandNavyLight,
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: StitchTokens.radii.btnSm,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  activeBtn: {
    backgroundColor: StitchTokens.colors.colorAccent,
  },
  btnText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
