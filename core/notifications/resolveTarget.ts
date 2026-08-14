/**
 * RDY-11 corrección — lógica pura de "qué payload es válido" y "a dónde
 * navegar", separada de `push.ts` a propósito: ese archivo importa
 * `expo-notifications`/`expo-router`/`react-native`, que arrastran código
 * Flow que Vitest no puede parsear ni siquiera para probar una función pura
 * que no los usa. Aislar esto aquí es lo que hace posible probarlo sin un
 * runtime de React Native de por medio.
 */

export type NotificationPayload = {
  type?: unknown;
  outboxId?: unknown;
};

/**
 * Extrae el único dato que el payload lleva y que de verdad se necesita para
 * pedirle al servidor una autorización — nunca un planId: `buildPushMessage`
 * (en `supabase/functions/send-intercession-push/payload.ts`) no lo pone en
 * el payload, así que este cliente no tiene nada que confiar de más aunque
 * quisiera.
 */
export const outboxIdFromPayload = (
  payload: NotificationPayload | null | undefined,
): string | null => {
  if (!payload || payload.type !== "intercession") return null;
  if (typeof payload.outboxId !== "string" || payload.outboxId.length === 0) {
    return null;
  }

  return payload.outboxId;
};

export type ResolvedNotification = {
  authorized: boolean;
  intercessor_name: string | null;
} | null;

/**
 * La decisión de a dónde navegar, separada de la llamada a la red. `null`
 * significa "no navegar a ninguna parte" — ni una pantalla de error: un
 * aviso caducado, revocado por bloqueo o de otra persona no es un fallo que
 * haya que explicar, es simplemente nada que abrir.
 */
export const navigationTargetFor = (
  resolved: ResolvedNotification,
): "/avisos" | null => {
  if (!resolved || !resolved.authorized) return null;
  return "/avisos";
};

type MinimalNotificationResponse = {
  notification?: {
    request?: {
      identifier?: unknown;
    };
  };
} | null;

/** El identificador estable de una respuesta, o `null` si no hay ninguno. */
export const responseIdentifier = (
  response: MinimalNotificationResponse,
): string | null => {
  const identifier = response?.notification?.request?.identifier;
  return typeof identifier === "string" && identifier.length > 0
    ? identifier
    : null;
};
