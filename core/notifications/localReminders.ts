import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  isLocalReminderIdentifier,
  LOCAL_REMINDER_IDENTIFIER_PREFIX,
} from "./resolveTarget";

/**
 * Recordatorios de oración como notificaciones LOCALES, sin servidor.
 *
 * A diferencia del push (ver `push.ts`), esto no sale del dispositivo ni
 * necesita token de Expo: se programa en el propio teléfono para que suene a
 * diario a las horas que la persona eligió en su perfil. El plan prohíbe push
 * remoto para esto — no hay EAS_PROJECT_ID ni pg_cron de por medio.
 *
 * **Web queda fuera a propósito.** `expo-notifications` no programa
 * notificaciones locales en el navegador, así que se corta antes de tocar
 * ninguna API nativa que no exista ahí. El copy de perfil ya distingue
 * nativo de web; aquí solo se cumple la promesa del nativo.
 */

/** El canal de Android marca la frontera de "lo nuestro" frente al push. */
const REMINDER_CHANNEL_ID = "ammen-reminders";

/**
 * El identifier de cada notificación local es su única marca de propiedad:
 * `ammen-reminder-<hour>`. Cancelar por prefijo no puede tocar el push, que
 * usa identifiers distintos y nunca se programa con `scheduleNotificationAsync`.
 */
export const reminderIdentifier = (hour: number): string =>
  `${LOCAL_REMINDER_IDENTIFIER_PREFIX}${hour}`;

/**
 * Solo enteros dentro de un día (0–23), sin duplicados y en orden. Una hora
 * corrupta en la base no puede llegar a `scheduleNotificationAsync`: un
 * trigger fuera de rango lanzaría, o peor, se interpretaría mal.
 */
export const normalizeReminderHours = (hours: number[]): number[] => {
  const seen = new Set<number>();

  return hours
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
    .filter((hour) => {
      if (seen.has(hour)) return false;
      seen.add(hour);
      return true;
    })
    .sort((a, b) => a - b);
};

/**
 * El handler de foreground se registra una sola vez por proceso y decide qué
 * se muestra para TODAS las notificaciones de la app (locales y push). Sin él,
 * una notificación que llega con la app abierta no se enseña, y un
 * recordatorio que no se enseña no recuerda nada.
 */
let foregroundHandlerInstalled = false;
const ensureForegroundHandler = () => {
  if (foregroundHandlerInstalled) return;
  foregroundHandlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

/**
 * En Android hay que crear el canal antes de programar sobre él; en iOS el
 * concepto no existe y la llamada devuelve null sin efecto.
 */
const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Ammen",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
};

/**
 * Cancela solo las nuestras. Nunca `cancelAllScheduledNotificationsAsync`:
 * borraría también el push que otra parte de la app sí registra.
 */
const cancelOurReminders = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  await Promise.all(
    scheduled
      .filter(({ identifier }) => isLocalReminderIdentifier(identifier))
      .map(({ identifier }) =>
        Notifications.cancelScheduledNotificationAsync(identifier),
      ),
  );
};

/**
 * Programa (o limpia) los recordatorios diarios a las horas del perfil.
 *
 * `hours` vacío significa "dejar de avisar": se cancelan los que hubiera y no
 * se programa ninguno. Un permiso denegado es una respuesta, no un error: se
 * cancelan los nuestros y se sale sin lanzar.
 */
export const syncLocalReminders = async (
  hours: number[],
  { title }: { title: string },
): Promise<void> => {
  if (Platform.OS === "web") return;

  try {
    ensureForegroundHandler();
    await ensureAndroidChannel();

    const { status } = await Notifications.requestPermissionsAsync();

    // Denegado ≠ error: usar la app sin avisos sigue siendo el camino normal.
    // Se cancelan los nuestros por si antes hubo permiso y ahora ya no.
    if (status !== "granted") {
      await cancelOurReminders();
      return;
    }

    // Se limpia antes de programar para que quitar una hora borre su
    // notificación; si no, quedaría sonando un recordatorio ya no elegido.
    await cancelOurReminders();

    for (const hour of normalizeReminderHours(hours)) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminderIdentifier(hour),
        content: { title },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
    }
  } catch (caught) {
    // Nunca deja una promesa rechazada sin dueño: `expo-notifications` puede
    // no estar disponible (simulador, build sin el módulo) y quien llama lo
    // hace con `void`, donde nada más podría capturar el rechazo.
    console.error("syncLocalReminders failed", caught);
  }
};
