import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import type { Streak } from "./streak";

export { liveStreak, type Streak } from "./streak";

export const useStreak = (userId: string | undefined) =>
  useQuery({
    queryKey: ["streak", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Streak | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("streak_count, streak_last_day")
        .eq("id", userId!)
        .maybeSingle();

      if (error) throw error;

      return data as Streak | null;
    },
  });
