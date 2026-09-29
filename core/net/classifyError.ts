/**
 * ¿Es un error de red o uno cualquiera?
 *
 * `ErrorState` distinguía «sin conexión» de «algo salió mal» mirando
 * `navigator.onLine`, que en nativo no existe: el mensaje de red no salía
 * nunca en el teléfono, que es justo donde más se pierde la conexión.
 *
 * Y no sirve `isNetworkError` (core/plans/offline.ts): trata como red todo lo
 * que no trae un código de Postgres, incluidos los `new Error("xxx_no_rows")`
 * del propio cliente y cualquier TypeError de render. Para decidir qué texto
 * enseñar hace falta mirar el mensaje.
 */

export type ErrorKind = "network" | "generic";

// Lo que dicen los fetch de cada plataforma cuando no hay red: Chrome/Node
// («Failed to fetch»), React Native («Network request failed»), Firefox
// («NetworkError when attempting to fetch resource») y Safari («Load failed»,
// «The Internet connection appears to be offline»).
const NETWORK_MESSAGE =
  /failed to fetch|network request failed|networkerror|load failed|internet connection appears to be offline|err_internet_disconnected/i;

const messageOf = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const { message, details } = error as {
      message?: unknown;
      details?: unknown;
    };
    // PostgREST envuelve el fetch caído en un error sin código cuyo mensaje o
    // detalle es el TypeError original.
    return [message, details]
      .filter((part): part is string => typeof part === "string")
      .join(" ");
  }
  return "";
};

export const classifyError = (
  error: unknown,
  isOnline: boolean = true,
): ErrorKind => {
  if (!isOnline) return "network";
  return NETWORK_MESSAGE.test(messageOf(error)) ? "network" : "generic";
};
