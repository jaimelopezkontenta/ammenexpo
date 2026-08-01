import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

/**
 * Seguir a alguien.
 *
 * Sustituye a un modelo de amigos que llevaba en el esquema desde la Fase 1 sin
 * una sola pantalla: `friendships`, con su enum, sus policies y su
 * `are_friends()`, escrita en silencio cada vez que alguien canjeaba un enlace.
 * Aquello pedía aceptar y rechazar; esto no pide nada — sigues, y ya está.
 *
 * Sin RPC: la tabla se escribe directamente y la policy decide, igual que
 * `blocks`. Lo que sí hace falta es acordarse de que **cero filas es como RLS
 * rechaza una escritura**, sin error y sin nada que se note.
 */

const invalidateFollowSurfaces = (
  queryClient: ReturnType<typeof useQueryClient>,
  targetId: string,
) => {
  // El perfil de esa persona (el botón y su contador de seguidores) y el tuyo
  // (el de "siguiendo"). Nada en esta app refresca al enfocar, así que una
  // invalidación que falta se queda mal hasta que se mata la app.
  void queryClient.invalidateQueries({ queryKey: ["publicProfile", targetId] });
  void queryClient.invalidateQueries({ queryKey: ["publicProfile"] });
  void queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; targetId: string }) => {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: input.userId, followee_id: input.targetId });

      if (error) throw error;
    },
    onSuccess: (_data, input) =>
      invalidateFollowSurfaces(queryClient, input.targetId),
  });
};

export const useUnfollowUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; targetId: string }) => {
      const { data, error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", input.userId)
        .eq("followee_id", input.targetId)
        .select("followee_id");

      if (error) throw error;

      // PostgREST devuelve 204 sin error cuando RLS filtra todas las filas de
      // un DELETE, así que sin esto "dejar de seguir" diría que sí y no habría
      // hecho nada.
      if (!data?.length) throw new Error("unfollow_no_rows");
    },
    onSuccess: (_data, input) =>
      invalidateFollowSurfaces(queryClient, input.targetId),
  });
};
