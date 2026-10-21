import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LayoutDashboard, Users, Award, CreditCard, Video } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';

export type StitchTabKey = 'today' | 'students' | 'grading' | 'fees' | 'media';

export interface StitchTabItem {
  key: StitchTabKey;
  label: string;
  iconName: 'today' | 'students' | 'grading' | 'fees' | 'media';
}

export interface StitchBottomNavProps {
  activeTab: StitchTabKey;
  onTabChange: (key: StitchTabKey) => void;
  tabs?: StitchTabItem[];
  style?: ViewStyle;
}

const defaultTabs: StitchTabItem[] = [
  { key: 'today', label: 'Today', iconName: 'today' },
  { key: 'students', label: 'Students', iconName: 'students' },
  { key: 'grading', label: 'Grading', iconName: 'grading' },
  { key: 'fees', label: 'Fees', iconName: 'fees' },
  { key: 'media', label: 'Feedback', iconName: 'media' },
];

export const StitchBottomNav: React.FC<StitchBottomNavProps> = ({
  activeTab,
  onTabChange,
  tabs = defaultTabs,
  style,
}) => {
  const renderIcon = (iconName: string, isCurrent: boolean) => {
    const color = isCurrent ? StitchTokens.colors.colorAccent : '#94A3B8';
    const size = 18;

    switch (iconName) {
      case 'today':
        return <LayoutDashboard size={size} color={color} />;
      case 'students':
        return <Users size={size} color={color} />;
      case 'grading':
        return <Award size={size} color={color} />;
      case 'fees':
        return <CreditCard size={size} color={color} />;
      case 'media':
        return <Video size={size} color={color} />;
      default:
        return <LayoutDashboard size={size} color={color} />;
    }
  };

  return (
    <View style={[styles.navContainer, style]} testID="stitch-bottom-nav">
      {tabs.map((tab) => {
        const isCurrent = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabChange(tab.key)}
            testID={`tab-${tab.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isCurrent }}
            accessibilityLabel={tab.label}
          >
            {renderIcon(tab.iconName, isCurrent)}
            <Text
              style={[
                styles.tabLabel,
                isCurrent ? styles.activeTabLabel : styles.inactiveTabLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: StitchTokens.colors.slateBorder,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 44,
    gap: 3,
  },
  tabLabel: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 10,
  },
  activeTabLabel: {
    color: StitchTokens.colors.colorAccent,
    fontWeight: '700',
  },
  inactiveTabLabel: {
    color: '#94A3B8',
    fontWeight: '500',
  },
});
