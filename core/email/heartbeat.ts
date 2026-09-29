import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { supabase } from "../../utils/supabase";

const THROTTLE_MS = 60 * 60 * 1000;

/**
 * last_seen_at, 1×/hora. Lo necesita el win-back. El SQL también ignora
 * escrituras más frescas de 50 minutos, así que un cliente ruidoso no satura.
 */
export const useLastSeenHeartbeat = (userId: string | undefined) => {
  const lastSent = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const beat = () => {
      const now = Date.now();
      if (now - lastSent.current < THROTTLE_MS) return;
      lastSent.current = now;
      void supabase.rpc("heartbeat_last_seen").then(({ error }) => {
        if (error) console.error("heartbeat_last_seen", error);
      });
    };

    beat();

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") beat();
    });

    return () => sub.remove();
  }, [userId]);
};
