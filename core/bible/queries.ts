import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import type { BibleBook } from "./navigation";

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
export const useBibleBooks = () =>
  useQuery({
    queryKey: ["bibleBooks"],
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

/** One chapter, in verse order. Immutable, so it is cached forever. */
export const useChapter = (
  bookId: number | undefined,
  chapter: number | undefined,
) =>
  useQuery({
    queryKey: ["bibleChapter", bookId, chapter],
    enabled: Boolean(bookId) && Boolean(chapter),
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<Verse[]> => {
      const { data, error } = await supabase
        .from("bible_verses")
        .select("verse, text")
        .eq("book_id", bookId!)
        .eq("chapter", chapter!)
        .order("verse");

      if (error) throw error;

      return (data ?? []) as Verse[];
    },
  });

export const useBibleSearch = (query: string) =>
  useQuery({
    queryKey: ["bibleSearch", query],
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
    queryKey: ["bibleReference", query],
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
    queryKey: ["readingPosition", userId],
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
      queryClient.setQueryData<ReadingPosition>(["readingPosition", userId], {
        last_read_book_id: position.bookId,
        last_read_chapter: position.chapter,
        last_read_verse: position.verse,
      });
    },
  });
};
