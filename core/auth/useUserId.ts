import { useSession } from "./SessionProvider";

/**
 * El id de quien tiene la sesión, o `undefined` sin sesión.
 *
 * Treinta y tantas pantallas repetían `const { session } = useSession();
 * const userId = session?.user.id;` solo para esto. `undefined` y no `null`
 * porque es lo que esperan los hooks de datos (`useX(userId)` con
 * `enabled: Boolean(userId)`).
 */
export const useUserId = (): string | undefined => {
  const { session } = useSession();
  return session?.user.id;
};

/** Lo que lanza `useRequiredUserId` si no hay sesión. */
export class MissingSessionError extends Error {
  constructor() {
    super("useRequiredUserId necesita una sesión: úsalo dentro de AuthGate");
    this.name = "MissingSessionError";
  }
}

/**
 * Lo mismo, para pantallas que solo existen dentro de `AuthGate`: ahí no hay
 * render sin sesión (la puerta pinta el arranque o redirige a `/entrar` en su
 * lugar), así que un `undefined` sería un bug y se dice en voz alta en vez de
 * arrastrar un `userId!`. **No** vale para `(public)`, `/correo` ni
 * `/nueva-contrasena`, que la puerta deja pasar sin sesión.
 */
export const useRequiredUserId = (): string => {
  const userId = useUserId();
  if (!userId) throw new MissingSessionError();
  return userId;
};
