import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/utils/supabase";

type SessionState = {
  session: Session | null;
  /** True until the stored session has been read. */
  isLoading: boolean;
  /** null while unknown — do not route on it. */
  hasOnboarded: boolean | null;
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

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  // Keyed by user, so signing in as someone else can never inherit the
  // previous account's onboarding state.
  const { data, refetch } = useQuery({
    queryKey: ["onboarding", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: settings } = await supabase
        .from("profile_settings")
        .select("onboarding_answers")
        .eq("id", userId!)
        .maybeSingle();

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
      refreshOnboarding,
      signOut,
    }),
    [session, isLoading, hasOnboarded, refreshOnboarding, signOut],
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
