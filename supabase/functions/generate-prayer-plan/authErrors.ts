/**
 * ¿El fallo de `auth.getUser()` es del SERVICIO de auth y no de la sesión?
 *
 * `getUser()` devuelve `{ user: null, error }` tanto cuando el JWT no vale (un
 * `AuthApiError` con el status del rechazo: 401/403) como cuando el servicio no
 * contesta (un `AuthRetryableFetchError`, con status 0 si ni hubo respuesta o
 * un 5xx). Contestar 401 a lo segundo le dice a la app que la sesión murió, y
 * la app cierra la sesión de alguien cuya sesión está bien.
 *
 * Lo que no se reconoce cuenta como sesión inválida (401): es el lado que
 * pide volver a entrar en vez de reintentar a ciegas.
 */
export const isTransientAuthError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as { status?: unknown; name?: unknown };

  if (candidate.name === "AuthRetryableFetchError") return true;

  return (
    typeof candidate.status === "number" &&
    (candidate.status === 0 || candidate.status >= 500)
  );
};
