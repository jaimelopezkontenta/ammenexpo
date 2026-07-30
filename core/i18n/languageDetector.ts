import AsyncStorage from "@react-native-async-storage/async-storage";
import { LanguageDetectorAsyncModule, Resource } from "i18next";

export const LANGUAGE_STORAGE_KEY = "ammen.language";

type CreateLanguageDetector = {
  resources: Resource;
  fallbackLng: string;
};

/**
 * Ammen is a Spanish-first product: we do NOT follow the device locale, or an
 * English phone would silently get the secondary translation. The app opens in
 * Spanish and only changes if the user picks another language, which we then
 * remember across launches (localStorage on web, AsyncStorage on native).
 */
export const createLanguageDetector = ({
  resources,
  fallbackLng,
}: CreateLanguageDetector): LanguageDetectorAsyncModule => ({
  type: "languageDetector",
  async: true,
  detect: async (callback) => {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

      if (stored && Object.keys(resources).includes(stored)) {
        callback(stored);
        return;
      }
    } catch {
      // Storage is unavailable (private browsing, wiped keychain). Not worth
      // failing over — fall through to the default language.
    }

    callback(fallbackLng);
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Persisting the preference is best-effort; the session still switches.
    }
  },
});
