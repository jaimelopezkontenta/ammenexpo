/**
 * Milisegundos hasta la próxima medianoche local (como mínimo uno).
 *
 * Para lo que es «de hoy» y no debe durar más que hoy: con `staleTime:
 * Infinity`, el versículo del día de ayer seguía ahí por la mañana si la app
 * no se había cerrado. Con esto caduca a medianoche y, al volver a la app, se
 * pide el de hoy.
 */
export const msUntilLocalMidnight = (now: Date = new Date()): number => {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1, midnight.getTime() - now.getTime());
};

const pad = (n: number) => String(n).padStart(2, "0");

/** La fecha local como `YYYY-MM-DD`: la del reloj de quien usa la app. */
export const localDateKey = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
