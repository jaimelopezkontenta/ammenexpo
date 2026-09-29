import i18n from "i18next";
import { useEffect } from "react";

import { syncLocalReminders } from "@/core/notifications/localReminders";
import { useProfile } from "@/core/profile/queries";

/**
 * Las horas de recordatorio se programan como notificaciones locales al
 * entrar con una cuenta que ya las eligió: no dependen de que la persona
 * vuelva a pasar por el perfil, igual que el push se pide al entrar y no en
 * una pantalla concreta.
 *
 * `enabled` es `insideAppGatesOpen` (core/auth/sessionFlow.ts): con las
 * puertas cruzadas, no antes.
 */
export const useLocalReminderSync = (
  userId: string | undefined,
  enabled: boolean,
) => {
  const { data: profile } = useProfile(userId);

  useEffect(() => {
    if (!enabled || !profile) return;

    void syncLocalReminders(profile.reminder_hours ?? [], {
      // `i18next` también exporta un `t` suelto (sin `this`); el singleton por
      // defecto es el que `core/i18n/init` dejó inicializado.
      // eslint-disable-next-line import/no-named-as-default-member
      title: i18n.t("notifications.reminder"),
    });
  }, [enabled, profile]);
};
