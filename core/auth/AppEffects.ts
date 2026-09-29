import { useSession } from "./SessionProvider";
import { useLocalReminderSync } from "./effects/useLocalReminderSync";
import { useRedeemPendingLinks } from "./effects/useRedeemPendingLinks";
import { insideAppGatesOpen } from "./sessionFlow";
import { useLastSeenHeartbeat } from "@/core/email/heartbeat";
import {
  useNotificationResponseHandler,
  usePushRegistration,
} from "@/core/notifications/push";
import { useFlushPrayedQueue } from "@/core/plans/offline";

/**
 * Lo que la app hace por su cuenta alrededor de la sesión, sin pintar nada.
 *
 * Todo esto vivía dentro de `SessionProvider`, mezclado con la sesión misma;
 * ahora el provider solo lee la sesión y las puertas, y esto las escucha
 * (`useSession`). Se monta en `app/_layout.tsx` como **último hijo** de
 * `SessionProvider`, después del árbol de pantallas: así sus efectos corren
 * después de los de `AuthGate` y las pantallas, como cuando eran del provider
 * (React ejecuta los efectos de los hijos antes que los del padre, y los de
 * los hermanos en orden). Y los hooks van en el mismo orden que tenían allí.
 */
export const AppEffects = () => {
  const { session, isLoading, hasOnboarded, termsAccepted } = useSession();
  const userId = session?.user.id ?? null;

  // RDY-10: se pide permiso ya dentro de la app, no en el primer frame — de
  // ahí depender de `hasOnboarded`/`termsAccepted` y no solo de `userId`.
  const insideApp = insideAppGatesOpen({ userId, hasOnboarded, termsAccepted });

  // El enlace canjeado al entrar, y adónde lleva cuando se pueda.
  useRedeemPendingLinks({ userId, hasOnboarded, termsAccepted });

  // Push: permiso y registro de este dispositivo.
  usePushRegistration(userId ?? undefined, insideApp);

  // Recordatorios locales a las horas elegidas.
  useLocalReminderSync(userId ?? undefined, insideApp);

  // El listener del tap no pide permiso ni depende de onboarding: solo
  // escucha. Si nunca llega una notificación, no hace nada; si llega,
  // `resolve_push_notification()` decide, nunca el payload por sí solo.
  useNotificationResponseHandler({
    isSessionLoading: isLoading,
    userId,
  });

  // Un "Ya oré" marcado sin red se queda en cola. Se drena al entrar y
  // cada vez que la app vuelve a primer plano: si no, la marca local y
  // el servidor se desalinean hasta el próximo arranque en frío.
  useFlushPrayedQueue(userId);
  useLastSeenHeartbeat(userId ?? undefined);

  return null;
};
