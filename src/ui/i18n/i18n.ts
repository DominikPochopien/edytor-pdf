import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import pl from './locales/pl.json';

export const DEFAULT_LANGUAGE = 'pl';

export const resources = {
  pl: { translation: pl },
} as const;

export function initI18n(): typeof i18next {
  void i18next.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18next;
}
