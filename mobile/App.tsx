import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function MainAppShell() {
  const { colors, typography, spacing, borderRadius, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.content, { paddingHorizontal: spacing.xxl }]}>
        <View style={[styles.badge, { backgroundColor: colors.buttonPrimaryBg, borderRadius: borderRadius.full }]}>
          <Text style={styles.badgeText}>PHASE 1 FOUNDATION</Text>
        </View>
        
        <Text style={[styles.title, typography.display, { color: colors.textPrimary }]}>
          BeltFlow
        </Text>
        <Text style={[styles.subtitle, typography.bodyLarge, { color: colors.textSecondary }]}>
          Martial Arts Academy Management
        </Text>
        
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
          <Text style={[styles.cardHeader, typography.caption, { color: colors.buttonPrimaryBg }]}>
            Target Platforms
          </Text>
          <View style={styles.platformRow}>
            <View style={[styles.platformPill, { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.sm }]}>
              <Text style={[styles.platformText, { color: colors.textPrimary }]}>Android</Text>
            </View>
            <View style={[styles.platformPill, { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.sm }]}>
              <Text style={[styles.platformText, { color: colors.textPrimary }]}>iOS</Text>
            </View>
          </View>
          
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <Text style={[styles.cardHeader, typography.caption, { color: colors.buttonPrimaryBg }]}>
            5 Supported Portals
          </Text>
          <Text style={[styles.roleList, typography.bodyMedium, { color: colors.textPrimary }]}>
            • Super Admin{'\n'}
            • Persatuan Admin{'\n'}
            • Master (Coach){'\n'}
            • Parent{'\n'}
            • Student
          </Text>
        </View>

        <View style={styles.statusFooter}>
          <View style={[styles.statusDot, { backgroundColor: colors.badgeSuccessText }]} />
          <Text style={[styles.statusText, typography.caption, { color: colors.textSecondary }]}>
            Theme Foundation & Tokens Active
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider defaultMode="dark">
        <MainAppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 32,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    padding: 20,
    borderWidth: 1,
  },
  cardHeader: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  platformPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  platformText: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  roleList: {
    lineHeight: 22,
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 36,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontWeight: '500',
  },
});
