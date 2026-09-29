/**
 * Las páginas del chat, sin red ni React: lo que se puede probar.
 *
 * El chat traía los últimos 50 mensajes y ni uno más: lo de la semana pasada
 * de un círculo con vida era inalcanzable. Ahora pagina hacia atrás, y el
 * problema pasa a ser la mezcla — páginas viejas que ya tienes, más lo que
 * llega por Realtime abajo — sin repetir, sin desordenar y sin huecos.
 */

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_url: string | null;
  body: string;
  created_at: string;
  is_mine: boolean;
};

/**
 * Una página, de más nuevo a más viejo, y si queda algo detrás.
 *
 * `more` va con la página y no se deduce de su tamaño: al mezclar lo nuevo con
 * lo que ya había se reparten las filas otra vez, y la última página puede
 * quedar corta sin que la conversación se haya acabado.
 */
export type MessagePage = { rows: ChatMessage[]; more: boolean };

/** Dónde sigue la conversación hacia atrás: el mensaje más viejo que tienes. */
export type MessageCursor = { created_at: string; id: string };

/** Lo mismo que traía la RPC `circle_messages` de una vez. */
export const MESSAGE_PAGE_SIZE = 50;

/** Mismo día en el calendario de quien mira (hora local, no UTC). */
export const sameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Qué lleva encima un mensaje en la lista invertida, donde el vecino de
 * índice+1 es el anterior en el tiempo: si es de otro día (o no hay), este
 * abre día y lleva el separador; si además es de otra persona (o abre día),
 * abre racha y lleva la cara y el nombre.
 */
export const bubbleOpenings = (
  message: Pick<ChatMessage, "created_at" | "sender_id">,
  older: Pick<ChatMessage, "created_at" | "sender_id"> | undefined,
): { opensDay: boolean; opensRun: boolean } => {
  const opensDay =
    !older ||
    !sameCalendarDay(new Date(older.created_at), new Date(message.created_at));

  return {
    opensDay,
    opensRun: opensDay || !older || older.sender_id !== message.sender_id,
  };
};

const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * Un `timestamptz` como (segundos, microsegundos).
 *
 * Ni `Date.parse` ni comparar cadenas: Postgres da microsegundos (JS solo
 * guarda milisegundos, y dos mensajes pueden caer en el mismo) y recorta los
 * ceros del final (`.1234` frente a `.12345`), así que ni el número ni el
 * texto ordenan bien por sí solos.
 */
export const instantOf = (iso: string): [seconds: number, micros: number] => {
  const match = ISO_INSTANT.exec(iso);

  if (!match) {
    const ms = Date.parse(iso);
    return [Math.floor(ms / 1000), (ms % 1000) * 1000];
  }

  const [, year, month, day, hour, minute, second, fraction = "", zone] = match;
  let seconds =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) / 1000;

  if (zone && zone !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    const offset =
      Number(digits.slice(0, 2)) * 3600 + Number(digits.slice(2, 4) || 0) * 60;
    seconds -= sign * offset;
  }

  return [seconds, Number(fraction.slice(0, 6).padEnd(6, "0"))];
};

/**
 * El orden del chat: de más nuevo a más viejo por `(created_at, id)`, el mismo
 * que la consulta (`order created_at desc, id desc`). Negativo si `a` va antes.
 */
export const compareNewestFirst = (
  a: Pick<ChatMessage, "created_at" | "id">,
  b: Pick<ChatMessage, "created_at" | "id">,
): number => {
  const [aSeconds, aMicros] = instantOf(a.created_at);
  const [bSeconds, bMicros] = instantOf(b.created_at);

  if (aSeconds !== bSeconds) return bSeconds - aSeconds;
  if (aMicros !== bMicros) return bMicros - aMicros;
  // Un uuid en minúsculas ordena como texto igual que Postgres lo ordena
  // como bytes.
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
};

export const messageCursor = (row: ChatMessage): MessageCursor => ({
  created_at: row.created_at,
  id: row.id,
});

/** El cursor de la página siguiente (más vieja), o `undefined` si no hay. */
export const nextMessageCursor = (
  page: MessagePage,
): MessageCursor | undefined => {
  const last = page.rows[page.rows.length - 1];
  return page.more && last ? messageCursor(last) : undefined;
};

