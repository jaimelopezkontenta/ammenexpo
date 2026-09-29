import {
  BIBLE_VERSIONS,
  bibleVersionForLanguage,
  type BibleVersion,
} from "./versions";

/**
 * Qué Biblia se lee: la que la persona eligió en el lector o, si nunca eligió,
 * la del idioma de la interfaz.
 *
 * Se guarda en el dispositivo y no en la cuenta, como la letra del lector. La
 * clave lleva versión: si el formato cambiara, la vieja se ignoraría en vez de
 * malinterpretarse.
 */
export const BIBLE_VERSION_STORAGE_KEY = "ammen.bibleVersion.v1";

/**
 * Un valor de fuera (el almacén, un parámetro de ruta) como versión, o null si
 * no es una que la app conozca. Una versión que se retire del catálogo deja de
 * valer aquí y la persona vuelve a la de su idioma, en vez de quedarse con un
 * lector vacío: la base responde vacío a una versión que no tiene.
 */
export const parseBibleVersion = (value: unknown): BibleVersion | null =>
  typeof value === "string" &&
  (BIBLE_VERSIONS as readonly string[]).includes(value)
    ? (value as BibleVersion)
    : null;

/**
 * La versión activa. Sin elección manda el idioma: quien pasa la app a inglés
 * sin haber tocado el selector pasa a leer la WEB. Quien eligió una se queda
 * con ella hable la app lo que hable.
 */
export const resolveBibleVersion = (
  choice: BibleVersion | null,
  language: string | null | undefined,
): BibleVersion => choice ?? bibleVersionForLanguage(language);
