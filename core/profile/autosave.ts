import type { Profile } from "./queries";

/**
 * El guardado de Perfil, sin botón: el nombre al terminar de editar y las
 * horas al elegirlas.
 *
 * Tema e idioma ya se guardaban al instante, y nombre y horas colgaban de un
 * «Guardar» que aparecía lejos de sus controles: dos modelos en una pantalla.
 * Lo que sigue son las tres piezas puras que hacen falta para uno solo.
 */

/** Las horas, como conjunto: dos arrays con los mismos números son lo mismo. */
export const sameHours = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((hour) => b.includes(hour));

/**
 * Deja pasar un ratito antes de guardar, para que tres toques seguidos en las
 * horas sean UN guardado y un toast, no tres.
 *
 * Se conserva el último valor (los anteriores no importan), y `flush` lo
 * manda ya: para cuando la pantalla se va con algo pendiente. `setSave`
 * cambia quién guarda sin perder lo pendiente: el ahorrador vive lo que la
 * pantalla, pero el guardado que ve el render de turno cambia en cada uno.
 */
export const createDebouncedSaver = <T>(
  initialSave: (value: T) => void,
  waitMs: number,
) => {
  let save = initialSave;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = () => {
    clear();
    if (!pending) return;
    const { value } = pending;
    pending = null;
    save(value);
  };

  return {
    schedule: (value: T) => {
      pending = { value };
      clear();
      timer = setTimeout(flush, waitMs);
    },
    flush,
    cancel: () => {
      clear();
      pending = null;
    },
    setSave: (next: (value: T) => void) => {
      save = next;
    },
  };
};

/**
 * Lo guardado, sobre el perfil en caché.
 *
 * Sin esto, entre que el guardado termina y el refetch vuelve, el campo del
 * nombre enseñaba un instante el nombre viejo: el borrador se suelta al
 * guardar y lo que queda debajo es la caché.
 */
export const applyProfileChanges = (
  profile: Profile,
  changes: { displayName?: string; reminderHours?: number[] },
): Profile => ({
  ...profile,
  ...(changes.displayName !== undefined
    ? { display_name: changes.displayName.trim().slice(0, 80) }
    : null),
  ...(changes.reminderHours !== undefined
    ? { reminder_hours: changes.reminderHours }
    : null),
});
