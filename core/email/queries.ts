import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../utils/supabase";

import {
  isEmailCadence,
  type EmailCadence,
  type EmailPreferences,
} from "./cadence";

import { requireUserId } from "@/core/auth/requireUserId";
import { qk } from "@/core/query/keys";
const parsePrefs = (
  row: {
    cadence?: string;
    social?: boolean;
    nudge?: boolean;
  } | null,
): EmailPreferences | null => {
  if (!row || !isEmailCadence(row.cadence)) return null;
  return {
    cadence: row.cadence,
    social: row.social !== false,
    nudge: row.nudge !== false,
  };
};

export const useEmailPreferences = (userId: string | undefined) =>
  useQuery({
    queryKey: qk.emailPreferences(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<EmailPreferences | null> => {
      const { data, error } = await supabase
        .from("email_preferences")
        .select("cadence, social, nudge")
        .eq("user_id", requireUserId(userId))
        .maybeSingle();

      if (error) throw error;
      return parsePrefs(data);
    },
  });

export const useEmailPreferencesByToken = (token: string | undefined) =>
  useQuery({
    queryKey: qk.emailPreferencesToken(token),
    enabled: Boolean(token),
    queryFn: async (): Promise<EmailPreferences | null> => {
      const { data, error } = await supabase.rpc("email_prefs_by_token", {
        p_token: token!,
      });

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return parsePrefs(row as EmailPreferences | null);
    },
  });

export const useUpdateEmailPreferences = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: Partial<EmailPreferences>) => {
      const { data, error } = await supabase
        .from("email_preferences")
        .update(changes)
        .eq("user_id", requireUserId(userId))
        .select("user_id");

      if (error) throw error;
      if (!data?.length) throw new Error("email_prefs_update_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.emailPreferences(userId),
      });
    },
  });
};

export const useUpdateEmailPreferencesByToken = (token: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: Partial<EmailPreferences>) => {
      const { data, error } = await supabase.rpc(
        "update_email_prefs_by_token",
        {
          p_token: token!,
          // `undefined` = no tocar ese ajuste (el argumento tiene default null).
          p_cadence: changes.cadence ?? undefined,
          p_social: changes.social ?? undefined,
          p_nudge: changes.nudge ?? undefined,
        },
      );

      if (error) throw error;
      if (!data) throw new Error("email_prefs_token_rejected");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.emailPreferencesToken(token),
      });
    },
  });
};

export const useReactivateEmailCadence = (token: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc(
        "reactivate_email_cadence_by_token",
        {
          p_token: token!,
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.emailPreferencesToken(token),
      });
    },
  });
};

export const useEnqueueInviteEmail = () =>
  useMutation({
    mutationFn: async (input: {
      kind: "app" | "circle" | "plan";
      toEmail: string;
      token: string;
    }) => {
      const { data, error } = await supabase.rpc("enqueue_invite_email", {
        p_kind: input.kind,
        p_to_email: input.toEmail.trim(),
        p_token: input.token,
      });

      if (error) throw error;

      const result = data as { ok?: boolean; reason?: string } | null;
      if (!result?.ok) {
        const reason = result?.reason ?? "not_enqueued";
        throw new Error(reason);
      }
    },
  });

export const defaultOnboardingCadence = (isWeb: boolean): EmailCadence =>
  isWeb ? "daily" : "off";
