/**
 * Adónde ibas antes de que te pidieran entrar.
 *
 * `AuthGate` mandaba a `/entrar` a quien abría sin sesión un enlace de correo,
 * un aviso o un círculo, y después del login lo dejaba en Hoy: el sitio al
 * que iba se perdía. Esto lo recuerda en memoria del proceso (si recargas,
 * vuelves a `/`, como antes) y solo acepta rutas de la propia app.
 */

let pending: string | null = null;

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
  if (isSafeReturnTo(path)) pending = path;
};

export const peekReturnTo = (): string | null => pending;

export const clearReturnTo = () => {
  pending = null;
};
