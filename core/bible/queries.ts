import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import { useSession } from "@/core/auth/SessionProvider";
import { msUntilLocalMidnight } from "@/core/time/midnight";

import type { BibleBook } from "./navigation";
import { useBibleVersion } from "./useBibleVersion";
import { type BibleVersion, DEFAULT_BIBLE_VERSION } from "./versions";

import { requireUserId } from "@/core/auth/requireUserId";
import { qk } from "@/core/query/keys";
export type Verse = {
  verse: number;
  text: string;
};

export type SearchHit = {
  book_id: number;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
  total_count: number;
};

export type ReadingPosition = {
  last_read_book_id: number | null;
  last_read_chapter: number | null;
  last_read_verse: number | null;
};

/** Below this a search is mostly noise, and every keystroke would be a query. */
export const MIN_SEARCH_LENGTH = 3;

/**
 * The 66 books, with how many chapters each has.
 *
 * Fetched once and never refetched: this is a fixed public-domain translation
 * loaded by migration. The chapter grid needs no query of its own because it
 * reads chapter_count from here.
 *
 * Trae los dos nombres de cada libro y no depende de la versión: cambiar de
 * Biblia no vuelve a pedir la lista, solo cambia cuál se enseña (`bookLabel`).
 */
export const useBibleBooks = () => {
  const { session } = useSession();

  return useQuery({
    queryKey: qk.bibleBooks.root,
    // Estas lecturas no aportan nada en el login y el 401 asusta en consola:
    // no se disparan sin sesión.
    enabled: Boolean(session),
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<BibleBook[]> => {
      const { data, error } = await supabase
        .from("bible_books")
        .select("id, modern_name, name_en, new_testament, chapter_count")
        .order("id");

      if (error) throw error;

      return (data ?? []) as BibleBook[];
    },
  });
};

/**
 * Qué enseñar mientras llega un capítulo: el mismo capítulo en la otra versión,
 * si era lo que había en pantalla. Al cambiar de Biblia la pantalla pasaba por
 * el spinner y volvía arriba del todo; así el texto se sustituye en su sitio.
 * Solo entre versiones del mismo capítulo: al pasar de capítulo, enseñar el
 * anterior bajo el título del siguiente sería mentir.
 */
export const chapterPlaceholder = <T>(
  previous: T | undefined,
  previousKey: readonly unknown[] | undefined,
  bookId: number | undefined,
  chapter: number | undefined,
): T | undefined =>
  previousKey?.[0] === "bibleChapter" &&
  previousKey[2] === bookId &&
  previousKey[3] === chapter
    ? previous
    : undefined;

/**
 * One chapter, in verse order. Immutable, so it is cached forever.
 *
 * Lee la tabla directamente, así que filtra la versión: `bible_verses` guarda
 * cada versículo una vez por versión y sin el filtro llegarían las dos juntas.
 *
 * `enabled` es para esperar a saber qué versión se lee (`useBibleVersion`
 * con `ready` a false): una lectura con la versión supuesta podía pintar un
 * instante la otra Biblia.
 */
export const useChapter = (
  bookId: number | undefined,
  chapter: number | undefined,
  version: BibleVersion = DEFAULT_BIBLE_VERSION,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: qk.bibleChapter(version, bookId, chapter),
    enabled: enabled && Boolean(bookId) && Boolean(chapter),
    staleTime: Infinity,
    gcTime: Infinity,
    placeholderData: (previous, previousQuery) =>
      chapterPlaceholder(previous, previousQuery?.queryKey, bookId, chapter),
    queryFn: async (): Promise<Verse[]> => {
      const { data, error } = await supabase
        .from("bible_verses")
        .select("verse, text")
        .eq("version", version)
        .eq("book_id", bookId!)
        .eq("chapter", chapter!)
        .order("verse");

      if (error) throw error;

      return (data ?? []) as Verse[];
    },
  });

/**
 * La búsqueda, en la versión que se lee: «love» no está en la RVR, y en la WEB
 * la base lematiza en inglés. La versión va en la clave para que cambiar de
 * Biblia no enseñe los resultados de la otra.
 */
export const useBibleSearch = (query: string, version: BibleVersion) =>
  useQuery({
    queryKey: qk.bibleSearch(version, query),
    enabled: query.trim().length >= MIN_SEARCH_LENGTH,
    // Keeping the previous page on screen while the next loads stops the list
    // flashing empty on every keystroke.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchHit[]> => {
      const { data, error } = await supabase.rpc("search_bible", {
        p_query: query.trim(),
        p_version: version,
      });

      if (error) throw error;

      return (data ?? []) as SearchHit[];
    },
  });