/**
 * El filtro de «más viejo que el cursor» para `.or()` de PostgREST, con el
 * cursor compuesto: con solo la fecha, dos mensajes en el mismo instante a
 * caballo entre dos páginas se perdían o se repetían.
 */
export const olderThanFilter = ({ created_at, id }: MessageCursor): string =>
  `created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`;

/**
 * Lo que ya tienes, puesto al día con la página más nueva recién pedida.
 *
 * - **La página nueva manda en su tramo**: entre su primer y su último
 *   mensaje, lo que no venga en ella ya no se puede ver (lo ocultó quien
 *   administra, o bloqueaste a quien lo escribió) y se va.
 * - **Lo más nuevo que ella se conserva**: si dos respuestas llegan
 *   desordenadas, la vieja no borra lo que trajo la nueva.
 * - **Lo más viejo se conserva si empalma**: si lo que tienes llega hasta su
 *   tramo, sigue debajo tal cual, con sus páginas ya cargadas. Si no llega
 *   —entraron más mensajes de los que caben en una página— en medio puede
 *   faltar algo, y se descarta: vale más volver a pedirlo al subir que
 *   enseñar un hueco como si fuera continuo.
 * - Sin repetir: una fila está una vez, en su sitio.
 */
export const mergeMessages = (
  current: ChatMessage[],
  currentMore: boolean,
  head: MessagePage,
): { rows: ChatMessage[]; more: boolean } => {
  const newest = head.rows[0];
  const oldest = head.rows[head.rows.length - 1];

  if (!newest || !oldest) return { rows: [], more: false };

  const inHead = new Set(head.rows.map((row) => row.id));
  const newer = current.filter(
    (row) => !inHead.has(row.id) && compareNewestFirst(row, newest) < 0,
  );

  // La página no está llena: es la conversación entera hasta el principio, y
  // nada más viejo que ella se puede ver.
  if (!head.more) return { rows: [...newer, ...head.rows], more: false };

  const reaches = current.some((row) => compareNewestFirst(row, oldest) <= 0);
  if (!reaches) return { rows: [...newer, ...head.rows], more: true };

  const older = current.filter(
    (row) => !inHead.has(row.id) && compareNewestFirst(row, oldest) > 0,
  );

  return { rows: [...newer, ...head.rows, ...older], more: currentMore };
};

/**
 * Las filas, otra vez en páginas del tamaño de siempre, con sus cursores.
 * Así un refresco completo vuelve a pedir tantas páginas como filas hay en
 * pantalla, y «cargar más» sigue desde la última.
 */
export const paginateMessages = (
  rows: ChatMessage[],
  more: boolean,
  size: number = MESSAGE_PAGE_SIZE,
): { pages: MessagePage[]; pageParams: (MessageCursor | null)[] } => {
  const pages: MessagePage[] = [];

  for (let start = 0; start < rows.length; start += size) {
    pages.push({ rows: rows.slice(start, start + size), more: true });
  }

  if (pages.length === 0) pages.push({ rows: [], more });
  pages[pages.length - 1] = { ...pages[pages.length - 1]!, more };

  const pageParams = pages.map((_, index) => {
    const previous = pages[index - 1];
    const last = previous?.rows[previous.rows.length - 1];
    return last ? messageCursor(last) : null;
  });

  return { pages, pageParams };
};

/** La caché de React Query del chat, puesta al día con la página más nueva. */
export const withNewestPage = (
  data: { pages: MessagePage[] },
  head: MessagePage,
  size: number = MESSAGE_PAGE_SIZE,
) => {
  const current = data.pages.flatMap((page) => page.rows);
  const currentMore = data.pages[data.pages.length - 1]?.more ?? false;
  const merged = mergeMessages(current, currentMore, head);

  return paginateMessages(merged.rows, merged.more, size);
};

/** Todas las páginas en una lista, sin repetir: lo que pinta la pantalla. */
export const flattenMessages = (data: {
  pages: MessagePage[];
}): ChatMessage[] => {
  const seen = new Set<string>();
  const rows: ChatMessage[] = [];

  for (const page of data.pages) {
    for (const row of page.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }

  return rows;
};
