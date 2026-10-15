import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { StudentDigitalPass } from './StudentDigitalPass';
import { Card } from './Card';
import { Users } from 'lucide-react-native';

export interface LinkedChildPassData {
  id: string;
  organizationId: string;
  fullName: string;
  beltRank: string;
  status: string;
  persatuanName?: string;
}

export interface ParentChildPassViewerProps {
  childrenList: LinkedChildPassData[];
  isOffline?: boolean;
  testID?: string;
}

export const ParentChildPassViewer: React.FC<ParentChildPassViewerProps> = ({
  childrenList,
  isOffline = false,
  testID = 'parent-child-pass-viewer',
}) => {
  const { colors, typography } = useTheme();
  const [selectedChildId, setSelectedChildId] = useState<string>(
    childrenList.length > 0 ? childrenList[0].id : ''
  );

  const selectedChild = childrenList.find(c => c.id === selectedChildId) || childrenList[0];

  if (childrenList.length === 0) {
    return (
      <Card
        variant="standard"
        testID="parent-no-children-card"
        style={[styles.emptyContainer, { borderColor: colors.border }]}
      >
        <Users size={32} color={colors.textMuted} />
        <Text style={[typography.sectionHeading, { color: colors.textPrimary, marginTop: 12 }]}>
          No Approved Student Passes
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
          Parent-student link requests must be fully approved by student, Master, and academy administrator before digital passes can be accessed.
        </Text>
      </Card>
    );
  }

  return (
    <View testID={testID} style={styles.container}>
      {/* Child Switcher Tabs if multiple children */}
      {childrenList.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
          testID="child-selector-tabs"
        >
          {childrenList.map(child => {
            const isSelected = child.id === selectedChildId;
            return (
              <TouchableOpacity
                key={child.id}
                testID={`tab-child-${child.id}`}
                onPress={() => setSelectedChildId(child.id)}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: isSelected ? colors.buttonPrimaryBg : colors.surfaceElevated,
                    borderColor: isSelected ? colors.buttonPrimaryBg : colors.border,
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`View digital pass for ${child.fullName}`}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                  ]}
                >
                  {child.fullName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Selected Child Pass Card */}
      {selectedChild && (
        <StudentDigitalPass
          student={selectedChild}
          isOffline={isOffline}
          testID={`digital-pass-${selectedChild.id}`}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    marginVertical: 12,
  },
  tabsScroll: {
    marginBottom: 8,
  },
  tabsContent: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
