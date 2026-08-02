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

import { TERMS_VERSION } from "@/core/legal/documents";
import { supabase } from "@/utils/supabase";

import { redeemPendingTokens } from "./pendingToken";

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

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      lastUserId.current = data.session?.user.id ?? null;
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
        if (lastUserId.current !== null && lastUserId.current !== nextUserId) {
          queryClient.clear();
        }

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
    if (!userId) return;

    let active = true;

    void redeemPendingTokens().then((planId) => {
      if (!active || !planId) return;

      // Redeeming is what makes that plan visible. Without invalidating, the
      // Orar tab would keep insisting nobody had shared anything — this app
      // never refetches on focus, so it would say so until it was killed.
      void queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] });
      void queryClient.invalidateQueries({ queryKey: ["circles"] });
    });

    return () => {
      active = false;
    };
  }, [userId, queryClient]);

  // Keyed by user, so signing in as someone else can never inherit the
  // previous account's onboarding state.
  const {
    data,
    isError: onboardingFailed,
    refetch,
  } = useQuery({
    queryKey: ["onboarding", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
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
      // no longer exists — a token the client still believes in. That belongs
      // on the error screen, which offers signing out, not in an onboarding
      // whose submit button can never succeed.
      if (!settings) {
        throw new Error("profile_settings_missing");
      }

      return {
        onboarded: Boolean(settings.onboarding_answers),
        // La versión y no un booleano: el día que el texto cambie de forma
        // importante hay que volver a preguntar, y un `true` no sabe de qué
        // texto venía.
        termsVersion: (settings.terms_version as string | null) ?? null,
      };
    },
    // A vanished account will not come back on the fourth attempt, and every
    // retry is another few seconds of a blank spinner.
    retry: 1,
  });

  const hasOnboarded = userId ? (data?.onboarded ?? null) : null;
  const termsAccepted = userId
    ? data
      ? data.termsVersion === TERMS_VERSION
      : null
    : null;

  const refreshOnboarding = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signOut = useCallback(async () => {
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
      onboardingFailed,
      refreshOnboarding,
      signOut,
    }),
    [
      session,
      isLoading,
      hasOnboarded,
      termsAccepted,
      onboardingFailed,
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
