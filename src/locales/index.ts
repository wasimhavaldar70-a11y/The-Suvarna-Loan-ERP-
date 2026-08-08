// ========================================================
// SuvarnaLoan ERP - Locales Index & Export
// Location: src/locales/index.ts
// ========================================================

import { en } from './en';
import { mr } from './mr';

export type Language = 'en' | 'mr';

export const dictionaries = {
  en,
  mr,
};

export type LocaleDictionary = typeof en;

export function getDictionary(lang: Language): LocaleDictionary {
  return dictionaries[lang] || dictionaries.en;
}
