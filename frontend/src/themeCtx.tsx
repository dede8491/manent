import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as lightColors } from '@/src/theme';

export type Palette = { [K in keyof typeof lightColors]: string };
export type Scheme = 'light' | 'dark';
export type SchemePref = 'system' | 'light' | 'dark';

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
  danger: '#E08A66',
  success: '#8FBF9C',
  overlay: 'rgba(0,0,0,0.55)',
};

const KEY = 'manent_scheme';

const Ctx = createContext<{ scheme: Scheme; pref: SchemePref; colors: Palette; toggle: () => void; setPref: (p: SchemePref) => void }>({
  scheme: 'light', pref: 'system', colors: lightColors, toggle: () => {}, setPref: () => {},
});

// Préférence : « système » par défaut (suit le réglage du téléphone et réagit à ses changements), ou clair / sombre forcé.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<SchemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (v === 'dark' || v === 'light' || v === 'system') setPrefState(v); }).catch(() => {});
  }, []);

  const setPref = useCallback((p: SchemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  }, []);
  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const toggle = useCallback(() => setPref(scheme === 'dark' ? 'light' : 'dark'), [scheme, setPref]);

  const value = useMemo(() => ({ scheme, pref, colors: scheme === 'dark' ? darkColors : lightColors, toggle, setPref }), [scheme, pref, toggle, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useScheme = () => useContext(Ctx).scheme;
export const useColors = () => useContext(Ctx).colors;
export const useToggleScheme = () => useContext(Ctx).toggle;
export const useSchemePref = () => { const c = useContext(Ctx); return { pref: c.pref, setPref: c.setPref }; };

export function useStyles<T>(factory: (c: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
