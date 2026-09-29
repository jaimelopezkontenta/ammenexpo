import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useRootNavigationState } from "expo-router";
import i18n from "i18next";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "@/utils/supabase";

import { gateStateFrom, type OnboardingRead } from "./onboardingState";
import { redeemPendingTokens } from "./pendingToken";
import {
  cleanupOnSessionChange,
  destinationPath,
  redeemStep,
} from "./sessionFlow";
import {
  forgetReturnToOnSignOut,
  noteSessionUser,
  rememberReturnTo,
} from "@/core/nav/returnTo";
import type { RedeemDestination } from "@/core/plans/redeemOutcome";
import {
  revokeThisDevicePush,
  usePushRegistration,
  useNotificationResponseHandler,
} from "@/core/notifications/push";
import { syncLocalReminders } from "@/core/notifications/localReminders";
import { clearCachedDays, useFlushPrayedQueue } from "@/core/plans/offline";
import { useProfile } from "@/core/profile/queries";
import { useLastSeenHeartbeat } from "@/core/email/heartbeat";

import { qk } from "@/core/query/keys";
type SessionState = {
  session: Session | null;
  /** True until the stored session has been read. */
  isLoading: boolean;
  /** null while unknown — do not route on it. */
  hasOnboarded: boolean | null;
  /** Null mientras la lectura no ha vuelto: enrutar antes enseñaría la pantalla equivocada. */
  termsAccepted: boolean | null;
  /** The onboarding read failed and is no longer retrying. */
  onboardingFailed: boolean;
  refreshOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | undefined>(undefined);

export const SessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Who the cache currently belongs to. */
  const lastUserId = useRef<string | null>(null);
  // Adónde llevar tras canjear un enlace, a la espera de que se pueda navegar.
  const pendingDestination = useRef<RedeemDestination | null>(null);
  const [destinationTick, setDestinationTick] = useState(0);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const userId = data.session?.user.id ?? null;
      lastUserId.current = userId;
      noteSessionUser(userId);
      // Arrancar sin sesión también limpia el día guardado: si la sesión se
      // perdió con la app cerrada, no hubo transición que lo hiciera.
      if (cleanupOnSessionChange(null, userId).clearCachedDays) {
        void clearCachedDays();
      }
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        const nextUserId = nextSession?.user.id ?? null;

        // Clearing only inside signOut() left every other way a session ends —
        // an expired refresh token, a sign-out pushed from another device — with
        // the cache intact. Several keys are not user-scoped (a circle, its
        // members, a plan's share link), so the next account to sign in on this
        // device would have been served the previous one's data.
        //
        // Skipped when there was no previous user: at startup there is nothing
        // cached to leak, and clearing would cancel the first fetches.
        const cleanup = cleanupOnSessionChange(lastUserId.current, nextUserId);
        if (cleanup.clearQueryCache) queryClient.clear();
        // Lo mismo con el día guardado para leer sin red: lleva el texto de
        // oración y en web vive en localStorage.
        if (cleanup.clearCachedDays) void clearCachedDays();

        // Antes de que la puerta vuelva a pintar: lo que otra persona dejó
        // en `returnTo` no es destino de quien entra ahora.
        noteSessionUser(nextUserId);
        lastUserId.current = nextUserId;
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  // The single place every sign-in passes through, which is why the redemption
  // lives here and not in one of the four screens that can produce one. It is a
  // no-op once there is nothing stashed, so it costs one AsyncStorage read per
  // launch.
  useEffect(() => {
    if (!userId) {
      // Un destino de la sesión anterior no es de quien entre después.
      pendingDestination.current = null;
      return;
    }

    let active = true;

    void redeemPendingTokens().then((destination) => {
      if (!active || !destination) return;
      pendingDestination.current = destination;
      setDestinationTick((tick) => tick + 1);

      // Redeeming is what makes that plan visible. Without invalidating, the
      // Orar tab would keep insisting nobody had shared anything — this app
      // never refetches on focus, so it would say so until it was killed.
      void queryClient.invalidateQueries({ queryKey: qk.sharedWithMe.root });
      void queryClient.invalidateQueries({ queryKey: qk.circles.root });
    });

    return () => {
      active = false;
    };
  }, [userId, queryClient]);

  const rootNavigation = useRootNavigationState();
  const navigationReady = Boolean(rootNavigation?.key);

  // Keyed by user, so signing in as someone else can never inherit the
  // previous account's onboarding state.
  const {
    data,
    isLoadingError: readFailed,
    refetch,
  } = useQuery({
    queryKey: qk.onboarding(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<OnboardingRead> => {
      const { data: settings, error } = await supabase
        .from("profile_settings")
        .select("onboarding_answers, terms_version")
        .eq("id", userId!)
        .maybeSingle();

      // Swallowing this used to turn any network blip into "false", which the
      // gate below reads as "never onboarded" — dropping someone with a year of
      // history back into step 1 of 4, with no way to skip it. A failed read
      // must stay a failure so the query retries instead of deciding.
      if (error) throw error;

      // No row at all is a different thing from an unanswered questionnaire,
      // and collapsing the two is what built the trap. `handle_new_user()`
      // writes this row in the same trigger as the profile, so every real
      // account has one; a missing one means the session points at a user who
      // no longer exists — a token the client still believes in.
      //
      // **Se devuelve como dato y no como excepción.** Lanzarlo ataba la
      // salida a que el estado de error de la consulta llegara a la puerta, y
      // cuando no llegaba —reintentos, la caché limpiándose por medio— la app
      // se quedaba en la pantalla de arranque para siempre, sin la salida de
      // cerrar sesión que todo lo demás sí ofrece. Además reintentar no
      // arregla nada: una cuenta borrada no vuelve al cuarto intento.
      if (!settings) {
        return { missing: true };
      }

      return {
        missing: false,
        onboarded: Boolean(settings.onboarding_answers),
        termsVersion: (settings.terms_version as string | null) ?? null,
      };
    },
    // Un fallo de red sí se reintenta, pero una vez: si la base no contesta,
    // cada intento son unos segundos más de pantalla de arranque.
    retry: 1,
  });

  const { hasOnboarded, termsAccepted, failed } = gateStateFrom({
    userId,
    read: data,
    readFailed,
  });

  // Un share canjeado al entrar abre el día que toca orar, y una invitación a
  // un círculo abre ese círculo — no Hoy, que dejaba a quien llegaba a una
  // pestaña de distancia y sin pista de qué había pasado. El invite code de
  // la app no lleva a ningún sitio concreto y no navega.
  //
  // Se navega solo con el navegador raíz ya montado: el canje puede resolver
  // en el arranque en frío, antes, y un `router.replace` en ese momento caía
  // en `/` arrastrando los parámetros de la ruta anterior (`/?token=…`).
  //
  // Y solo con las puertas de `AuthGate` cruzadas: en un alta nueva el canje
  // vuelve mientras faltan los términos y el onboarding, y navegar entonces
  // era perder el destino. Mientras falten, se le deja a `returnTo`, que es
  // adonde la puerta lleva al cruzar la última (core/auth/sessionFlow.ts).
  useEffect(() => {
    const destination = pendingDestination.current;
    if (!destination) return;

    const step = redeemStep({ hasOnboarded, termsAccepted, navigationReady });
    if (step === "wait") return;
    pendingDestination.current = null;

    if (step === "handoff") {
      rememberReturnTo(destinationPath(destination));
      return;
    }

    if (destination.kind === "plan") {
      router.replace({
        pathname: "/orar/[planId]",
        params: { planId: destination.planId },
      });
    } else {
      router.replace({
        pathname: "/circulo/[id]",
        params: { id: destination.circleId },
      });
    }
  }, [destinationTick, navigationReady, hasOnboarded, termsAccepted]);

  // RDY-10: se pide permiso ya dentro de la app, no en el primer frame — de
  // ahí depender de `hasOnboarded`/`termsAccepted` y no solo de `userId`.
  usePushRegistration(
    userId ?? undefined,
    Boolean(userId) && hasOnboarded === true && termsAccepted === true,
  );

  // Las horas de recordatorio se programan como notificaciones locales al
  // entrar con una cuenta que ya las eligió: no dependen de que la persona
  // vuelva a pasar por el perfil, igual que el push se pide aquí y no en una
  // pantalla concreta.
  const { data: profile } = useProfile(userId ?? undefined);

  const syncRemindersEnabled =
    Boolean(userId) && hasOnboarded === true && termsAccepted === true;

  useEffect(() => {
    if (!syncRemindersEnabled || !profile) return;

    void syncLocalReminders(profile.reminder_hours ?? [], {
      // `i18next` también exporta un `t` suelto (sin `this`); el singleton por
      // defecto es el que `core/i18n/init` dejó inicializado.
      // eslint-disable-next-line import/no-named-as-default-member
      title: i18n.t("notifications.reminder"),
    });
  }, [syncRemindersEnabled, profile]);

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

  const refreshOnboarding = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signOut = useCallback(async () => {
    // Salir a propósito no es «te echaron de aquí»: la pantalla desde la que
    // se cierra sesión no queda como destino para quien entre después.
    forgetReturnToOnSignOut();

    // Revocar necesita el token de *este* dispositivo, que ya no se puede
    // pedir una vez la sesión se fue. Pero `getExpoPushTokenAsync` a veces
    // no vuelve: await de la revocación atrapaba a quien solo quería salir.
    // Se lanza y se olvida; el logout no espera.
    void revokeThisDevicePush().catch((caught) => {
      console.error("revoke_push_device before sign out", caught);
    });

    // `scope: "local"` so a server that is down or a token already rejected
    // cannot trap somebody in a session they asked to leave. Signing out is the
    // one action that must always work — it is the escape hatch every other
    // error state offers.
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      console.error("sign out failed", error);
    }

    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      hasOnboarded,
      termsAccepted,
      onboardingFailed: failed,
      refreshOnboarding,
      signOut,
    }),
    [
      session,
      isLoading,
      hasOnboarded,
      termsAccepted,
      failed,
      refreshOnboarding,
      signOut,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside a SessionProvider");
  }

  return context;
};
