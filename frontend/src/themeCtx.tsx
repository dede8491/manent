import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as lightColors } from '@/src/theme';

export type Palette = { [K in keyof typeof lightColors]: string };
export type Scheme = 'light' | 'dark';

// Mode sombre Manent : fond Espresso, texte Crème, cartes espresso éclairci, accent Chambray inchangé.
export const darkColors: Palette = {
  espresso: '#F5EDE4',
  glacier: '#2D1913',
  bisque: '#5A3A2B',
  chambray: '#79A3C3',
  clay: '#C6AB93',
  creme: '#462B20',
  borderSoft: '#5E4437',
  darkCard: '#4A2E23',
  darkBg: '#2D1913',
};

const KEY = 'manent_scheme';

const Ctx = createContext<{ scheme: Scheme; colors: Palette; toggle: () => void }>({
  scheme: 'light',
  colors: lightColors,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>('light');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (v === 'dark') setScheme('dark'); }).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setScheme(s => {
      const next = s === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors, toggle }), [scheme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useScheme = () => useContext(Ctx).scheme;
export const useColors = () => useContext(Ctx).colors;
export const useToggleScheme = () => useContext(Ctx).toggle;

export function useStyles<T>(factory: (c: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
