import type { SupabaseClient } from "npm:@supabase/supabase-js@^2.58.0";

import { BIBLE_VERSION_FOR_LOCALE, type PlanLocale } from "./locale.ts";
import type { GeneratedDay } from "./schema.ts";

export type ResolvedDay = GeneratedDay & {
  canonical_ref: string | null;
  scripture_text: string | null;
};

/**
 * La búsqueda no pudo responder (la base, la red, un permiso), que NO es lo
 * mismo que «esa referencia no existe». Confundirlas mandaba al modelo una
 * pasada de reparación por versículos perfectamente reales, o los dejaba
 * salir sin texto para siempre por un fallo de un segundo. Lleva solo cuántas
 * búsquedas fallaron y el código del primer error: ni la referencia ni el
 * mensaje.
 */
export class ScriptureLookupError extends Error {
  constructor(
    public failed: number,
    public code: string | null,
  ) {
    super(`Scripture lookup failed for ${failed} reference(s)`);
    this.name = "ScriptureLookupError";
  }
}

/**
 * Turns the model's chosen reference into real text from the Bible table.
 * A reference that does not resolve comes back with nulls — never with
 * model-written text standing in for scripture.
 *
 * La versión es la del idioma del plan (`BIBLE_VERSION_FOR_LOCALE`): RVR 1909
 * para un plan en español, WEB para uno en inglés. De ella salen el texto que
 * se guarda y la referencia canónica («Juan 14:27» / «John 14:27»). Se pide
 * siempre explícita, también la española: sin `p_version` la base responde en
 * RVR, y un plan en inglés con versículos en español es justo lo que esto
 * arregla.
 *
 * Una búsqueda que falla se repite una vez (es una lectura, no cambia nada); si
 * vuelve a fallar se lanza `ScriptureLookupError` en vez de fingir que la
 * referencia no existe.
 */
export const resolveDays = async (
  client: SupabaseClient,
  days: GeneratedDay[],
  locale: PlanLocale,
): Promise<ResolvedDay[]> => {
  const failures: (string | null)[] = [];
  const version = BIBLE_VERSION_FOR_LOCALE[locale];

  const resolved = await Promise.all(
    days.map(async (day) => {
      const lookup = () =>
        client.rpc("resolve_scripture", {
          p_ref: day.scripture_ref,
          p_version: version,
        });

      let { data, error } = await lookup();

      if (error) {
        ({ data, error } = await lookup());
      }

      if (error) {
        failures.push(typeof error.code === "string" ? error.code : null);
      }

      const row = Array.isArray(data) ? data[0] : null;

      return {
        ...day,
        canonical_ref: row?.canonical_ref ?? null,
        scripture_text: row?.text ?? null,
      };
    }),
  );

  if (failures.length > 0) {
    throw new ScriptureLookupError(failures.length, failures[0]);
  }

  return resolved;
};

export const unresolved = (days: ResolvedDay[]) =>
  days.filter((day) => day.scripture_text === null);
