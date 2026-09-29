/**
 * Las decisiones de la cola de moderación (app/moderacion.tsx), puras para
 * poder probarlas sin montar la pantalla.
 */

/**
 * ¿Se puede ocultar para todos lo reportado? Desde el reporte y como staff:
 * los `hide_*` de antes eran de admin de círculo y no servían ni en círculos
 * ajenos ni en el muro abierto.
 *
 * Un testimonio y una intercesión no se ocultan: el testimonio lo retira
 * quien lo escribió, y una intercesión reportada se resuelve bloqueando.
 * Fingir un botón que no hace nada sería peor que no ponerlo.
 */
export const canHideReported = (targetType: string) =>
  targetType === "post" || targetType === "comment" || targetType === "message";

/**
 * El motivo de liberar o retirar un retenido, y la nota de una crisis: la
 * fila de auditoría no se deja escribir vacía, así que en blanco es nada.
 */
export const requiredText = (value: string | undefined): string | null => {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
};

/** La guardia de crisis enseña solo lo que nadie ha acusado todavía. */
export const unacknowledged = <Row extends { acknowledged_at: unknown }>(
  rows: readonly Row[] | undefined,
): Row[] => (rows ?? []).filter((row) => !row.acknowledged_at);
