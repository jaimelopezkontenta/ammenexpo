/**
 * La sesión de Supabase, en el llavero del sistema y no en un fichero plano.
 *
 * Hasta aquí vivía en AsyncStorage: un SQLite/JSON sin cifrar dentro de la
 * app. El refresh token que hay dentro basta para ser esa persona, y esta app
 * guarda oraciones —dato de creencias—, así que en nativo pasa a
 * `expo-secure-store` (Keychain en iOS, Keystore en Android).
 *
 * **Lógica pura, a propósito.** Este módulo no importa `expo-secure-store` ni
 * AsyncStorage: los recibe por parámetro (`utils/supabase.ts` pone el
 * pegamento). Así se prueba en Vitest con almacenes falsos, igual que
 * `core/notifications/resolveTarget.ts` frente a `push.ts`.
 *
 * Tres cosas que SecureStore no hace solo y que se resuelven aquí:
 *
 * 1. **Tamaño.** Aconseja no pasar de 2048 bytes por valor, y una sesión
 *    (JWT + usuario con sus identidades) pesa varias veces eso. Se trocea en
 *    piezas de ≤1800 bytes UTF-8 bajo `<clave>.<ranura>.<n>`, con un
 *    manifiesto (`<clave>.manifest`) que es lo último que se escribe: hasta
 *    que el manifiesto cambia, el valor anterior sigue entero. Hay dos
 *    ranuras (`a`/`b`) y cada escritura va a la que el manifiesto NO señala,
 *    así un corte a mitad nunca deja trozos viejos mezclados con nuevos.
 * 2. **Claves.** Solo admite `[A-Za-z0-9._-]`; cualquier otra se sanea.
 * 3. **Fallos.** Si el llavero lanza (Keystore roto, iOS antes del primer
 *    desbloqueo…), se degrada a AsyncStorage, que es lo de siempre: nunca se
 *    pierde una sesión por culpa de esto, y la de antes de este cambio se
 *    migra sola la primera vez que se lee.
 */

/** Lo que se usa de `expo-secure-store` (ya con sus opciones aplicadas). */
export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** Lo que se usa de AsyncStorage: el almacén de antes y el de reserva. */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type StorageOperation =
  "read" | "write" | "remove" | "migrate" | "cleanup";

/** Bytes UTF-8 por trozo: margen de sobra bajo el aviso de 2048 de SecureStore. */
export const CHUNK_BYTES = 1800;

/**
 * Tope de trozos por valor (~115 KB). Una sesión real ocupa 2–6 KB; lo que
 * pase de aquí no es una sesión y no tiene sentido en el llavero —se guarda
 * en AsyncStorage como antes, en vez de fallar—.
 */
export const MAX_CHUNKS = 64;

const SLOTS = ["a", "b"] as const;
type Slot = (typeof SLOTS)[number];

type Manifest = {
  v: 1;
  /** Ranura donde están los trozos vigentes. */
  s: Slot;
  /** Número de trozos. */
  n: number;
  /** Longitud del valor (unidades UTF-16), para validar al leer. */
  l: number;
  /** FNV-1a del valor, para validar al leer. */
  h: string;
};

const VALID_KEY = /^[A-Za-z0-9._-]+$/;

/** FNV-1a de 32 bits en hex: no es criptográfico, solo detecta trozos cruzados. */
export const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

/**
 * La clave tal cual si SecureStore la admite; si no, saneada y con un hash
 * de la original, para que `a:b` y `a;b` no acaben en la misma entrada.
 */
export const secureKeyFor = (key: string): string => {
  if (VALID_KEY.test(key)) return key;

  const cleaned = key.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100);

  return `${cleaned || "_"}.${fnv1a(key)}`;
};

const manifestKey = (base: string) => `${base}.manifest`;
const chunkKey = (base: string, slot: Slot, index: number) =>
  `${base}.${slot}.${index}`;

const utf8Size = (codePoint: number): number => {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
};

/**
 * Trocea por bytes UTF-8 y nunca por la mitad de un carácter: un nombre con
 * tildes o un emoji en los metadatos del usuario no puede partir un trozo en
 * una secuencia inválida. Un valor vacío son cero trozos.
 */
export const splitIntoChunks = (
  value: string,
  maxBytes: number = CHUNK_BYTES,
): string[] => {
  const chunks: string[] = [];
  let current = "";
  let bytes = 0;

  for (const char of value) {
    const size = utf8Size(char.codePointAt(0) ?? 0);

    if (bytes + size > maxBytes && current) {
      chunks.push(current);
      current = "";
      bytes = 0;
    }

    current += char;
    bytes += size;
  }

  if (current) chunks.push(current);

  return chunks;
};

class ValueTooLargeError extends Error {
  constructor() {
    super("secure_storage_value_too_large");
  }
}

