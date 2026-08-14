/**
 * Una clave de request derivada, distinta y estable, para el primer tramo de un
 * plan nuevo.
 *
 * El `request_id` es **una** clave de idempotencia con UNIQUE global, y una
 * misma operación lógica ("crear plan") necesita dos claves distintas:
 *
 *   1. la **reserva** (`reserve_generation`), que usa el `request_id` que mandó
 *      el cliente y escribe una fila `scope = 'personal'|'circle'`;
 *   2. el **primer tramo** (`claim_generation_chunk`), que escribe (al
 *      resolverse) una fila `scope = 'continuation'` — y NO puede reusar el
 *      `request_id` de la reserva, porque el UNIQUE global las haría chocar.
 *
 * Si el primer tramo se reclamara con un UUID nuevo al azar, un reintento de la
 * misma alta (mismo `request_id` de cliente) reservaría idempotente pero
 * reclamaría un tramo NUEVO cada vez — generando dos veces, o avanzando el plan
 * de más. Derivar la clave del tramo de forma determinista a partir del
 * `request_id` de la reserva hace que el reintento de la misma operación caiga
 * en el mismo tramo (`already`) en vez de generar otro.
 *
 * La derivación es UUIDv5 (SHA-1) sobre un namespace fijo: determinista,
 * collision-safe, y siempre distinta del `request_id` de origen.
 */

/** Namespace fijo para "el primer tramo de una reserva de generación". */
const CHUNK_NAMESPACE_UUID = "6a4e1d9c-7b2f-4e6a-9c3d-1f8b5e2a7d0c";

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
};

const HEX: string[] = [];

for (let i = 0; i < 256; i++) {
  HEX.push((i + 0x100).toString(16).slice(1));
}

const bytesToUuid = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes, (b) => HEX[b]).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * Deriva el `request_id` del primer tramo a partir del `request_id` de la
 * reserva. Determinista: el mismo `reservationRequestId` produce siempre la
 * misma clave. Distinta del origen, y de cualquier otra reserva.
 */
export const deriveChunkRequestId = async (
  reservationRequestId: string,
): Promise<string> => {
  const namespace = hexToBytes(CHUNK_NAMESPACE_UUID.replace(/-/g, ""));
  const name = hexToBytes(reservationRequestId.replace(/-/g, ""));

  const data = new Uint8Array(namespace.length + name.length);
  data.set(namespace, 0);
  data.set(name, namespace.length);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", data));

  // RFC 4122 §4.3: UUIDv5 keeps the first 16 octets of the SHA-1 digest.
  const bytes = digest.slice(0, 16);

  // Versión 5 y variante RFC 4122, igual que haría uuid_generate_v5.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
};
