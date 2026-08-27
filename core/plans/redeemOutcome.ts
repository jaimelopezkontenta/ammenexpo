/**
 * RDY-09 corrección (segundo ciclo, punto 6) — el `reason` que
 * `redeem_share_token()` devuelve es texto libre del servidor, no un enum
 * que este cliente controle. Si el servidor empieza a devolver un motivo
 * nuevo que la allowlist de `core/observability/track.ts` no conoce todavía,
 * `sanitizePayload()` lo descarta en silencio — el evento se sigue
 * contando, pero el campo `outcome` desaparece del todo, sin dejar ningún
 * rastro de que había algo que no encajaba.
 *
 * Esta función es el paso de antes: mapea a un enum fijo y conocido —
 * nunca pasa el texto del servidor tal cual, que sería exactamente el vector
 * por el que la allowlist existe— y usa `"unknown"` como cajón explícito
 * para "el servidor dijo algo que este cliente todavía no tiene bucket para
 * clasificar", en vez de perder la señal por completo.
 */

const KNOWN_OUTCOMES = new Set(["ok", "invalid_or_expired", "plan_missing"]);

export type RedeemOutcome =
  "ok" | "invalid_or_expired" | "plan_missing" | "error" | "unknown";

/**
 * The RPC returns `{ok:true, plan_id, self:true}` when the owner opens their
 * own link. That is success, but it is not a plan to pray *for* — sending them
 * to `/orar/[planId]` produces "Ya no tienes acceso a este plan."
 */
export type RedeemShareResult = {
  ok?: boolean;
  plan_id?: string;
  self?: boolean;
  reason?: string;
};

export const planIdToOpenAfterRedeem = (
  outcome: RedeemShareResult | null | undefined,
): string | null => {
  if (!outcome?.ok || outcome.self || !outcome.plan_id) return null;
  return outcome.plan_id;
};

export const resolveRedeemOutcome = (input: {
  hadError: boolean;
  reason: string | null | undefined;
}): RedeemOutcome => {
  // Un fallo de red/transporte es siempre `error`, independientemente de lo
  // que la RPC hubiera contestado — que en ese caso ni se llegó a leer.
  if (input.hadError) return "error";

  if (!input.reason) return "unknown";
  if (KNOWN_OUTCOMES.has(input.reason)) {
    return input.reason as RedeemOutcome;
  }

  // Un motivo real, pero que este cliente no reconoce todavía — nunca se
  // reenvía tal cual (regla de la allowlist), y nunca se confunde con
  // "error": el servidor sí contestó algo con sentido, solo que este
  // cliente no lo tiene catalogado.
  return "unknown";
};