/**
 * Los trozos que irían al llavero, o `null` si el valor no cabe. Mira la
 * longitud antes de recorrerlo: un valor de un mega no se trocea para
 * descubrir al final que sobraba.
 */
const chunksFor = (value: string): string[] | null => {
  if (value.length > MAX_CHUNKS * CHUNK_BYTES) return null;

  const chunks = splitIntoChunks(value);

  return chunks.length > MAX_CHUNKS ? null : chunks;
};

const parseManifest = (raw: string): Manifest | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<Manifest> | null;

    if (
      parsed &&
      parsed.v === 1 &&
      (parsed.s === "a" || parsed.s === "b") &&
      Number.isInteger(parsed.n) &&
      (parsed.n as number) >= 0 &&
      (parsed.n as number) <= MAX_CHUNKS &&
      Number.isInteger(parsed.l) &&
      typeof parsed.h === "string"
    ) {
      return parsed as Manifest;
    }
  } catch {
    // Un manifiesto que no es JSON es un manifiesto corrupto, sin más.
  }

  return null;
};

type SecureRead =
  | { status: "found"; value: string }
  | { status: "empty" }
  | { status: "corrupt" };

/**
 * El manejo de trozos, sin política de reservas: todo lo que lanza el
 * llavero sale tal cual, y quien llama decide cómo degradar.
 */
const createChunkedStore = (secure: SecureStoreLike) => {
  const read = async (base: string): Promise<SecureRead> => {
    const raw = await secure.getItemAsync(manifestKey(base));

    if (raw === null) return { status: "empty" };

    const manifest = parseManifest(raw);

    if (!manifest) return { status: "corrupt" };

    const parts = await Promise.all(
      Array.from({ length: manifest.n }, (_, index) =>
        secure.getItemAsync(chunkKey(base, manifest.s, index)),
      ),
    );

    if (parts.some((part) => part === null)) return { status: "corrupt" };

    const value = parts.join("");

    if (value.length !== manifest.l || fnv1a(value) !== manifest.h) {
      return { status: "corrupt" };
    }

    return { status: "found", value };
  };

  /**
   * Borra los trozos de una ranura. Como no se pueden listar claves, primero
   * se cuentan leyendo desde `from` hasta el primer hueco, y luego se borran
   * de atrás adelante: si algo corta el borrado, lo que queda sigue siendo
   * contiguo y el próximo barrido lo encuentra.
   */
  const purgeSlot = async (base: string, slot: Slot, from = 0) => {
    let end = from;

    while (
      end < MAX_CHUNKS &&
      (await secure.getItemAsync(chunkKey(base, slot, end))) !== null
    ) {
      end += 1;
    }

    for (let index = end - 1; index >= from; index -= 1) {
      await secure.deleteItemAsync(chunkKey(base, slot, index));
    }
  };

  const readManifestQuietly = async (
    base: string,
  ): Promise<Manifest | null> => {
    const raw = await secure.getItemAsync(manifestKey(base));

    return raw === null ? null : parseManifest(raw);
  };

  /**
   * Escribe en la ranura libre y cambia el manifiesto al final. Devuelve la
   * limpieza pendiente por separado: si falla, el valor ya está guardado y
   * no hay que tratarlo como una escritura fallida.
   */
  const write = async (
    base: string,
    chunks: string[],
    value: string,
  ): Promise<() => Promise<void>> => {
    const current = await readManifestQuietly(base);
    const slot: Slot = current?.s === "a" ? "b" : "a";

    for (const [index, chunk] of chunks.entries()) {
      await secure.setItemAsync(chunkKey(base, slot, index), chunk);
    }

    const manifest: Manifest = {
      v: 1,
      s: slot,
      n: chunks.length,
      l: value.length,
      h: fnv1a(value),
    };

    await secure.setItemAsync(manifestKey(base), JSON.stringify(manifest));

    return async () => {
      // La ranura anterior entera, y lo que un corte anterior pudiera haber
      // dejado en esta más allá de los trozos de ahora.
      await purgeSlot(base, slot === "a" ? "b" : "a");
      await purgeSlot(base, slot, chunks.length);
    };
  };

  /** El manifiesto primero: en cuanto se borra, el valor deja de existir. */
  const remove = async (base: string) => {
    await secure.deleteItemAsync(manifestKey(base));

    for (const slot of SLOTS) {
      await purgeSlot(base, slot);
    }
  };

  return { read, write, remove };
};

/**
 * Cola por clave: dos escrituras de la misma clave a la vez (auth-js no usa
 * lock por defecto) mezclarían trozos de las dos en la misma ranura.
 */
const createKeyedQueue = () => {
  const tails = new Map<string, Promise<unknown>>();

  return <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.catch(() => undefined);

    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });

    return run;
  };
};

