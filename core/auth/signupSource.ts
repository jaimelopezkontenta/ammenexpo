/**
 * RDY-09 corrección — de qué `source` bruto guardado (`rememberSource`, en
 * `core/auth/pendingToken.ts`) sale el valor que la allowlist de
 * `core/observability/track.ts` admite para `signup`.
 *
 * Separado en su propio archivo, puro, para poder probarlo con Vitest sin
 * arrastrar `@react-native-async-storage` ni Supabase — lo mismo que
 * `core/notifications/resolveTarget.ts` hace por la misma razón.
 */

const SHARE_LINK_SOURCES = new Set(["plan", "imagen", "circulo"]);

export type SignupSource = "organic" | "share_link" | "invite" | "unknown";

export const resolveSignupSource = (rawSource: string | null): SignupSource => {
  // Nada guardado: nadie abrió un enlace antes de registrarse.
  if (!rawSource) return "organic";
  if (rawSource === "invitacion") return "invite";
  if (SHARE_LINK_SOURCES.has(rawSource)) return "share_link";

  // Cualquier otra cosa —una etiqueta futura que este archivo no conoce
  // todavía— nunca se inventa como "organic": es honestamente desconocida.
  return "unknown";
};
