'use client';

// ========================================================
// SuvarnaLoan ERP - Global Bilingual Language Provider
// Location: src/providers/LanguageProvider.tsx
// ========================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Language, LocaleDictionary, getDictionary, dictionaries } from '../locales';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  dict: LocaleDictionary;
  t: (path: string, params?: Record<string, string | number>) => string;
  isMarathi: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  dict: dictionaries.en,
  t: (path: string) => path,
  isMarathi: false,
});

export const STORAGE_KEY_LANG = 'sl_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Load language from localStorage on initial render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_LANG);
      if (stored === 'mr' || stored === 'en') {
        setLanguageState(stored);
        if (stored === 'mr') {
          document.documentElement.lang = 'mr';
        } else {
          document.documentElement.lang = 'en';
        }
      }
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
      document.documentElement.lang = lang;

      // Broadcast to other open tabs on this machine
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel('suvarnaloan-lang-sync');
          channel.postMessage({ type: 'LANG_CHANGE', lang });
          channel.close();
        } catch (e) {
          // ignore
        }
      }
    }
  }, []);

  // Listen to BroadcastChannel for multi-tab sync
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('suvarnaloan-lang-sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'LANG_CHANGE' && (event.data?.lang === 'mr' || event.data?.lang === 'en')) {
          setLanguageState(event.data.lang);
          document.documentElement.lang = event.data.lang;
        }
      };
      return () => {
        channel.close();
      };
    }
  }, []);

  const dict = useMemo(() => getDictionary(language), [language]);

  // Nested property lookup helper: t('dashboard.activeAum')
  const t = useCallback((path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    let current: any = dict;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to English dictionary
        let fallback: any = dictionaries.en;
        for (const fKey of keys) {
          if (fallback && typeof fallback === 'object' && fKey in fallback) {
            fallback = fallback[fKey];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    if (params) {
      let interpolated = current;
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        interpolated = interpolated.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramVal));
      });
      return interpolated;
    }

    return current;
  }, [dict]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    dict,
    t,
    isMarathi: language === 'mr',
  }), [language, setLanguage, dict, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}

export function useLanguage() {
  return useContext(LanguageContext);
}
