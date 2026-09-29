/**
 * Sin `projectId` de EAS no hay token de Expo Push que pedir. Llamar a
 * `getExpoPushTokenAsync` en debug lanza y el nativo de FCM escribe un
 * error que tapa la UI. Este helper es puro a propósito: `push.ts` importa
 * el runtime nativo y no se puede probar desde Vitest.
 */
export const canRegisterRemotePush = (
  projectId: string | undefined,
): projectId is string => typeof projectId === "string" && projectId.length > 0;

/**
 * Cada cuánto se vuelve a preguntar al sistema si deja avisar.
 *
 * El permiso solo cambia fuera de la app —en Ajustes o en el diálogo del
 * sistema, que también la manda al fondo—, así que lo que importa es volver a
 * primer plano, y eso refresca **siempre** (`"always"`), esté o no fresco:
 * con el `staleTime` de 30 s por defecto, quien lo activaba en Ajustes y
 * volvía en menos de medio minuto seguía viendo «desactivado». Montar Perfil
 * otra vez, en cambio, no pregunta de nuevo dentro de esos 30 s.
 */
export const PUSH_PERMISSION_REFRESH = {
  staleTime: 30_000,
  refetchOnWindowFocus: "always",
} as const;
