/**
 * Límites del generador, en un solo sitio.
 *
 * La base de datos es la autoridad real: `reserve_generation` rechaza
 * duraciones fuera de rango y `claim_generation_chunk` calcula el tramo desde
 * los días escritos. Esta copia en TypeScript solo existe para que el Edge
 * Function conteste con un error amable ANTES de gastar una llamada, y para que
 * la lógica pura tenga pruebas sin base. Ambas copias tienen que decir lo mismo
 * o el servidor y el cliente discrepan; `bounds.test.ts` fija la de TypeScript,
 * `supabase/tests/generation.sql` fija la de SQL.
 */

export const MIN_DAYS = 3;
export const MAX_DAYS = 30;

/**
 * Días por request. Un plan de 30 días no cabe en una sola llamada (el reloj
 * de pared del Edge Function mata el isolate a mitad), así que cada tramo lo
 * escribe una invocación con su propio presupuesto de tiempo.
 */
export const CHUNK_DAYS = 7;

export type DurationCheck =
  { ok: true; days: number } | { ok: false; min: number; max: number };

/**
 * La duración que pide el cliente, validada. `NaN` o no-número se rechaza;
 * un número con decimales se redondea igual que hacía el servidor antes.
 */
export const checkDuration = (raw: unknown): DurationCheck => {
  const days = typeof raw === "number" ? Math.round(raw) : Number.NaN;

  if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) {
    return { ok: false, min: MIN_DAYS, max: MAX_DAYS };
  }

  return { ok: true, days };
};

export type NextChunk = { fromDay: number; toDay: number } | null;

/**
 * El tramo que toca escribir a continuación, desde lo ya escrito. `null`
 * cuando el plan está completo. Rechaza un `written` negativo o mayor que la
 * duración en vez de devolver un rango absurdo.
 */
export const nextChunk = (written: number, durationDays: number): NextChunk => {
  if (!Number.isInteger(durationDays) || durationDays < 1) return null;
  if (!Number.isInteger(written) || written < 0) return null;
  if (written >= durationDays) return null;

  const fromDay = written + 1;
  const toDay = Math.min(written + CHUNK_DAYS, durationDays);

  return { fromDay, toDay };
};
