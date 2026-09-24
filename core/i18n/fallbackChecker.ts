import { Resource } from "i18next";

export const fallbackChecker = (resources: Resource, fallbackLng: string) => {
  const languages = Object.keys(resources);
  const hasFallback = languages.find((key) => fallbackLng === key);

  if (!hasFallback) {
    throw new Error(
      `fallbackLng "${fallbackLng}" is not among the loaded resources. Available languages: ${languages.join(", ")}`,
    );
  }
  return fallbackLng;
};
