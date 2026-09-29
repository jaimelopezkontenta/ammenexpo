/**
 * Volver a tener red cuenta como volver a mirar.
 *
 * En web React Query ya escucha `online`/`offline` de la ventana; en nativo
 * no hay ventana y se creía conectado siempre: sin red, las queries fallaban
 * y reintentaban contra la nada, y al volver la cobertura nada se refrescaba
 * hasta el siguiente foco. Con NetInfo, sin red las queries se pausan en vez
 * de fallar y al recuperarla se reanudan solas (`refetchOnReconnect`).
 *
 * Puro a propósito: NetInfo y `onlineManager` llegan por parámetro, así que
 * esto se prueba sin el módulo nativo (Vitest no puede cargar
 * `react-native`). El pegamento son dos líneas en `app/_layout.tsx`.
 */

/** Lo que se lee del estado de NetInfo. */
export type NetInfoStateLike = {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
};

export type NetInfoLike = {
  addEventListener(listener: (state: NetInfoStateLike) => void): () => void;
};

export type OnlineManagerLike = {
  setEventListener(
    setup: (setOnline: (online: boolean) => void) => (() => void) | undefined,
  ): void;
  setOnline(online: boolean): void;
};

/**
 * Solo un «no» explícito es estar sin red. `null` es «aún no lo sé» —NetInfo
 * lo da al arrancar y mientras comprueba el acceso a internet— y tratarlo
 * como desconexión pausaría todas las queries del arranque por nada.
 */
export const isOnlineState = (state: NetInfoStateLike): boolean =>
  state.isConnected !== false && state.isInternetReachable !== false;

/**
 * Engancha NetInfo a `onlineManager` y devuelve cómo desengancharlo. En web
 * no hace nada (allí ya se encarga React Query). Si NetInfo no responde, se
 * queda como antes: siempre en línea.
 */
export const wireOnlineManager = (
  netInfo: NetInfoLike,
  onlineManager: OnlineManagerLike,
  platform?: string,
): (() => void) => {
  if (platform === "web") return () => {};

  let unsubscribe: (() => void) | undefined;

  onlineManager.setEventListener((setOnline) => {
    try {
      unsubscribe = netInfo.addEventListener((state) => {
        setOnline(isOnlineState(state));
      });
    } catch {
      unsubscribe = undefined;
    }

    return unsubscribe;
  });

  return () => {
    unsubscribe?.();
    unsubscribe = undefined;
    // Desenganchado, nadie avisaría de que la red volvió: mejor en línea
    // que pausado para siempre.
    onlineManager.setOnline(true);
  };
};
