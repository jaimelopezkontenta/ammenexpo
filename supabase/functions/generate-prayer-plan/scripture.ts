import type { SupabaseClient } from "npm:@supabase/supabase-js@^2.58.0";

import type { GeneratedDay } from "./schema.ts";

export type ResolvedDay = GeneratedDay & {
  canonical_ref: string | null;
  scripture_text: string | null;
};

/**
 * Turns the model's chosen reference into real text from the RVR1909 table.
 * A reference that does not resolve comes back with nulls — never with
 * model-written text standing in for scripture.
 */
export const resolveDays = async (
  client: SupabaseClient,
  days: GeneratedDay[],
): Promise<ResolvedDay[]> =>
  await Promise.all(
    days.map(async (day) => {
      const { data } = await client.rpc("resolve_scripture", {
        p_ref: day.scripture_ref,
      });

      const row = Array.isArray(data) ? data[0] : null;

      return {
        ...day,
        canonical_ref: row?.canonical_ref ?? null,
        scripture_text: row?.text ?? null,
      };
    }),
  );

export const unresolved = (days: ResolvedDay[]) =>
  days.filter((day) => day.scripture_text === null);
