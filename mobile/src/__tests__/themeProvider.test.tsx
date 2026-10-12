import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

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
});
