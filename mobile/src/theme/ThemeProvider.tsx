import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeColors, lightThemeColors, darkThemeColors } from './colors';
import { typography, TypographyScale } from './typography';
import { spacing, borderRadius, elevation, layout, iconSize, ElevationTokens } from './spacing';
import {
  DEFAULT_BELT_TEMPLATE,
  BeltLevelConfig,
  resolveBeltDisplay,
  isLightBelt,
  getBeltTextColor,
  getBeltBorderColor,
  getBeltConfig,
} from './belts';

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
  belts: readonly BeltLevelConfig[];
  resolveBeltDisplay: (nameOrId: string) => ReturnType<typeof resolveBeltDisplay>;
  getBeltTextColor: (hex: string) => string;
  getBeltBorderColor: (hex: string) => string;
  isLightBelt: (hex: string) => boolean;
  getBeltConfig: (name: string) => BeltLevelConfig;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  persatuanBelts?: readonly BeltLevelConfig[];
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultMode = 'dark', // BeltFlow defaults to its signature dark navy theme
  persatuanBelts,
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

  const activeBelts = useMemo(() => {
    return persatuanBelts && persatuanBelts.length > 0 ? persatuanBelts : DEFAULT_BELT_TEMPLATE;
  }, [persatuanBelts]);

  const resolveBelt = useCallback((nameOrId: string) => {
    return resolveBeltDisplay(nameOrId, activeBelts);
  }, [activeBelts]);

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
    belts: activeBelts,
    resolveBeltDisplay: resolveBelt,
    getBeltTextColor,
    getBeltBorderColor,
    isLightBelt,
    getBeltConfig,
    setThemeMode,
    toggleTheme,
  }), [themeMode, isDark, colors, activeBelts, resolveBelt, setThemeMode, toggleTheme]);

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
