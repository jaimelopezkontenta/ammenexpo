/**
 * El idioma de un plan: en qué escribe el modelo y con qué Biblia se
 * verifican sus citas.
 *
 * Lo manda el cliente al crear el plan (el idioma de la interfaz) y se guarda
 * con él, en `source_prompt.locale`. A partir de ahí manda el plan: cada tramo
 * lo lee de la fila, igual que las respuestas del onboarding, así que un plan
 * no cambia de idioma a mitad aunque la persona cambie el de la app entre un
 * tramo y otro.
 *
 * Módulo puro (sin Deno ni `npm:`): lo importan `input.ts`, `prompt.ts`,
 * `scripture.ts` y el proveedor de pruebas.
 */

export const PLAN_LOCALES = ["es", "en"] as const;

export type PlanLocale = (typeof PLAN_LOCALES)[number];

/** El de todos los planes de antes de que hubiera otro, y el de la app. */
export const DEFAULT_PLAN_LOCALE: PlanLocale = "es";

/**
 * La Biblia de cada idioma: la misma que el lector abre por defecto con esa
 * interfaz (`bibleVersionForLanguage` en `core/bible/versions.ts`; una función
 * de Deno no puede importarla y `locale.test.ts` comprueba que coinciden). Es
 * la `p_version` de `resolve_scripture`: de ella salen el texto del versículo
 * que se guarda y el nombre del libro de la referencia («John 14:27»).
 */
export const BIBLE_VERSION_FOR_LOCALE: Record<PlanLocale, "rvr1909" | "web"> = {
  es: "rvr1909",
  en: "web",
};

export const isPlanLocale = (value: unknown): value is PlanLocale =>
  typeof value === "string" &&
  (PLAN_LOCALES as readonly string[]).includes(value);

/**
 * El idioma con el que se escribe un plan que ya existe, leído de su
 * `source_prompt` (un jsonb que nadie validó al guardarlo).
 *
 * Sin idioma guardado, el plan es de antes de que lo hubiera, cuando todos se
 * escribían en español: sus días nuevos siguen en español. Usar el de la
 * petición mezclaría idiomas en un mismo plan si alguien con la app en inglés
 * pulsa «Continuar» en uno antiguo.
 */
export const planLocaleFrom = (sourcePrompt: unknown): PlanLocale => {
  const stored =
    typeof sourcePrompt === "object" && sourcePrompt !== null
      ? (sourcePrompt as Record<string, unknown>).locale
      : undefined;

  return isPlanLocale(stored) ? stored : DEFAULT_PLAN_LOCALE;
};
