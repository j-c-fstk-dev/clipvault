import { createContext, useContext } from 'react';
import type { Language } from '../types';
import { en, type Messages } from './en';
import { pt } from './pt';

export type { Messages };

export interface I18n {
  t: Messages;
  /** BCP 47 locale for dates, e.g. "pt-BR". */
  locale: string;
}

/**
 * The texts for a language setting. "auto" follows `system`, the desktop's
 * language as the backend sees it (WebKitGTK does not always pass the
 * locale on to `navigator.language`), or the browser's language without it.
 */
export const resolveI18n = (language: Language, system?: 'en' | 'pt'): I18n => {
  const browser = navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  const lang = language === 'auto' ? (system ?? browser) : language;
  return lang === 'pt' ? { t: pt, locale: 'pt-BR' } : { t: en, locale: 'en-US' };
};

export const I18nContext = createContext<I18n>({ t: en, locale: 'en-US' });

export const useI18n = () => useContext(I18nContext);
