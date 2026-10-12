import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeColors, lightThemeColors, darkThemeColors, BrandColors } from './colors';
import { typography, TypographyScale } from './typography';
import { spacing, borderRadius, elevation, layout, iconSize, ElevationTokens } from './spacing';
import { BELT_RANKS, getBeltConfig, isLightBelt, BeltRankConfig } from './belts';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  typography: TypographyScale;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  elevation: ElevationTokens;
  layout: typeof layout;
  iconSize: typeof iconSize;
  belts: readonly BeltRankConfig[];
  getBeltConfig: (name: string) => BeltRankConfig;
  isLightBelt: (hex: string) => boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'dark', // BeltFlow defaults to its signature dark navy theme
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(defaultMode);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const colors = useMemo(() => {
    return isDark ? darkThemeColors : lightThemeColors;
  }, [isDark]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState(current => {
      const currentlyDark = current === 'system' ? systemColorScheme === 'dark' : current === 'dark';
      return currentlyDark ? 'light' : 'dark';
    });
  }, [systemColorScheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    themeMode,
    isDark,
    colors,
    typography,
    spacing,
    borderRadius,
    elevation,
    layout,
    iconSize,
    belts: BELT_RANKS,
    getBeltConfig,
    isLightBelt,
    setThemeMode,
    toggleTheme,
  }), [themeMode, isDark, colors, setThemeMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
