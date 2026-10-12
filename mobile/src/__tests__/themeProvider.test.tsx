import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { BeltLevelConfig } from '../theme/belts';

describe('ThemeProvider & useTheme hook', () => {
  test('defaults to dark theme mode for BeltFlow signature dark appearance', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeMode).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(result.current.colors.background).toBe('#061828');
  });

  test('switches to light theme when explicitly requested', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      result.current.setThemeMode('light');
    });

    expect(result.current.themeMode).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(result.current.colors.background).toBe('#F8FAFC');
  });

  test('toggleTheme toggles between light and dark', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultMode="light">{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);

    await act(async () => {
      result.current.toggleTheme();
    });

    expect(result.current.isDark).toBe(true);
    expect(result.current.colors.background).toBe('#061828');

    await act(async () => {
      result.current.toggleTheme();
    });

    expect(result.current.isDark).toBe(false);
    expect(result.current.colors.background).toBe('#F8FAFC');
  });

  test('provides typography, spacing, borderRadius and belt utilities', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultMode="dark">{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    expect(result.current.typography).toBeDefined();
    expect(result.current.spacing).toBeDefined();
    expect(result.current.borderRadius).toBeDefined();
    expect(result.current.getBeltConfig('Yellow Belt').colorHex).toBe('#FACC15');
  });

  test('supports custom per-Persatuan belt configuration injection', async () => {
    const customAcademyBelts: BeltLevelConfig[] = [
      { id: 'custom_1', name: 'Junior White', order: 1, colorHex: '#FFFFFF' },
      { id: 'custom_2', name: 'Senior Bronze', order: 2, colorHex: '#CD7F32' },
    ];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider persatuanBelts={customAcademyBelts}>{children}</ThemeProvider>
    );

    const { result } = await renderHook(() => useTheme(), { wrapper });

    expect(result.current.belts).toHaveLength(2);
    expect(result.current.resolveBeltDisplay('Senior Bronze').colorHex).toBe('#CD7F32');
  });
});
