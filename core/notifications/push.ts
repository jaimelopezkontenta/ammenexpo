import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

import { supabase } from "@/utils/supabase";
import { track } from "@/core/observability/track";

import { canRegisterRemotePush } from "./pushConfig";
import { type ResolvedNotification } from "./resolveTarget";
import {
  createPushResponseCoordinator,
  type NotificationResponseLike,
} from "./responseCoordinator";

/**
 * RDY-10/RDY-11 — un token por instalación, no por perfil.
 *
 * **Sin proveedor de push probado en dispositivo real.** Esto registra el
 * token de esta instalación contra `register_push_device()` (ver
 * `20260823100000_push_devices_outbox.sql`) y lo revoca al cerrar sesión —
 * eso es lo que se puede construir y comprobar por tipos/lint en este
 * entorno. Lo que el plan exige y aquí no se puede dar: entrega real en un
 * iPhone/Android físico, con receipts de vuelta. Ver
 * `docs/runbooks/push-b4.md` — esa mitad queda PENDING.
 *
 * **Web queda fuera a propósito.** Expo push en web necesita VAPID/service
 * worker aparte, que no es la primera clase de push que el plan pide
 * (intercesión, móvil). `Platform.OS === "web"` corta antes de tocar
 * ninguna API nativa que no exista ahí.
 */

const projectId =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId ?? undefined;

const platformFor = (): "ios" | "android" | "web" => {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
};

/**
 * Pide permiso **en contexto**, nunca al abrir la app por primera vez: eso lo
 * decide quien llama a este hook, pasando `enabled`. Denegado no lanza y no
 * insiste — usar la app sin push sigue siendo el camino normal.
 */
export const usePushRegistration = (
  userId: string | undefined,
  enabled: boolean,
) => {
  useEffect(() => {
    if (!enabled || !userId || Platform.OS === "web") return;
    // Sin projectId de EAS, getExpoPushTokenAsync lanza y el nativo de
    // FCM escribe un error a pantalla completa. No hay token que pedir:
    // el registro remoto es un no-op, no un fallo.
    if (!canRegisterRemotePush(projectId)) return;

    let active = true;

    const register = async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;

        if (status !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }

        // Denegado es una respuesta válida, no un error: no hay nada más que
        // hacer, y no se vuelve a pedir en este mismo montaje.
        if (status !== "granted" || !active) return;

        // `getExpoPushTokenAsync` aún puede lanzar si el módulo nativo no
        // está (simulador, build incompleto). El caso sin projectId ya
        // se cortó arriba: aquí siempre hay uno.
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        if (!active) return;

        const { error } = await supabase.rpc("register_push_device", {
          p_token: token,
          p_platform: platformFor(),
        });

        if (error) {
          console.error("register_push_device failed", error);
          return;
        }

        // Solo el id de la plataforma, nunca el token en sí — un
        // `ExponentPushToken[...]` identifica el dispositivo, no es un dato
        // que un evento de analítica deba llevar.
        track("push_registered", { platform: platformFor() });
      } catch (caught) {
        // Nunca deja una promesa rechazada sin dueño: pedir permiso o
        // token puede fallar en un simulador o un dispositivo sin Play
        // Services. Nada de eso puede tirar abajo el montaje de la app.
        console.error("push registration failed", caught);
      }
    };

    void register();

    return () => {
      active = false;
    };
  }, [enabled, userId]);
};

/**
 * El logout de este dispositivo: revoca solo su propio token, nunca todos
 * los de la cuenta — cerrar sesión en un teléfono no debería apagar el push
 * del otro.
 */
export const revokeThisDevicePush = async () => {
  if (Platform.OS === "web") return;
  if (!canRegisterRemotePush(projectId)) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const { error } = await supabase.rpc("revoke_push_device", {
      p_token: token,
    });

    if (error) {
      console.error("revoke_push_device failed", error);
    }
  } catch (caught) {
    // Sin permiso o sin token no hay nada que revocar del lado del servidor;
    // el logout en sí no puede depender de que esto tenga éxito.
    console.error("revoke_push_device could not read a token", caught);
  }
};

