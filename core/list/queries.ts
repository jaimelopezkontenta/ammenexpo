import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import { requireUserId } from "@/core/auth/requireUserId";
import { qk } from "@/core/query/keys";
export const ITEM_MAX = 280;
export const TAG_MAX = 40;

export type ListItem = {
  id: string;
  body: string;
  tag: string | null;
  answered_at: string | null;
  created_at: string;
};

/**
 * Tu lista de oración.
 *
 * El hueco más grande que tenía la app: solo existía el plan que escribe la IA,
 * y lo que la gente hace de verdad cada día es una lista de nombres.
 *
 * Sin paginación, a propósito: una lista de oración que necesita paginar ha
 * dejado de ser una lista de oración. El día que alguien llegue a doscientas,
 * el problema no será el scroll.
 */
export const usePrayerList = (userId: string | undefined) =>
  useQuery({
    queryKey: qk.prayerList(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ListItem[]> => {
      const { data, error } = await supabase
        .from("prayer_list_items")
        .select("id, body, tag, answered_at, created_at")
        // Lo pendiente arriba y lo respondido debajo: la lista se abre para
        // orar, no para repasar lo que ya pasó.
        .order("answered_at", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as ListItem[];
    },
  });

export const useAddListItem = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { body: string; tag?: string }) => {
      const body = input.body.trim().slice(0, ITEM_MAX);
      if (!body) return;

      const { error } = await supabase.from("prayer_list_items").insert({
        user_id: requireUserId(userId),
        body,
        tag: input.tag?.trim().slice(0, TAG_MAX) || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.prayerList(userId) });
    },
  });
};

/**
 * Marcar respondida, y poder deshacerlo.
 *
 * Lo segundo importa: alguien que toca la fila equivocada no puede quedarse sin
 * vuelta atrás en la pantalla donde apunta a su madre enferma.
 */
export const useSetItemAnswered = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; answered: boolean }) => {
      const { data, error } = await supabase
        .from("prayer_list_items")
        .update({
          answered_at: input.answered ? new Date().toISOString() : null,
        })
        .eq("id", input.id)
        .select("id");

      if (error) throw error;

      // Cero filas es como RLS rechaza un update: sin error y sin filas.
      if (!data?.length) throw new Error("list_update_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.prayerList(userId) });
    },
  });
};

export const useDeleteListItem = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("prayer_list_items")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;
      if (!data?.length) throw new Error("list_delete_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.prayerList(userId) });
    },
  });
};
