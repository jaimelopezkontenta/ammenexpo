import type { RedeemDestination } from "@/core/plans/redeemOutcome";

/**
 * Las decisiones de `SessionProvider`, puras para poder probarlas sin montar
 * la app.
 */

/**
 * Qué se limpia cuando cambia quién tiene la sesión.
 *
 * La caché de React Query solo se vacía si había alguien antes y ahora es
 * otro (o nadie): en el arranque no hay nada que filtrar y vaciarla cancelaría
 * las primeras lecturas.
 *
 * Los días guardados para leer sin red (`ammen.todayDay.*`, el texto de
 * oración del día; en web, en localStorage) se borran además **siempre que no
 * hay sesión**, también en el arranque: si la sesión se perdió con la app
 * cerrada —un token caducado, un cierre desde otro dispositivo—, al abrir no
 * había transición que los limpiara y se quedaban para quien usara después
 * ese navegador.
 */
export const cleanupOnSessionChange = (
  previousUserId: string | null,
  nextUserId: string | null,
) => {
  const userChanged = previousUserId !== null && previousUserId !== nextUserId;

  return {
    clearQueryCache: userChanged,
    clearCachedDays: userChanged || nextUserId === null,
  };
};

/**
 * Qué hacer con el destino de un enlace canjeado al entrar.
 *
 * Navegar en cuanto el canje volvía no miraba las puertas de `AuthGate`: en un
 * alta nueva, el `router.replace` al círculo salía mientras la persona todavía
 * tenía que aceptar los términos y contestar el onboarding, la puerta la
 * sacaba de ahí y el destino se perdía — acababa en Hoy.
 *
 * - `wait`: todavía no se sabe si las puertas están abiertas, o el navegador
 *   raíz no está montado.
 * - `handoff`: quedan puertas por cruzar. El destino pasa a `returnTo`, que es
 *   justo adonde `AuthGate` lleva al cruzar la última.
 * - `navigate`: puertas abiertas y navegador listo; se va ya.
 */
export type RedeemStep = "wait" | "handoff" | "navigate";

export const redeemStep = (input: {
  hasOnboarded: boolean | null;
  termsAccepted: boolean | null;
  navigationReady: boolean;
}): RedeemStep => {
  if (input.hasOnboarded === null || input.termsAccepted === null) {
    return "wait";
  }
  if (!input.hasOnboarded || !input.termsAccepted) return "handoff";
  return input.navigationReady ? "navigate" : "wait";
};

/** La ruta del destino, para dejarla en `returnTo`. */
export const destinationPath = (destination: RedeemDestination): string =>
  destination.kind === "plan"
    ? `/orar/${encodeURIComponent(destination.planId)}`
    : `/circulo/${encodeURIComponent(destination.circleId)}`;
