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
 * páginas desplaza todo y repites o te saltas contenido. El cursor es la fecha
 * de la última fila que ya tienes: lo nuevo aparece arriba y no descoloca lo de
 * abajo.
 *
 * `select` aplana las páginas, así que quien consume estos hooks sigue viendo
 * un array plano en `data` — las pantallas que ya existían no cambian una línea
 * y solo las que quieran «ver más» miran `fetchNextPage`.
 */
export const PAGE_SIZE = 30;
/**
 * Devuelve el cursor para la siguiente página: `undefined` cuando la página está
 * incompleta (no hay más filas) o el `created_at` de la última fila si cabe otra.
 *
 * Una página corta significa que no hay más. Pedir otra para descubrir que
 * está vacía es un viaje de más en la pantalla que más se abre.
 */
export const nextPageCursor = <T extends { created_at: string }>(
  page: T[],
): string | undefined =>
  page.length < PAGE_SIZE
    ? undefined
    : (page[page.length - 1]?.created_at ?? undefined);

/**
 * Aplana un array de páginas y deduplica las filas conservando el orden y la
 * primera aparición.
 *
 * El feed une tres fuentes en una sola lista y el cursor es `created_at <`
 * estricto, así que dos filas con el mismo sello de tiempo podrían repetirse al
 * cruzar de página. Deduplicar es más barato que confiar en que los relojes no
 * empaten.
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

export const usePagedQuery = <T extends { created_at: string }>(input: {
  queryKey: unknown[];
  enabled?: boolean;
  fetchPage: (before: string | null) => Promise<T[]>;
  /** Cómo se identifica una fila para deduplicar (ver flattenUnique). */
  keyOf?: (row: T) => string;
}) =>
  useInfiniteQuery({
    queryKey: input.queryKey,
    enabled: input.enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => input.fetchPage(pageParam),
    getNextPageParam: nextPageCursor,
    select: (data) => flattenUnique(data.pages, input.keyOf),
  });
