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
import { type BibleVersion, DEFAULT_BIBLE_VERSION } from "./versions";

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
        .select("id, modern_name, new_testament, chapter_count")
        .order("id");

      if (error) throw error;

      return (data ?? []) as BibleBook[];
    },
  });
};

/**
 * One chapter, in verse order. Immutable, so it is cached forever.
 *
 * Lee la tabla directamente, así que filtra la versión: `bible_verses` guarda
 * cada versículo una vez por versión y sin el filtro llegarían las dos juntas.
 */
export const useChapter = (
  bookId: number | undefined,
  chapter: number | undefined,
  version: BibleVersion = DEFAULT_BIBLE_VERSION,
) =>
  useQuery({
    queryKey: qk.bibleChapter(version, bookId, chapter),
    enabled: Boolean(bookId) && Boolean(chapter),
    staleTime: Infinity,
    gcTime: Infinity,
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

export const useBibleSearch = (query: string) =>
  useQuery({
    queryKey: qk.bibleSearch(query),
    enabled: query.trim().length >= MIN_SEARCH_LENGTH,
    // Keeping the previous page on screen while the next loads stops the list
    // flashing empty on every keystroke.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchHit[]> => {
      const { data, error } = await supabase.rpc("search_bible", {
        p_query: query.trim(),
      });

      if (error) throw error;

      return (data ?? []) as SearchHit[];
    },
  });

/**
 * Whether what was typed is a reference rather than words to search for, so
 * "Juan 3" offers to go there instead of hunting for the word "Juan".
 */
export const useReferenceJump = (query: string) =>
  useQuery({
    queryKey: qk.bibleReference(query),
    enabled: query.trim().length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("locate_reference", {
        p_ref: query.trim(),
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
        .eq("id", userId!)
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
        .eq("id", userId!);

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

  return useQuery({
    queryKey: qk.verseOfTheDay.root,
    // Estas lecturas no aportan nada en el login y el 401 asusta en consola:
    // no se disparan sin sesión.
    enabled: Boolean(session),
    staleTime: (query) => verseOfTheDayStaleTime(query.state.dataUpdatedAt),
    queryFn: async (): Promise<DailyVerse | null> => {
      const { data, error } = await supabase.rpc("verse_of_the_day");

      if (error) throw error;

      return ((data ?? []) as DailyVerse[])[0] ?? null;
    },
  });
};
