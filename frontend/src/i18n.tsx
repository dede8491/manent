import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EN } from './translations';

export type Lang = 'fr' | 'en';
const KEY = 'manent_lang';

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx>({ lang: 'fr', setLang: () => {}, t: s => s });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (v === 'en') setLangState('en'); }).catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const t = useCallback((s: string, vars?: Record<string, string | number>) => {
    let out = lang === 'en' ? (EN[s] ?? s) : s;
    if (vars) {
      for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
    }
    return out;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;
export const useLang = () => useContext(Ctx).lang;
