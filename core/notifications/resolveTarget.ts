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
 * Los destinos posibles de un tap, y por qué son solo dos (Oleada 6,
 * 2026-09-29).
 *
 * Hoy existen exactamente dos clases de aviso: la intercesión remota (el
 * único `type` que emite `buildPushMessage` en
 * `supabase/functions/send-intercession-push/payload.ts`, y la única fila
 * posible de `push_outbox`) y el recordatorio diario local
 * (`ammen-reminder-*`). No hay más tipos que resolver, y no se inventan
 * aquí: un destino nuevo necesita, por este orden, (1) que el servidor emita
 * ese `type` con un id opaco, (2) una RPC que autorice ese id para
 * `auth.uid()` y devuelva el destino, y (3) su rama en `destinationForTap`,
 * que siga navegando solo con lo que devuelva esa RPC. Un `type` desconocido
 * no navega (`outboxIdFromPayload` devuelve `null`).
 */
export type NotificationNavigationTarget = "/" | "/avisos";

/**
 * Vive aquí y no en `localReminders` para que el coordinador del tap —que
 * no puede importar de ahí: ese archivo arrastra `expo-notifications`—
 * sepa reconocer un recordatorio diario sin un ciclo de imports.
 */
export const LOCAL_REMINDER_IDENTIFIER_PREFIX = "ammen-reminder-";

export const isLocalReminderIdentifier = (identifier: string): boolean =>
  identifier.startsWith(LOCAL_REMINDER_IDENTIFIER_PREFIX);

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

/**
 * Destino del tap: un recordatorio local abre Hoy (no hay nada que
 * autorizar en el servidor); una intercesión autorizada abre Avisos.
 * El identifier local manda aunque el payload mintiera una intercesión —
 * si no, un recordatorio diario podría acabar en `/avisos`.
 */
export const destinationForTap = (
  identifier: string | null,
  resolved: ResolvedNotification,
): NotificationNavigationTarget | null => {
  if (identifier !== null && isLocalReminderIdentifier(identifier)) {
    return "/";
  }
  return navigationTargetFor(resolved);
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