/**
 * Whether what was typed is a reference rather than words to search for, so
 * "Juan 3" offers to go there instead of hunting for the word "Juan".
 *
 * El nombre se entiende en los dos idiomas con cualquier versión, pero el
 * versículo tiene que existir en la que se lee (Romanos 14:24 está en la WEB y
 * no en la RVR): por eso la versión va en la llamada y en la clave.
 */
export const useReferenceJump = (query: string, version: BibleVersion) =>
  useQuery({
    queryKey: qk.bibleReference(version, query),
    enabled: query.trim().length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("locate_reference", {
        p_ref: query.trim(),
        p_version: version,
      });

      if (error) throw error;

      const rows = (data ?? []) as {
        book_id: number;
        chapter: number;
        verse: number;
      }[];

      return rows[0] ?? null;
    },
  });

export const useReadingPosition = (userId: string | undefined) =>
  useQuery({
    queryKey: qk.readingPosition(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ReadingPosition | null> => {
      const { data, error } = await supabase
        .from("profile_settings")
        .select("last_read_book_id, last_read_chapter, last_read_verse")
        .eq("id", requireUserId(userId))
        .maybeSingle();

      if (error) throw error;

      return data as ReadingPosition | null;
    },
  });

/**
 * Records where someone stopped reading.
 *
 * Writes the cache directly rather than invalidating: the Biblia tab should
 * show the new position without a refetch, and the value we just sent is
 * exactly what the server now holds.
 */
export const useSaveReadingPosition = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (position: {
      bookId: number;
      chapter: number;
      verse: number;
    }) => {
      const { error } = await supabase
        .from("profile_settings")
        .update({
          last_read_book_id: position.bookId,
          last_read_chapter: position.chapter,
          last_read_verse: position.verse,
          last_read_at: new Date().toISOString(),
        })
        .eq("id", requireUserId(userId));

      if (error) throw error;

      return position;
    },
    onSuccess: (position) => {
      queryClient.setQueryData<ReadingPosition>(qk.readingPosition(userId), {
        last_read_book_id: position.bookId,
        last_read_chapter: position.chapter,
        last_read_verse: position.verse,
      });
    },
  });
};

export type DailyVerse = {
  book_id: number;
  book_name: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
};

/**
 * Cuánto dura fresco el versículo del día: hasta la medianoche local **del
 * día en que se leyó**, no la de hoy.
 *
 * `staleTime: msUntilLocalMidnight()` se calculaba al pintar: una pantalla
 * que se pintaba a las 8:00 con el versículo leído anoche a las 23:00 le daba
 * dieciséis horas más desde las 23:00, y el de ayer seguía «fresco» hasta
 * media tarde. Con la función, React Query lo mide desde `dataUpdatedAt`.
 */
export const verseOfTheDayStaleTime = (dataUpdatedAt: number): number =>
  msUntilLocalMidnight(new Date(dataUpdatedAt));

/**
 * El versículo del día.
 *
 * Sin plan activo, la app no tenía nada que darte: abrías y te decía que no
 * tienes plan. Esto es lo más barato que hay en este proyecto —los 31.102
 * versículos llevan en la base desde la Fase 3 sirviendo solo para verificar
 * referencias— y no depende de nada más.
 *
 * Es **el mismo para todo el mundo el mismo día**, que es lo que permite hablar
 * de él y lo que hace que no cambie si abres la app dos veces. Por eso no
 * caduca en todo el día — pero sí a medianoche: con `staleTime: Infinity`, el
 * de ayer seguía ahí por la mañana si la app no se había cerrado.
 */
export const useVerseOfTheDay = () => {
  const { session } = useSession();
  // La misma referencia para todo el mundo ese día, con su texto en la versión
  // que se lee. Hasta que se sabe cuál es no se pide: pedirla en la de por
  // defecto y luego en la otra pintaría un instante el versículo en el idioma
  // equivocado.
  const { version, ready } = useBibleVersion();

  return useQuery({
    queryKey: qk.verseOfTheDay(version),
    // Estas lecturas no aportan nada en el login y el 401 asusta en consola:
    // no se disparan sin sesión.
    enabled: Boolean(session) && ready,
    staleTime: (query) => verseOfTheDayStaleTime(query.state.dataUpdatedAt),
    queryFn: async (): Promise<DailyVerse | null> => {
      const { data, error } = await supabase.rpc("verse_of_the_day", {
        p_version: version,
      });

      if (error) throw error;

      return ((data ?? []) as DailyVerse[])[0] ?? null;
    },
  });
};
