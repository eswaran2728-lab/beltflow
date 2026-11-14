import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StitchTokens } from '../theme/tokens';
import { LOCALES, LOCALE_NAMES, useI18n } from '../i18n';

/**
 * H28: app-wide language choice (English, Bahasa Melayu, Tamil). The choice
 * applies immediately and is remembered on this device.
 */
export const LanguageSelector: React.FC<{ testID?: string }> = ({ testID = 'language-selector' }) => {
  const { locale, setLocale, t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{t('language.title')}</Text>
      <Text style={styles.description}>{t('language.description')}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('language.title')} testID={testID}>
        {LOCALES.map(code => {
          const selected = code === locale;
          return (
            <TouchableOpacity
              key={code}
              onPress={() => setLocale(code)}
              style={[styles.option, selected && styles.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={LOCALE_NAMES[code]}
              testID={`language-option-${code}`}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {selected ? '✓ ' : ''}{LOCALE_NAMES[code]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const c = StitchTokens.colors;
const styles = StyleSheet.create({
  wrap: { marginTop: StitchTokens.spacing.lg },
  title: { fontSize: StitchTokens.typography.sizes.subheading, fontWeight: '800', color: c.slateTextMain },
  description: { fontSize: StitchTokens.typography.sizes.bodySm, color: c.slateTextMuted, marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: StitchTokens.spacing.md },
  option: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: StitchTokens.spacing.lg, paddingVertical: StitchTokens.spacing.sm,
    borderRadius: StitchTokens.radii.pill, borderWidth: 1, borderColor: c.slateBorder, backgroundColor: c.white,
    marginRight: StitchTokens.spacing.md, marginBottom: StitchTokens.spacing.md,
  },
  optionSelected: { backgroundColor: c.brandNavy, borderColor: c.brandNavy },
  optionText: { fontSize: StitchTokens.typography.sizes.body, fontWeight: '700', color: c.slateTextMain },
  optionTextSelected: { color: c.white },
});

export default LanguageSelector;
