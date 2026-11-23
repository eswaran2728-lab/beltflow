import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useI18n } from '../i18n';
import { getApiBaseUrl } from '../config/env';

/**
 * Links to the legal pages (privacy notice, terms, refunds). The pages are
 * served by the BeltFlow server at /legal and open in the phone's browser.
 */
const PAGES = [
  { key: 'auth.legal.privacy', path: '/legal/privacy.html', testID: 'link-legal-privacy' },
  { key: 'auth.legal.terms', path: '/legal/terms.html', testID: 'link-legal-terms' },
  { key: 'auth.legal.refunds', path: '/legal/refunds.html', testID: 'link-legal-refunds' },
] as const;

export const LegalLinks: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { colors, typography } = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.row, style]} testID="legal-links">
      {PAGES.map(page => (
        <TouchableOpacity
          key={page.path}
          onPress={() => {
            Linking.openURL(`${getApiBaseUrl()}${page.path}`).catch(() => undefined);
          }}
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel={t(page.key)}
          accessibilityHint={t('auth.legal.opens')}
          testID={page.testID}
        >
          <Text style={[typography.bodyMedium, { color: colors.buttonPrimaryBg, fontWeight: '600', textDecorationLine: 'underline' }]}>
            {t(page.key)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 18,
  },
  link: {
    // 44pt touch target
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
