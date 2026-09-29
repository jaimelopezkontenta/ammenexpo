import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { cleanupOnSessionChange } from "./sessionFlow";
import { forgetReturnToOnSignOut, noteSessionUser } from "@/core/nav/returnTo";
import { revokeThisDevicePush } from "@/core/notifications/push";
import { clearUserScopedStorage } from "@/core/storage/storage";

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

/**
 * La sesión y las dos puertas (términos, onboarding), y nada más.
 *
 * Lo que la app hace alrededor de la sesión —canjear un enlace pendiente,
 * pedir push, programar recordatorios, escuchar el tap de una notificación,
 * drenar la cola offline, el heartbeat— vive en `AppEffects`
 * (core/auth/AppEffects.ts), que escucha este contexto.
 */
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

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const userId = data.session?.user.id ?? null;
      lastUserId.current = userId;
      noteSessionUser(userId);
      // Arrancar sin sesión también limpia lo guardado de la persona (el día
      // para leer sin red): si la sesión se perdió con la app cerrada, no
      // hubo transición que lo hiciera.
      if (cleanupOnSessionChange(null, userId).clearUserStorage) {
        void clearUserScopedStorage();
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
        // Lo mismo con lo guardado en el dispositivo que es de la persona: el
        // día para leer sin red lleva el texto de oración y en web vive en
        // localStorage (core/storage/keys.ts, `USER_SCOPED_PREFIXES`).
        if (cleanup.clearUserStorage) void clearUserScopedStorage();

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
