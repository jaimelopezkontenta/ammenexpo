/**
 * Las versiones de la Biblia que la base conoce (`bible_versions`).
 *
 * `rvr1909` (Reina-Valera 1909) y `web` (World English Bible) son de dominio
 * público. Cada versículo de `bible_verses` lleva su versión: una lectura que no
 * la pide recibe las dos superpuestas, así que TODA consulta directa a la tabla
 * tiene que filtrarla. Las RPC (`search_bible`, `locate_reference`,
 * `verse_of_the_day`, `resolve_scripture`) ya la toman como `p_version` y, sin
 * ella, responden en `rvr1909`.
 */
export const BIBLE_VERSIONS = ["rvr1909", "web"] as const;

export type BibleVersion = (typeof BIBLE_VERSIONS)[number];

export const DEFAULT_BIBLE_VERSION: BibleVersion = "rvr1909";

/** La versión por defecto de un idioma de la interfaz (`bible_versions.is_default`). */
export const bibleVersionForLanguage = (
  language: string | null | undefined,
): BibleVersion =>
  language?.toLowerCase().startsWith("en") ? "web" : "rvr1909";
