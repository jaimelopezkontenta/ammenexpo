/**
 * Sin `projectId` de EAS no hay token de Expo Push que pedir. Llamar a
 * `getExpoPushTokenAsync` en debug lanza y el nativo de FCM escribe un
 * error que tapa la UI. Este helper es puro a propósito: `push.ts` importa
 * el runtime nativo y no se puede probar desde Vitest.
 */
export const canRegisterRemotePush = (
  projectId: string | undefined,
): projectId is string => typeof projectId === "string" && projectId.length > 0;
