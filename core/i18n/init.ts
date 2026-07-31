import i18n, { Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { fallbackChecker } from "./fallbackChecker";
import { createLanguageDetector } from "./languageDetector";
import { pluralChecker } from "./pluralChecker";

type Init18n = {
  resources: Resource;
  fallbackLng: string;
};

/**
 * Keeps the document's declared language in step with the chosen one.
 *
 * `+html.tsx` can only stamp the default at build time, so without this a
 * visitor who switches to English keeps being served a page that says it is in
 * Spanish — and assistive technology believes the attribute, not the words.
 * No-op outside the browser.
 */
const syncDocumentLanguage = (language: string) => {
  const doc = (
    globalThis as { document?: { documentElement?: { lang: string } } }
  ).document;

  if (doc?.documentElement) {
    doc.documentElement.lang = language;
  }
};

export const init18n = ({ resources, fallbackLng }: Init18n) => {
  if (__DEV__) {
    pluralChecker(resources);
  }

  i18n.on("languageChanged", syncDocumentLanguage);

  // i18next also exports a standalone `use`, so the linter suspects this is the
  // wrong one. It is not: chaining off the default instance is how i18next is
  // meant to be initialised.
  // eslint-disable-next-line import/no-named-as-default-member
  return i18n
    .use(createLanguageDetector({ resources, fallbackLng }))
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: fallbackChecker(resources, fallbackLng),
      compatibilityJSON: "v3", // By default React Native projects does not support Intl
      interpolation: {
        escapeValue: false,
      },
    });
};
