import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import { requireUserId } from "@/core/auth/requireUserId";
import { qk } from "@/core/query/keys";
export const NOTE_MAX = 2000;

export type ChapterMarks = {
  /** Versículos subrayados de este capítulo. */
  highlighted: number[];
  /** La nota de cada versículo, si la hay. */
  notes: Record<number, string>;
};

/**
 * Lo que has dejado marcado en este capítulo.
 *
 * Una sola lectura por capítulo y no una por versículo: Salmos 119 tiene 176, y
 * 176 consultas para pintar una pantalla sería una forma cara de subrayar.
 *
 * Lo que subrayas no lo ve nadie, y lo que escribes al margen menos todavía:
 * las dos tablas son de dueño único y las policies no mencionan a nadie más.
 */
export const useChapterMarks = (
  userId: string | undefined,
  bookId: number | undefined,
  chapter: number | undefined,
) =>
  useQuery({
    queryKey: qk.chapterMarks(userId, bookId, chapter),
    enabled: Boolean(userId && bookId && chapter),
    queryFn: async (): Promise<ChapterMarks> => {
      const [{ data: highlights, error }, { data: notes, error: notesError }] =
        await Promise.all([
          supabase
            .from("bible_highlights")
            .select("verse")
            .eq("book_id", bookId!)
            .eq("chapter", chapter!),
          supabase
            .from("bible_notes")
            .select("verse, body")
            .eq("book_id", bookId!)
            .eq("chapter", chapter!),
        ]);

      if (error) throw error;
      if (notesError) throw notesError;

      return {
        highlighted: ((highlights ?? []) as { verse: number }[]).map(
          (row) => row.verse,
        ),
        notes: Object.fromEntries(
          ((notes ?? []) as { verse: number; body: string }[]).map((row) => [
            row.verse,
            row.body,
          ]),
        ),
      };
    },
  });

/**
 * Subrayar es poner y quitar, no editar.
 *
 * La clave primaria compuesta es la que hace que esto sea seguro sin consultar
 * antes: subrayar dos veces el mismo versículo borra, y no hay estado que
 * pueda desincronizarse entre la comprobación y la escritura.
 */
export const useToggleHighlight = (
  userId: string | undefined,
  bookId: number | undefined,
  chapter: number | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { verse: number; on: boolean }) => {
      if (input.on) {
        const { error } = await supabase.from("bible_highlights").insert({
          user_id: requireUserId(userId),
          book_id: bookId!,
          chapter: chapter!,
          verse: input.verse,
        });

        // Subrayar algo ya subrayado no es un fallo: es que ya estaba.
        if (error && error.code !== "23505") throw error;
        return;
      }

      const { error } = await supabase
        .from("bible_highlights")
        .delete()
        .eq("book_id", bookId!)
        .eq("chapter", chapter!)
        .eq("verse", input.verse);

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.chapterMarks(userId, bookId, chapter),
      });
    },
  });
};

/** Una nota por versículo, que se edita — como el margen de un libro. */
export const useSaveNote = (
  userId: string | undefined,
  bookId: number | undefined,
  chapter: number | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { verse: number; body: string }) => {
      const body = input.body.trim().slice(0, NOTE_MAX);

      if (!body) {
        const { error } = await supabase
          .from("bible_notes")
          .delete()
          .eq("book_id", bookId!)
          .eq("chapter", chapter!)
          .eq("verse", input.verse);

        if (error) throw error;
        return;
      }

      // `upsert` sobre la única clave: guardar una nota que ya existía la
      // reemplaza en vez de fallar, que es lo que hace un margen.
      const { error } = await supabase.from("bible_notes").upsert(
        {
          user_id: requireUserId(userId),
          book_id: bookId!,
          chapter: chapter!,
          verse: input.verse,
          body,
        },
        { onConflict: "user_id,book_id,chapter,verse" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.chapterMarks(userId, bookId, chapter),
      });
    },
  });
};
