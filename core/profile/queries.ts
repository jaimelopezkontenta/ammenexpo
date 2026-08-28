import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "i18next";

import { supabase } from "@/utils/supabase";

import { syncLocalReminders } from "@/core/notifications/localReminders";
import {
  sanitizeOnboardingAnswers,
  type OnboardingAnswers,
} from "./onboardingAnswers";

import type { Streak } from "./streak";

export { liveStreak, type Streak } from "./streak";

export type Profile = {
  display_name: string;
  avatar_url: string | null;
  /** Se pone a mano en la base. No hay pantalla para nombrar staff, a propósito. */
  is_staff: boolean;
  reminder_hours: number[];
  timezone: string;
  locale: string;
};

export const useStreak = (userId: string | undefined) =>
  useQuery({
    queryKey: ["streak", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Streak | null> => {
      const { data, error } = await supabase
        .rpc("my_profile_data")
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // La RPC devuelve is_staff además; el tipo Streak solo lleva la racha.
      const row = data as {
        is_staff: boolean;
        streak_count: number;
        streak_last_day: string | null;
      };

      return {
        streak_count: row.streak_count,
        streak_last_day: row.streak_last_day,
      };
    },
  });

/** Nombre y cara en `profiles`; el bit de staff en `my_profile_data()`; el resto, solo del dueño, en `profile_settings`. */
export const useProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const [
        { data: profile, error },
        { data: staff, error: staffError },
        { data: settings, error: settingsError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", userId!)
          .maybeSingle(),
        supabase.rpc("my_profile_data").maybeSingle(),
        supabase
          .from("profile_settings")
          .select("reminder_hours, timezone, locale")
          .eq("id", userId!)
          .maybeSingle(),
      ]);

      if (error) throw error;
      if (staffError) throw staffError;
      if (settingsError) throw settingsError;
      if (!profile || !settings) return null;

      const staffRow = staff as { is_staff: boolean } | null;

      return {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        is_staff: staffRow?.is_staff ?? false,
        ...(settings as Omit<
          Profile,
          "display_name" | "avatar_url" | "is_staff"
        >),
      };
    },
  });

export const useUpdateProfile = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changes: {
      displayName?: string;
      reminderHours?: number[];
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

      if (changes.reminderHours !== undefined) {
        const { data, error } = await supabase
          .from("profile_settings")
          .update({ reminder_hours: changes.reminderHours })
          .eq("id", userId!)
          .select("id");

        if (error) throw error;
        if (!data?.length) throw new Error("settings_update_no_rows");
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      // The name is stamped into plans and shown to everyone praying for you.
      void queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] });
      void queryClient.invalidateQueries({ queryKey: ["whoPrayedForMe"] });

      // Las horas elegidas son las horas del recordatorio local: se
      // reprograman al guardar, sin esperar al refetch que el SessionProvider
      // también escucha. Solo cuando vinieron en la mutación; un cambio de
      // nombre no toca las notificaciones.
      if (variables.reminderHours !== undefined) {
        void syncLocalReminders(variables.reminderHours, {
          // `i18next` también exporta un `t` suelto (sin `this`); el singleton
          // por defecto es el que `core/i18n/init` dejó inicializado.
          // eslint-disable-next-line import/no-named-as-default-member
          title: i18n.t("notifications.reminder"),
        });
      }
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

export {
  sanitizeOnboardingAnswers,
  type OnboardingAnswers,
} from "./onboardingAnswers";

/**
 * What the person already told us during onboarding.
 *
 * The plan form asks "¿Sobre qué quieres orar?" over the *same* eight options
 * onboarding just asked about — `TOPIC_KEYS` in `plan/nuevo.tsx` is identical
 * to the list in `bienvenida.tsx`. Finishing four questions and immediately
 * meeting a fifth that repeats two of them reads as an app that was not
 * listening. The server merges these answers anyway; this only makes the form
 * start from them instead of from nothing.
 */
export const useOnboardingAnswers = (userId: string | undefined) =>
  useQuery({
    queryKey: ["onboardingAnswers", userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async (): Promise<OnboardingAnswers | null> => {
      const { data, error } = await supabase
        .from("profile_settings")
        .select("onboarding_answers")
        .eq("id", userId!)
        .maybeSingle();

      if (error) throw error;

      return sanitizeOnboardingAnswers(
        (data as { onboarding_answers: OnboardingAnswers | null } | null)
          ?.onboarding_answers ?? null,
      );
    },
  });

export type PublicProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  member_since: string;
  shares_circle: boolean;
  is_me: boolean;
  i_follow: boolean;
  follower_count: number;
  following_count: number;
  /**
   * Ya decidida en el servidor, y con **el día de esa persona**. `liveStreak`
   * compara contra la fecha del dispositivo, que es la de quien mira: para tu
   * propia racha da igual, para la de alguien al otro lado del mundo no.
   */
  streak: number;
};

/**
 * Quién es la persona que oró por ti.
 *
 * Devuelve nada para alguien a quien has bloqueado — la regla vive en la RPC
 * para que ninguna pantalla tenga que acordarse. La racha no viaja: en tu
 * perfil es motivación, en el de otra persona es comparación.
 */
export const usePublicProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: ["publicProfile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PublicProfile | null> => {
      const { data, error } = await supabase.rpc("public_profile", {
        p_user_id: userId!,
      });

      if (error) throw error;

      return ((data ?? []) as PublicProfile[])[0] ?? null;
    },
  });

/**
 * La zona horaria decide cuándo se abre tu día y cuándo cuenta tu racha, y se
 * escribía **una sola vez** en el onboarding: quien se mudaba de país no tenía
 * forma de arreglarlo desde ninguna pantalla.
 *
 * Sin selector de las cuatrocientas zonas IANA: el caso real es "me he mudado",
 * y para eso basta con comparar la guardada con la que dice el dispositivo y
 * ofrecer el cambio cuando difieren.
 */
export const useUpdateTimezone = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timezone: string) => {
      const { data, error } = await supabase
        .from("profile_settings")
        .update({ timezone })
        .eq("id", userId!)
        .select("id");

      if (error) throw error;
      if (!data?.length) throw new Error("timezone_update_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      // El día de hoy y la racha se calculan con la zona: con la vieja en caché
      // seguirías viendo el día de tu país anterior.
      void queryClient.invalidateQueries({ queryKey: ["todayDay"] });
      void queryClient.invalidateQueries({ queryKey: ["myPlans", userId] });
      void queryClient.invalidateQueries({ queryKey: ["streak", userId] });
    },
  });
};

/**
 * El idioma se guardaba solo en el dispositivo: `LanguageSwitcher` llamaba a
 * `i18n.changeLanguage` y a AsyncStorage, y **nunca escribía
 * `profile_settings.locale`**. El servidor creía que hablabas otro idioma del
 * que estabas viendo, y eso importa el día que el push mande texto.
 */
export const useUpdateLocale = (userId: string | undefined) =>
  useMutation({
    mutationFn: async (locale: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from("profile_settings")
        .update({ locale })
        .eq("id", userId);

      // Sin lanzar: cambiar de idioma tiene que funcionar aunque no haya red, y
      // la pantalla ya está en el idioma nuevo. Se reintenta al siguiente
      // cambio; lo que no puede es romper el selector.
      if (error) console.error("could not persist the locale", error);
    },
  });