export type SecureSessionStorageOptions = {
  secure: SecureStoreLike;
  /** AsyncStorage: donde vivía la sesión y a donde se vuelve si el llavero falla. */
  legacy: KeyValueStorage;
  /**
   * Para dejar constancia de una degradación. Recibe el error original: quien
   * lo conecte a un reporter debe quitarle el mensaje (ADR 0004).
   */
  onError?: (error: unknown, operation: StorageOperation) => void;
};

/**
 * El adaptador `SupportedStorage` que recibe `createClient` en nativo.
 *
 * Guarda en memoria lo último leído o escrito por clave. auth-js lee la
 * sesión del almacén en cada `getSession()` —es decir, en cada petición—, y
 * leer cuatro entradas del llavero por petición se notaría en Android. Es
 * coherente porque este adaptador es el único que escribe esas claves en
 * este proceso. Lo que viene de una lectura fallida del llavero no se
 * guarda: la siguiente vuelve a intentarlo.
 */
export const createSecureSessionStorage = ({
  secure,
  legacy,
  onError,
}: SecureSessionStorageOptions): KeyValueStorage => {
  const store = createChunkedStore(secure);
  const serialize = createKeyedQueue();
  const cache = new Map<string, string | null>();

  const report = (error: unknown, operation: StorageOperation) => {
    try {
      onError?.(error, operation);
    } catch {
      // Un reporter roto no puede tumbar la sesión.
    }
  };

  const bestEffort = async (
    operation: StorageOperation,
    task: () => Promise<void>,
  ) => {
    try {
      await task();
    } catch (error) {
      report(error, operation);
    }
  };

  const readThrough = async (key: string): Promise<string | null> => {
    const base = secureKeyFor(key);
    let result: SecureRead;

    try {
      // Un reintento: en algunos Android el Keystore falla una vez y a la
      // siguiente responde, y no leer aquí es arrancar sin sesión.
      result = await store.read(base).catch(() => store.read(base));
    } catch (error) {
      // El llavero no está disponible ahora mismo: se lee lo de siempre y no
      // se cachea, para volver a intentarlo en la próxima lectura.
      report(error, "read");
      return legacy.getItem(key);
    }

    if (result.status === "found") {
      cache.set(key, result.value);
      return result.value;
    }

    if (result.status === "corrupt") {
      report(new Error("secure_storage_corrupt"), "read");
      await bestEffort("cleanup", () => store.remove(base));
    }

    // Nada utilizable en el llavero: quizá una sesión de antes de este
    // cambio, o una que se guardó en la reserva porque el llavero falló.
    const legacyValue = await legacy.getItem(key);

    if (legacyValue !== null) {
      const chunks = chunksFor(legacyValue);

      if (chunks) {
        try {
          const cleanup = await store.write(base, chunks, legacyValue);

          await bestEffort("cleanup", cleanup);
          // Solo se borra el original cuando la copia ya está entera.
          await bestEffort("migrate", () => legacy.removeItem(key));
        } catch (error) {
          report(error, "migrate");
        }
      }
    }

    cache.set(key, legacyValue);
    return legacyValue;
  };

  return {
    getItem: (key) =>
      serialize(key, async () =>
        cache.has(key) ? (cache.get(key) ?? null) : readThrough(key),
      ),

    setItem: (key, value) =>
      serialize(key, async () => {
        const base = secureKeyFor(key);

        try {
          const chunks = chunksFor(value);

          if (!chunks) throw new ValueTooLargeError();

          const cleanup = await store.write(base, chunks, value);

          await bestEffort("cleanup", cleanup);
          // Una copia vieja en AsyncStorage (de antes de migrar, o de una
          // reserva) ya no pinta nada y va sin cifrar.
          await bestEffort("cleanup", () => legacy.removeItem(key));
        } catch (error) {
          report(error, "write");

          try {
            await legacy.setItem(key, value);
          } catch (legacyError) {
            // Ni llavero ni reserva: no se sabe qué quedó guardado.
            cache.delete(key);
            throw legacyError;
          }

          // Lo que hubiera en el llavero es más viejo que esto y, si se
          // quedara, se leería antes que la reserva.
          await bestEffort("cleanup", () => store.remove(base));
        }

        cache.set(key, value);
      }),

    removeItem: (key) =>
      serialize(key, async () => {
        cache.delete(key);

        // Nunca lanza por el llavero: auth-js borra dentro de `signOut` y de
        // la carga de la sesión, y un error ahí deja la app a medio cerrar
        // sesión. El manifiesto se borra lo primero, y borrar no cifra nada
        // (en Android es quitar una preferencia), así que que falle es lo
        // más improbable de todo; si pasa, queda anotado.
        await bestEffort("remove", () => store.remove(secureKeyFor(key)));
        await legacy.removeItem(key);

        cache.set(key, null);
      }),
  };
};
