import type { PrayerRequest } from "@/core/posts/queries";
import {
  feedEntryKey,
  type FeedEntry,
  type PersonSearchResult,
} from "@/core/social/feed";

/**
 * Lo que pinta la lista de Comunidad: personas mientras se busca, el feed si
 * no. Una sola `FlatList` para las dos cosas, porque el buscador va en su
 * cabecera: con dos listas, empezar a escribir cambiaba de lista, desmontaba
 * el campo y se llevaba el teclado.
 */
export type CommunityRow = PersonSearchResult | FeedEntry;

/** Una persona no tiene `kind`; toda fila del feed sí. */
export const isPerson = (row: CommunityRow): row is PersonSearchResult =>
  !("kind" in row);

/** La `key` de una fila: la del feed ya es la pareja `kind-id`. */
export const communityRowKey = (row: CommunityRow): string =>
  isPerson(row) ? `person-${row.id}` : feedEntryKey(row);

/**
 * Una petición del feed, con la forma que pide `PrayerRequestCard` — la misma
 * tarjeta del muro, con reportar, bloquear, marcar respondida y borrar. Campo
 * a campo y no un spread: el feed trae más de lo que la tarjeta necesita, y
 * `body` puede venir nulo.
 */
export const toPrayerRequest = (entry: FeedEntry): PrayerRequest => ({
  id: entry.id,
  body: entry.body ?? "",
  is_anonymous: entry.is_anonymous,
  author_id: entry.author_id,
  author_name: entry.author_name,
  author_avatar_url: entry.author_avatar_url,
  prayer_count: entry.prayer_count,
  comment_count: entry.comment_count,
  answered_at: entry.answered_at,
  held_at: entry.held_at,
  crisis_flagged_at: entry.crisis_flagged_at,
  created_at: entry.created_at,
  i_prayed: entry.i_prayed,
  is_mine: entry.is_mine,
});
