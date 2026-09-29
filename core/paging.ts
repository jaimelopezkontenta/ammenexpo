import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Una lista que continúa.
 *
 * Hasta aquí ninguna lista de esta app paginaba: `home_feed` aceptaba
 * `p_before` desde que existe y **el cliente nunca lo pasaba**, y los avisos ni
 * lo ofrecían. Treinta filas y hasta ahí; a los dos meses de uso, lo de hace
 * tres semanas era inalcanzable.
 *
 * **Cursor y no `offset`.** Con `offset`, una fila nueva escrita entre dos
 * páginas desplaza todo y repites o te saltas contenido. El cursor es la última
 * fila que ya tienes: lo nuevo aparece arriba y no descoloca lo de abajo.
 *
 * **Cursor compuesto, `(created_at, id)`.** Con solo la fecha, dos filas en el
 * mismo instante a caballo entre dos páginas se perdían o se repetían; las RPC
 * `*_page` comparan la pareja y el orden es total.
 *
 * `select` aplana las páginas, así que quien consume estos hooks sigue viendo
 * un array plano en `data` — las pantallas que ya existían no cambian una línea
 * y solo las que quieran «ver más» miran `fetchNextPage`.
 */
export const PAGE_SIZE = 30;

/**
 * Dónde sigue la lista: la fecha y el id de la última fila, y su clase en el
 * feed que mezcla fuentes (`home_feed_page` desempata también por `kind`).
 */
export type PageCursor = { created_at: string; id: string; kind?: string };

type PagedRow = { created_at: string; id: string };

const rowCursor = (row: PagedRow): PageCursor => ({
  created_at: row.created_at,
  id: row.id,
});

/**
 * Devuelve el cursor para la siguiente página: `undefined` cuando la página está
 * incompleta (no hay más filas) o la última fila si cabe otra.
 *
 * Una página corta significa que no hay más. Pedir otra para descubrir que
 * está vacía es un viaje de más en la pantalla que más se abre.
 */
export const nextPageCursor = <T extends PagedRow>(
  page: T[],
  cursorOf: (row: T) => PageCursor = rowCursor,
): PageCursor | undefined => {
  if (page.length < PAGE_SIZE) return undefined;
  const last = page[page.length - 1];
  return last ? cursorOf(last) : undefined;
};

/**
 * Aplana un array de páginas y deduplica las filas conservando el orden y la
 * primera aparición.
 *
 * Con el cursor compuesto no debería repetirse nada; se deduplica igual,
 * porque una fila editada o recién escrita entre dos páginas no puede acabar
 * dos veces en pantalla.
 */
export const flattenUnique = <T>(
  pages: T[][],
  keyOf?: (row: T) => string,
): T[] => {
  const seen = new Set<string>();
  const rows: T[] = [];

  for (const row of pages.flat()) {
    const key = keyOf ? keyOf(row) : JSON.stringify(row);

    if (seen.has(key)) continue;

    seen.add(key);
    rows.push(row);
  }

  return rows;
};

/** La clave de deduplicado de casi todas las listas: el id, que es único. */
export const rowId = (row: { id: string }): string => row.id;

export const usePagedQuery = <T extends PagedRow>(input: {
  queryKey: readonly unknown[];
  enabled?: boolean;
  fetchPage: (cursor: PageCursor | null) => Promise<T[]>;
  /**
   * Cómo se identifica una fila para deduplicar (ver flattenUnique). Mejor una
   * función de módulo que una flecha en línea: ver `select` abajo.
   */
  keyOf?: (row: T) => string;
  /** El cursor de una fila, si no basta con `(created_at, id)`. */
  cursorOf?: (row: T) => PageCursor;
}) => {
  const { keyOf } = input;

  // React Query solo memoriza `select` si es la misma función entre renders.
  // En línea se rehacía entera en cada render de la pantalla —aplanar todas
  // las páginas y compararlas fila a fila con las de antes—, y un feed se
  // re-renderiza por cada tecla del buscador o cada toque que marca `pending`.
  const select = useCallback(
    (data: InfiniteData<T[], PageCursor | null>) =>
      flattenUnique(data.pages, keyOf),
    [keyOf],
  );

  return useInfiniteQuery({
    queryKey: input.queryKey,
    enabled: input.enabled,
    initialPageParam: null as PageCursor | null,
    queryFn: ({ pageParam }) => input.fetchPage(pageParam),
    getNextPageParam: (lastPage) => nextPageCursor(lastPage, input.cursorOf),
    select,
  });
};

/**
 * A qué distancia del final se pide la página siguiente, en pantallas: media
 * pantalla antes de tocar fondo, para que la siguiente llegue antes que el dedo.
 */
export const END_REACHED_THRESHOLD = 0.5;

/** Si tiene sentido pedir otra página ahora mismo. */
export const shouldLoadMore = (state: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}): boolean => state.hasNextPage && !state.isFetchingNextPage;

/**
 * El `onEndReached` de una `FlatList` paginada.
 *
 * La lista lo dispara al acercarse al final, y puede dispararlo más de una vez
 * seguida: sin la guarda, cada disparo con una página ya en vuelo la cancelaba
 * y pedía otra. `cancelRefetch: false` por lo mismo: si hay un refresco de la
 * lista en curso (tras orar, bloquear…), no se corta para pedir la siguiente.
 *
 * El botón «Ver más» (`LoadMore`) se queda al pie igualmente: un lector de
 * pantalla o un teclado recorren la lista sin hacer scroll, y sin él no
 * llegarían nunca a la segunda página.
 */
export const useLoadMoreOnEnd = (query: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: (options?: { cancelRefetch?: boolean }) => Promise<unknown>;
}) => {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  return useCallback(() => {
    if (!shouldLoadMore({ hasNextPage, isFetchingNextPage })) return;
    void fetchNextPage({ cancelRefetch: false });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
};
