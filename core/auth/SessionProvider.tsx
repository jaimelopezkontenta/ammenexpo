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

type SessionState = {
  session: Session | null;
  /** True until the stored session has been read. */
  isLoading: boolean;
  /** null while unknown — do not route on it. */
  hasOnboarded: boolean | null;
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
        .select("onboarding_answers")
        .eq("id", userId!)
        .maybeSingle();

      // Swallowing this used to turn any network blip into "false", which the
      // gate below reads as "never onboarded" — dropping someone with a year of
      // history back into step 1 of 4, with no way to skip it. A failed read
      // must stay a failure so the query retries instead of deciding.
      if (error) throw error;

      return Boolean(settings?.onboarding_answers);
    },
  });

  const hasOnboarded = userId ? (data ?? null) : null;

  const refreshOnboarding = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      hasOnboarded,
      onboardingFailed,
      refreshOnboarding,
      signOut,
    }),
    [
      session,
      isLoading,
      hasOnboarded,
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
