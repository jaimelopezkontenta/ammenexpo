/**
 * Adónde ibas antes de que te pidieran entrar.
 *
 * `AuthGate` mandaba a `/entrar` a quien abría sin sesión un enlace de correo,
 * un aviso o un círculo, y después del login lo dejaba en Hoy: el sitio al
 * que iba se perdía. Esto lo recuerda en memoria del proceso (si recargas,
 * vuelves a `/`, como antes) y solo acepta rutas de la propia app.
 *
 * **No es un destino lo que dejas al irte a propósito, ni lo que dejó otro.**
 * Quien cerraba sesión desde Perfil dejaba `/perfil` recordado, y la siguiente
 * persona que entraba en ese teléfono aterrizaba ahí. Por eso:
 *
 * - `forgetReturnToOnSignOut()` (el «Cerrar sesión» de verdad) lo borra y no
 *   deja recordar la pantalla que se está abandonando, hasta que la puerta
 *   llega a la pantalla de entrar (`resumeReturnTo()`) o entra alguien.
 * - Lo que se recuerda lleva dueño: quien tenía la sesión que se perdió (un
 *   token caducado te devuelve adonde estabas) o nadie (un enlace abierto sin
 *   haber entrado). Si entra otra persona, `noteSessionUser()` lo olvida.
 */

type Pending = { path: string; owner: string | null };

let pending: Pending | null = null;
// Quién tenía la última sesión: el dueño de lo que se recuerde al perderla.
let lastUser: string | null = null;
// Tras un cierre de sesión deliberado, la pantalla que se deja no es destino.
let muted = false;

// Las pantallas de entrar y del alta no son un destino: son el camino.
const NOT_A_DESTINATION =
  /^\/(entrar|crear-cuenta|recuperar|nueva-contrasena|bienvenida|aceptar)(\/|$)/;

export const isSafeReturnTo = (path: unknown): path is string =>
  typeof path === "string" &&
  path.startsWith("/") &&
  // `//host` es un enlace a otro sitio, no una ruta de la app.
  !path.startsWith("//") &&
  path !== "/" &&
  !NOT_A_DESTINATION.test(path);

export const rememberReturnTo = (path: string) => {
  if (muted) return;
  if (isSafeReturnTo(path)) pending = { path, owner: lastUser };
};

export const peekReturnTo = (): string | null => pending?.path ?? null;

export const clearReturnTo = () => {
  pending = null;
};

/**
 * `SessionProvider`, en cada cambio de sesión. Sin sesión no cambia el dueño:
 * a quien le caduca el token se le devuelve adonde estaba. Con sesión, lo que
 * dejó otra persona se olvida.
 */
export const noteSessionUser = (userId: string | null) => {
  if (userId === null) return;
  if (pending && pending.owner !== null && pending.owner !== userId) {
    pending = null;
  }
  lastUser = userId;
  muted = false;
};

/** El «Cerrar sesión» deliberado: el teléfono ya no es de nadie. */
export const forgetReturnToOnSignOut = () => {
  pending = null;
  lastUser = null;
  muted = true;
};

/**
 * Ya en la pantalla de entrar: lo que se abra desde aquí (un enlace, un
 * aviso) vuelve a recordarse.
 */
export const resumeReturnTo = () => {
  muted = false;
};

/** Solo para los tests: el estado del módulo vuelve a cero. */
export const resetReturnToForTests = () => {
  pending = null;
  lastUser = null;
  muted = false;
};
