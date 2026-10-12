import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from './src/theme/colors';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.content}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PHASE 1 FOUNDATION</Text>
          </View>
          
          <Text style={styles.title}>BeltFlow</Text>
          <Text style={styles.subtitle}>Martial Arts Academy Management</Text>
          
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Target Platforms</Text>
            <View style={styles.platformRow}>
              <View style={styles.platformPill}>
                <Text style={styles.platformText}>Android</Text>
              </View>
              <View style={styles.platformPill}>
                <Text style={styles.platformText}>iOS</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <Text style={styles.cardHeader}>5 Supported Portals</Text>
            <Text style={styles.roleList}>
              • Super Admin{'\n'}
              • Persatuan Admin{'\n'}
              • Master (Coach){'\n'}
              • Parent{'\n'}
              • Student
            </Text>
          </View>

          <View style={styles.statusFooter}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Workspace Initialized & Verified</Text>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navyDark,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.amber,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textLight,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textLightMuted,
    marginTop: 4,
    marginBottom: 32,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.navySurface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.amber,
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
    backgroundColor: Colors.navyLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  platformText: {
    color: Colors.textLight,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderDark,
    marginVertical: 12,
  },
  roleList: {
    color: Colors.textLight,
    fontSize: 14,
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
    backgroundColor: Colors.success,
  },
  statusText: {
    color: Colors.textLightMuted,
    fontSize: 13,
    fontWeight: '500',
  },
});
