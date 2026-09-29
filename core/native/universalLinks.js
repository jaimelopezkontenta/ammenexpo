/**
 * Universal links (iOS) y App Links (Android), solo si hay dominio.
 *
 * CommonJS a propósito: lo lee `app.config.js` en Node al construir, no la
 * app. Vive aquí para poder probarlo (core/native/universalLinks.test.ts).
 *
 * **El dominio no está decidido** (2026-09-29): es decisión del dueño, igual
 * que publicar los ficheros de asociación que el dominio tiene que servir
 * (`docs/runbooks/native-release.md`). Sin `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`
 * esto no añade nada y el build queda exactamente como antes; declarar un
 * dominio que no sirve sus ficheros no rompe nada, pero en Android el
 * `autoVerify` fallaría y los enlaces abrirían el navegador.
 *
 * Solo los enlaces que se comparten para abrir algo concreto: `/p/` (plan
 * compartido) y `/c/` (invitación a un círculo). Con la barra final: en
 * Android `pathPrefix` es un prefijo literal, y `/p` a secas se llevaría
 * también `/persona`, `/peticiones` o `/plan`.
 */
const LINK_PATH_PREFIXES = ["/p/", "/c/"];

const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * El host limpio, o `null` si no hay. Perdona un `https://` o una barra
 * final; lo que siga sin ser un dominio para el build con un mensaje claro,
 * porque un binario con un dominio mal escrito no se arregla sin otra build.
 *
 * @param {string | undefined} raw
 * @returns {string | null}
 */
const normalizeLinkHost = (raw) => {
  const trimmed = (raw ?? "").trim();

  if (!trimmed) return null;

  const host = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();

  if (!HOSTNAME.test(host)) {
    throw new Error(
      `EXPO_PUBLIC_UNIVERSAL_LINK_HOST no es un dominio válido: "${raw}". ` +
        "Pon solo el host, por ejemplo ammen.app.",
    );
  }

  return host;
};

/**
 * Las claves de `ios` y `android` que añadir a la config de Expo.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{
 *   ios: { associatedDomains?: string[] },
 *   android: { intentFilters?: {
 *     action: string,
 *     autoVerify: boolean,
 *     data: { scheme: string, host: string, pathPrefix: string }[],
 *     category: string[],
 *   }[] },
 * }}
 */
const universalLinkConfig = (env) => {
  const host = normalizeLinkHost(env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST);

  if (!host) return { ios: {}, android: {} };

  return {
    ios: { associatedDomains: [`applinks:${host}`] },
    android: {
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: LINK_PATH_PREFIXES.map((pathPrefix) => ({
            scheme: "https",
            host,
            pathPrefix,
          })),
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
  };
};

module.exports = { LINK_PATH_PREFIXES, normalizeLinkHost, universalLinkConfig };
