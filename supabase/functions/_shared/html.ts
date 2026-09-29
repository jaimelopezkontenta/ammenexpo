/**
 * Escapa texto para meterlo en HTML de correo. Una sola copia: `render.ts` y
 * `shell.ts` tenían la suya, idéntica, y la seguridad del correo no debe
 * depender de que dos copias sigan iguales.
 *
 * No escapa la comilla simple a propósito: ningún atributo del shell va entre
 * comillas simples, y cambiarlo alteraría el HTML que ya se envía.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
