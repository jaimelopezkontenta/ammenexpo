import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import type { Streak } from "./streak";

export { liveStreak, type Streak } from "./streak";

export type Profile = {
  display_name: string;
  reminder_hour: number;
  timezone: string;
  locale: string;
};

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

/** Name lives on `profiles`; the rest is owner-only on `profile_settings`. */
export const useProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const [
        { data: profile, error },
        { data: settings, error: settingsError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", userId!)
          .maybeSingle(),
        supabase
          .from("profile_settings")
          .select("reminder_hour, timezone, locale")
          .eq("id", userId!)
          .maybeSingle(),
      ]);

      if (error) throw error;
      if (settingsError) throw settingsError;
      if (!profile || !settings) return null;

      return {
        display_name: (profile as { display_name: string }).display_name,
        ...(settings as Omit<Profile, "display_name">),
      };
    },
  });

export const useUpdateProfile = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: {
      displayName?: string;
      reminderHour?: number;
    }) => {
      if (changes.displayName !== undefined) {
        const { data, error } = await supabase
          .from("profiles")
          .update({ display_name: changes.displayName.trim().slice(0, 80) })
          .eq("id", userId!)
          .select("id");

        if (error) throw error;

        // A row count of zero is how RLS refuses an update: no error, no rows.
        if (!data?.length) throw new Error("profile_update_no_rows");
      }

      if (changes.reminderHour !== undefined) {
        const { data, error } = await supabase
          .from("profile_settings")
          .update({ reminder_hour: changes.reminderHour })
          .eq("id", userId!)
          .select("id");

        if (error) throw error;
        if (!data?.length) throw new Error("settings_update_no_rows");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      // The name is stamped into plans and shown to everyone praying for you.
      void queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] });
      void queryClient.invalidateQueries({ queryKey: ["whoPrayedForMe"] });
    },
  });
};

/**
 * Deletes the account and everything attached to it.
 *
 * The function takes no argument and reads `auth.uid()` itself — one that
 * accepted a user id would be a single policy mistake away from deleting
 * somebody else's account.
 */
export const useDeleteAccount = () =>
  useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_account");

      if (error) throw error;

      // The session now points at a user that no longer exists.
      await supabase.auth.signOut();
    },
  });
