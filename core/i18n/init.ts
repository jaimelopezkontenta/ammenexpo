import i18n, { Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import { fallbackChecker } from "./fallbackChecker";
import { createLanguageDetector } from "./languageDetector";
import { pluralChecker } from "./pluralChecker";

type Init18n = {
  resources: Resource;
  fallbackLng: string;
};

export const init18n = ({ resources, fallbackLng }: Init18n) => {
  if (__DEV__) {
    pluralChecker(resources);
  }

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
