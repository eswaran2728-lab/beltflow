import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { CheckCircle2, Clock } from 'lucide-react-native';
import { StitchTokens } from '../../theme/tokens';

export interface TechniqueItem {
  id: string;
  name: string;
  isCompleted: boolean;
}

export interface TechniqueChecklistCardProps {
  syllabusTitle: string;
  techniques: TechniqueItem[];
  style?: ViewStyle;
}

export const TechniqueChecklistCard: React.FC<TechniqueChecklistCardProps> = ({
  syllabusTitle,
  techniques,
  style,
}) => {
  const completedCount = techniques.filter((t) => t.isCompleted).length;
  const totalCount = techniques.length;

  return (
    <View style={[styles.card, style]} testID="technique-checklist-card">
      <View style={styles.headerRow}>
        <Text style={styles.syllabusTitle}>{syllabusTitle}</Text>
        <Text style={styles.readinessCounter}>
          {completedCount}/{totalCount} Ready
        </Text>
      </View>

      <View style={styles.list}>
        {techniques.map((tech) => (
          <View key={tech.id} style={styles.itemRow} testID={`technique-item-${tech.id}`}>
            {tech.isCompleted ? (
              <CheckCircle2 size={15} color={StitchTokens.colors.bfGreen} />
            ) : (
              <Clock size={15} color="#D97706" />
            )}
            <Text
              style={[
                styles.itemText,
                tech.isCompleted ? styles.completedText : styles.pendingText,
              ]}
            >
              {tech.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: StitchTokens.colors.slateBorder,
    borderRadius: StitchTokens.radii.cardMini,
    padding: 14,
    ...StitchTokens.shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  syllabusTitle: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: StitchTokens.colors.brandNavy,
  },
  readinessCounter: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: StitchTokens.colors.bfGreenDark,
  },
  list: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemText: {
    fontFamily: StitchTokens.typography.fontFamily,
    fontSize: 12,
  },
  completedText: {
    color: StitchTokens.colors.slateTextMain,
    fontWeight: '500',
  },
  pendingText: {
    color: StitchTokens.colors.slateTextMuted,
    fontWeight: '400',
  },
});