// ---------------------------------------------------------------------------
// El tap de una notificación: nunca confiar en el payload por sí solo
// ---------------------------------------------------------------------------
//
// La máquina de estado vive en `./responseCoordinator` — pura, sin
// `expo-notifications` ni React Native, para probar carreras de auth, retry y
// dedupe sin arrastrar el runtime nativo. Aquí solo se adaptan SDK, RPC y router.

/**
 * El listener real, más el arranque en frío. Se registra una vez, al montar
 * la app.
 *
 * **Por qué hace falta más que el listener.** Si la app estaba cerrada y se
 * abrió *por* el tap, `addNotificationResponseReceivedListener()` se
 * registra después de que ese tap ya ocurrió — nunca lo ve. La única forma
 * de recuperarlo es `getLastNotificationResponseAsync()`, comprobado en el
 * mismo montaje. Y como en algunas plataformas el listener **también**
 * dispara una vez para esa misma respuesta que acaba de lanzar la app,
 * ambos caminos pasan por el mismo coordinador, que usa `outboxId` como alias
 * estable además del identifier — el mismo tap nunca navega ni llama a
 * `resolve_push_notification()` dos veces, aunque Expo omita ese identifier.
 *
 * Nunca decide "abrir el plan X" a partir de lo que trae la notificación:
 * un recordatorio local (`ammen-reminder-*`) abre Hoy sin RPC; un push de
 * intercesión pide primero `resolve_push_notification()`, que es quien de
 * verdad sabe si esto sigue autorizado (dueño correcto, sin bloqueo de por
 * medio), y solo entonces navega a `/avisos` — nunca a una ruta con un id
 * de plan tomado del payload.
 */
const createNativeResponseCoordinator = () =>
  createPushResponseCoordinator({
    resolve: async (outboxId) => {
      try {
        const { data, error } = await supabase.rpc(
          "resolve_push_notification",
          { p_outbox_id: outboxId },
        );

        if (error) {
          return { status: "retryable_error", error } as const;
        }

        return {
          status: "resolved",
          notification: (data as ResolvedNotification[] | null)?.[0] ?? null,
        } as const;
      } catch (error) {
        return { status: "retryable_error", error } as const;
      }
    },
    navigate: (target) => {
      // El target procede únicamente de la respuesta autorizada de la RPC;
      // nunca se lee una ruta ni un id navegable del payload de Expo.
      router.push(target);
      track("open", { context: "notification" });
    },
    clearLastResponse: () => Notifications.clearLastNotificationResponseAsync(),
    reportError: (caught) => {
      console.error("notification response handling failed", caught);
    },
  });

export const useNotificationResponseHandler = ({
  isSessionLoading,
  userId,
}: {
  isSessionLoading: boolean;
  userId: string | null;
}) => {
  const coordinatorRef = useRef<
    ReturnType<typeof createPushResponseCoordinator> | undefined
  >(undefined);
  const ensureCoordinator = useCallback(() => {
    coordinatorRef.current ??= createNativeResponseCoordinator();
    return coordinatorRef.current;
  }, []);

  useEffect(() => {
    void ensureCoordinator().updateSession({
      resolved: !isSessionLoading,
      userId,
    });
  }, [ensureCoordinator, isSessionLoading, userId]);

  useEffect(() => {
    const coordinator = ensureCoordinator();
    const disposeCoordinator = () => {
      coordinator.dispose();
      if (coordinatorRef.current === coordinator) {
        coordinatorRef.current = undefined;
      }
    };

    if (Platform.OS === "web") return disposeCoordinator;

    // Se captura aunque Auth siga restaurando la sesión. La máquina no llama
    // a la RPC hasta recibir `resolved: true` y un `userId` desde
    // SessionProvider; un estado anónimo inicial puede convertirse en login.
    Notifications.getLastNotificationResponseAsync()
      .then((response) =>
        coordinator.capture(
          response as NotificationResponseLike | null,
          "cold-start",
        ),
      )
      .catch((caught) => {
        console.error("getLastNotificationResponseAsync failed", caught);
      });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void coordinator.capture(
          response as NotificationResponseLike,
          "listener",
        );
      },
    );

    return () => {
      subscription.remove();
      disposeCoordinator();
    };
  }, [ensureCoordinator]);
};
