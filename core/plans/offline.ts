import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { AppState } from "react-native";

import { supabase } from "../../utils/supabase";

import type { PlanDay } from "./queries";

/**
 * Capa offline del día de hoy.
 *
 * Dos garantías para "que el usuario vuelva mañana" que no existían y hacían
 * que la promesa se cayera en cuanto no había red:
 *
 * 1. Releer el día sin red. Si `get_my_day` falla por red, se sirve el último
 *    `PlanDay` cacheado para ese plan. Quien abrió la app por la mañana puede
 *    volver por la noche en el metro y seguir leyendo lo de hoy.
 *
 * 2. "Ya oré" sin red. Si el insert de `prayer_logs` falla por red, se encola
 *    `{ dayId, userId }` y la UI igual marca "Oraste hoy". La cola se drena al
 *    montar la sesión o al volver a foreground (`useFlushPrayedQueue`).
 *
 * Sin dependencias nuevas: AsyncStorage ya estaba, y la cola es un JSON en una
 * clave. Las funciones puras (`mergeQueue`, `dropEntry`, `isNetworkError`) viven
 * aquí para poder probarlas sin tocar storage ni red.
 */

// -- Claves ---------------------------------------------------------------

const todayKey = (planId: string) => `ammen.todayDay.${planId}`;
const QUEUE_KEY = "ammen.prayedQueue";

export type PrayedEntry = {
  dayId: string;
  userId: string;
};

// -- Funciones puras (testeables sin IO) ----------------------------------

/**
 * Sin `code` de Postgres → el error no vino de la base, vino de la red
 * (supabase-js envuelve un fetch caído en un objeto sin SQLSTATE). Un 23505
 * (único) o un 42501 (RLS) SÍ traen `code` y no son red: tratarlas como red
 * haría que un duplicado o un permiso denegado se encolara para siempre.
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error == null || typeof error !== "object") {
    return true;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code !== "string" || code.length === 0;
};

/** Añade un entry sin duplicar (la fila es el par dayId+userId). */
export const mergeQueue = (
  queue: PrayedEntry[],
  entry: PrayedEntry,
): PrayedEntry[] => {
  const already = queue.some(
    (e) => e.dayId === entry.dayId && e.userId === entry.userId,
  );

  return already ? queue : [...queue, entry];
};

/** Quita el entry de la cola; no es un error si no estaba. */
export const dropEntry = (
  queue: PrayedEntry[],
  dayId: string,
  userId: string,
): PrayedEntry[] =>
  queue.filter((e) => !(e.dayId === dayId && e.userId === userId));

/** Guarda contra una clave corrupta a medias: solo sobreviven entries sanos. */
const isPrayedEntry = (value: unknown): value is PrayedEntry => {
  if (value == null || typeof value !== "object") return false;

  const e = value as { dayId?: unknown; userId?: unknown };

  return typeof e.dayId === "string" && typeof e.userId === "string";
};

// -- IO -------------------------------------------------------------------

export const cacheTodayDay = async (
  planId: string,
  day: PlanDay,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(todayKey(planId), JSON.stringify(day));
  } catch {
    // Best effort: fallar aquí no puede tirar abajo un día que SÍ se leyó.
  }
};

export const readCachedTodayDay = async (
  planId: string,
): Promise<PlanDay | null> => {
  try {
    const raw = await AsyncStorage.getItem(todayKey(planId));

    if (!raw) return null;

    return JSON.parse(raw) as PlanDay;
  } catch {
    // Clave corrupta o storage bloqueado: es como no tener caché.
    return null;
  }
};

export const readPrayedQueue = async (): Promise<PrayedEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isPrayedEntry);
  } catch {
    return [];
  }
};

export const enqueuePrayed = async (entry: PrayedEntry): Promise<void> => {
  try {
    const next = mergeQueue(await readPrayedQueue(), entry);

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Si ni siquiera podemos encolar, la UI ya mostró "Oraste hoy": el dato se
    // pierde esta vez y el streak se arreglará en el próximo intento con red.
  }
};

export const removePrayed = async (
  dayId: string,
  userId: string,
): Promise<void> => {
  try {
    const next = dropEntry(await readPrayedQueue(), dayId, userId);

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    // Best effort: un remove fallido solo reintenta un entry ya persistido, y
    // 23505 lo absorbe como éxito sin duplicar.
  }
};

// -- Flush ----------------------------------------------------------------

export type PrayedInsertFn = (entry: PrayedEntry) => Promise<{
  error: { code?: string } | null;
}>;

const insertPrayedLog: PrayedInsertFn = async (entry) =>
  supabase.from("prayer_logs").insert({
    plan_day_id: entry.dayId,
    user_id: entry.userId,
  });

/**
 * Drena la cola de "Ya oré".
 *
 *   - 23505 (la fila ya existía) = éxito: se quita de la cola.
 *   - Error de red = se deja en la cola para el siguiente flush.
 *   - Cualquier otro error (RLS, restricción, …) = se quita para no reintentar
 *     en bucle algo que nunca va a pasar.
 */
export const flushPrayedQueue = async (
  insertFn: PrayedInsertFn = insertPrayedLog,
): Promise<void> => {
  const queue = await readPrayedQueue();

  for (const entry of queue) {
    try {
      const { error } = await insertFn(entry);

      if (!error || error.code === "23505") {
        await removePrayed(entry.dayId, entry.userId);
        continue;
      }

      if (isNetworkError(error)) {
        continue; // queda en la cola para el siguiente flush
      }

      await removePrayed(entry.dayId, entry.userId);
    } catch (caught) {
      // Un insert que LANZA (en vez de devolver error) también es transitorio
      // si es de red; si no, lo descartamos para no colgar el flush.
      if (isNetworkError(caught)) {
        continue;
      }

      await removePrayed(entry.dayId, entry.userId);
    }
  }
};

/**
 * Drena la cola al montar (o al cambiar de usuario) y al volver a foreground.
 *
 * NO se engancha aquí en SessionProvider: ese fichero lo toca también el
 * asiento de recordatorios. El orquestador llamará a este hook cuando pueda.
 */
export const useFlushPrayedQueue = (userId: string | null): void => {
  useEffect(() => {
    if (!userId) return;

    const flush = () => {
      void flushPrayedQueue().catch((caught) => {
        console.error("flush prayed queue", caught);
      });
    };

    // Al montar (o al cambiar de usuario).
    flush();

    // Volver de background es el momento en que más probablemente hay red.
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") flush();
    });

    return () => subscription.remove();
  }, [userId]);
};
