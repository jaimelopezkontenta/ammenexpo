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
