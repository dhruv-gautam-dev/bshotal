import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { COMMON } from '@/data/ui-common';

const DICT = { en: { ...COMMON.en }, hi: { ...COMMON.hi } };

// Register extra translation bundles (used by page-level dictionaries)
export function extendDict(bundle) {
  Object.keys(bundle).forEach((l) => Object.assign(DICT[l], bundle[l]));
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bsh_lang') || 'en');
  useEffect(() => {
    localStorage.setItem('bsh_lang', lang);
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);
  const t = useCallback((key, fallback) => DICT[lang][key] ?? DICT.en[key] ?? fallback ?? key, [lang]);
  // pick a {en, hi} object value
  const tr = useCallback((obj) => (obj && typeof obj === 'object' ? obj[lang] ?? obj.en : obj), [lang]);
  const L = useCallback((en, hi) => (lang === 'hi' && hi ? hi : en), [lang]);
  return <I18nContext.Provider value={{ lang, setLang, t, tr, L }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);