/**
 * Quién puede invocar los drenajes de las colas (`send-email`,
 * `send-intercession-push`, `enqueue-emails`).
 *
 * Tres de ellos llevan `verify_jwt = false` y el cuarto se conforma con la
 * anon key, que es pública: lo único que los protege es el header
 * `x-ammen-invoker` contra un secreto compartido. Antes, sin secreto
 * configurado, el header no se exigía — un despliegue al que se le olvidara
 * el secreto quedaba abierto a cualquiera. Ahora eso solo vale en local.
 */

export type InvokerAuth = "ok" | "not_required" | "unauthorized";

/** Comparación en tiempo constante: no filtra por cuánto tarda en fallar. */
export const timingSafeEqualString = (left: string, right: string): boolean => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < len; i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return mismatch === 0;
};

/**
 * Hosts que solo existen en la máquina de quien desarrolla: Kong dentro de la
 * red de Docker de `supabase start`, el propio host y el alias de Docker Desktop.
 */
const LOCAL_HOSTS = new Set([
  "kong",
  "localhost",
  "127.0.0.1",
  "[::1]",
  "host.docker.internal",
]);

/**
 * Supabase remoto siempre sirve por https; el local, por http en uno de los
 * hosts de arriba. Se PARSEA la URL y se mira el host, no solo el esquema: con
 * `startsWith("http://")` un `http://ejemplo.com` (o un autoalojado con TLS
 * delante, que da `http://kong:8000` a las funciones) dejaba el invocador
 * abierto sin secreto. Sin URL, o con una que no se entiende, no se presume
 * nada: cuenta como remoto, que es el lado seguro.
 *
 * Un despliegue real que use `http://kong:8000` sigue contando como local:
 * ahí hay que configurar el secreto (con secreto, la URL no importa).
 */
export const isLocalSupabaseUrl = (url: string | undefined): boolean => {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
};

/**
 * `ok` si el header coincide con el secreto; `not_required` solo en local y
 * sin secreto configurado; `unauthorized` en cualquier otro caso — también
 * fuera de local sin secreto (fail-closed). Nunca devuelve ni registra el
 * secreto.
 */
export const authorizeInvoker = (
  header: string | null | undefined,
  secret: string | undefined,
  supabaseUrl: string | undefined,
): InvokerAuth => {
  const expected = secret?.trim() ?? "";

  if (!expected) {
    return isLocalSupabaseUrl(supabaseUrl) ? "not_required" : "unauthorized";
  }

  if (!timingSafeEqualString(header ?? "", expected)) {
    return "unauthorized";
  }

  return "ok";
};
