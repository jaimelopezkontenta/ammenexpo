import { useInfiniteQuery } from "@tanstack/react-query";

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

export const usePagedQuery = <T extends PagedRow>(input: {
  queryKey: readonly unknown[];
  enabled?: boolean;
  fetchPage: (cursor: PageCursor | null) => Promise<T[]>;
  /** Cómo se identifica una fila para deduplicar (ver flattenUnique). */
  keyOf?: (row: T) => string;
  /** El cursor de una fila, si no basta con `(created_at, id)`. */
  cursorOf?: (row: T) => PageCursor;
}) =>
  useInfiniteQuery({
    queryKey: input.queryKey,
    enabled: input.enabled,
    initialPageParam: null as PageCursor | null,
    queryFn: ({ pageParam }) => input.fetchPage(pageParam),
    getNextPageParam: (lastPage) => nextPageCursor(lastPage, input.cursorOf),
    select: (data) => flattenUnique(data.pages, input.keyOf),
  });
