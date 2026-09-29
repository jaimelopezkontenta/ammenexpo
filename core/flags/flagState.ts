/**
 * Lo que el cliente sabe de un flag: encendido, apagado o **sin saber**.
 *
 * Son tres estados y no un booleano a propósito. En el servidor un flag ausente
 * o que falla es «apagado» (`flag_enabled` es fail-closed, y `home_feed` /
 * `prayer_feed` devuelven vacío), pero el cliente no debe copiar esa decisión:
 * una red caída no es una comunidad cerrada, y decirle «abre pronto» a quien
 * simplemente no tenía conexión es una mentira con cara de aviso. Mientras
 * carga o si la lectura falla, el estado es `unknown` y la pantalla se
 * comporta como siempre; solo un `false` que el servidor dijo en voz alta es
 * `off`.
 */
export type FlagState = "on" | "off" | "unknown";

export const toFlagState = (value: unknown): FlagState => {
  if (value === true) return "on";
  if (value === false) return "off";
  return "unknown";
};
