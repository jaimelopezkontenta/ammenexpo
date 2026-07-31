import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

export type SharedPlanPreview = {
  plan_id: string;
  plan_title: string;
  plan_theme: string | null;
  owner_name: string;
  owner_avatar_url: string | null;
  day_id: string;
  day_number: number;
  day_title: string;
  scripture_ref: string | null;
  scripture_text: string | null;
  intercessor_prayer: string | null;
  intercession_count: number;
};

/**
 * Reads a shared plan through the anon-callable RPC. The function returns the
 * current day only and never the private prayer text, so this is safe to render
 * for a visitor with no account.
 */
export const useSharedPlanPreview = (token: string | undefined) =>
  useQuery({
    queryKey: ["sharePreview", token],
    enabled: Boolean(token),
    queryFn: async (): Promise<SharedPlanPreview | null> => {
      const { data, error } = await supabase.rpc("get_shared_plan_preview", {
        p_token: token,
      });

      if (error) {
        throw error;
      }

      return (data as SharedPlanPreview[] | null)?.[0] ?? null;
    },
  });
