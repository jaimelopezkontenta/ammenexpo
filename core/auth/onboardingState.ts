import { TERMS_VERSION } from "../legal/documents";

/**
 * Lo que la fila de ajustes dice sobre quien acaba de entrar.
 *
 * `missing` es el caso raro y el que más daño hacía: hay sesión, pero no hay
 * fila. `handle_new_user()` la escribe en el mismo trigger que el perfil, así
 * que toda cuenta real tiene la suya; que falte significa que el token apunta a
 * un usuario que ya no existe —una cuenta borrada, una base restaurada— y el
 * cliente todavía se lo cree.
 */
export type OnboardingRead =
  | { missing: true }
  | { missing: false; onboarded: boolean; termsVersion: string | null };

export type GateState = {
  /** Null mientras no se sabe: enrutar antes enseñaría la pantalla equivocada. */
  hasOnboarded: boolean | null;
  termsAccepted: boolean | null;
  /** Lleva a la pantalla de error, que es la única que ofrece cerrar sesión. */
  failed: boolean;
};

/**
 * De lo que devuelve la lectura, a lo que decide la puerta.
 *
 * **La fila que falta es un dato y no una excepción.** Antes se lanzaba un
 * error para que la puerta lo viera como fallo, y eso ataba la salida a que el
 * estado de error de la consulta llegara: si se quedaba reintentando, o si la
 * caché se limpiaba por medio, no llegaba nunca y la app se quedaba en la
 * pantalla de arranque **para siempre**, sin la salida de cerrar sesión que
 * todo lo demás sí ofrece. Reintentar además no arregla nada: una cuenta
 * borrada no vuelve al cuarto intento.
 *
 * Un fallo de red sí sigue siendo un error, porque ese sí se reintenta.
 */
export const gateStateFrom = (input: {
  userId: string | null;
  read: OnboardingRead | undefined;
  readFailed: boolean;
}): GateState => {
  if (!input.userId) {
    return { hasOnboarded: null, termsAccepted: null, failed: false };
  }

  if (input.readFailed || input.read?.missing === true) {
    return { hasOnboarded: null, termsAccepted: null, failed: true };
  }

  if (!input.read) {
    return { hasOnboarded: null, termsAccepted: null, failed: false };
  }

  return {
    hasOnboarded: input.read.onboarded,
    // La versión y no un booleano: el día que el texto cambie de forma
    // importante hay que volver a preguntar, y un `true` no sabe de qué texto
    // venía.
    termsAccepted: input.read.termsVersion === TERMS_VERSION,
    failed: false,
  };
};
