/**
 * Lo que lanza `requireUserId` cuando no hay nadie con sesión.
 *
 * `expected`: no es un fallo que reportar (`isExpectedError`,
 * core/observability/track.ts). Llega cuando una mutación sale justo después
 * de cerrar sesión, o una query sin `enabled` se cuela antes de que la sesión
 * cargue; la pantalla lo cuenta como cualquier error y no hay nada que
 * arreglar en el servidor. El olvido del `enabled` lo vigilan el tipo y el
 * lint, no el canal de errores.
 */
export class NotSignedInError extends Error {
  readonly expected = true;

  constructor() {
    super("not_signed_in");
    this.name = "NotSignedInError";
  }
}

/**
 * El id de quien tiene la sesión, para usarlo dentro de un `queryFn` o un
 * `mutationFn`.
 *
 * Había ~50 `userId!`: funcionaban porque la query llevaba
 * `enabled: Boolean(userId)` o la pantalla ya había comprobado la sesión,
 * pero un olvido convertía la aserción en un `undefined` que viajaba a
 * Supabase: un `.eq` contra `"undefined"`, un insert al que le falta la
 * columna, una RPC que pierde el argumento. Volvía como un error de la base
 * que no decía qué había pasado. Aquí se dice antes de construir la
 * petición. El `enabled` se queda: esto es la red, no el sustituto. ESLint
 * prohíbe el `userId!` en `app/`, `components/` y `core/`.
 *
 * No confundir con `useRequiredUserId` (useUserId.ts), que es para el render
 * de pantallas que solo existen dentro de `AuthGate`.
 */
export const requireUserId = (userId: string | null | undefined): string => {
  if (!userId) throw new NotSignedInError();
  return userId;
};
