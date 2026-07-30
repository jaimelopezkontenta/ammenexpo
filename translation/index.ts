import { init18n } from "../core/i18n/init";
import en from "./en.json";
import es from "./es.json";

export const resources = {
  es: {
    translation: es,
  },
  en: {
    translation: en,
  },
};

/** Spanish is the product's primary language; English is secondary. */
export const fallbackLng = "es";

export type LanguageCode = keyof typeof resources;

export const supportedLanguages = Object.keys(resources) as LanguageCode[];

export const isSupportedLanguage = (code: string): code is LanguageCode =>
  (supportedLanguages as string[]).includes(code);

const i18n = init18n({ resources, fallbackLng });

export default i18n;
