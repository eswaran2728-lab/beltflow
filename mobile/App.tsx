import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { I18nProvider } from './src/i18n';

function BeltFlowRoot() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider defaultMode="dark">
        <I18nProvider>
          <BeltFlowRoot />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
