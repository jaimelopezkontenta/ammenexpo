import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PAGE_SIZE, usePagedQuery } from "@/core/paging";
import { supabase } from "@/utils/supabase";

import { qk } from "@/core/query/keys";
export type AppNotification = {
  id: string;
  type: string;
  payload: {
    intercessor_id?: string;
    intercessor_name?: string;
    plan_title?: string;
    plan_day_id?: string;
  };
  read_at: string | null;
  created_at: string;
};

/**
 * Los avisos, que llevaban desde la Fase 1 acumulándose sin lector.
 *
 * El trigger escribe una fila cada vez que alguien ora por ti — con su nombre y
 * el título del plan dentro del `payload`— y hasta aquí nadie los había leído
 * nunca. No hace falta push para esto: los datos ya estaban.
 *
 * Quien has bloqueado no llega: lo filtra la RPC, no esta pantalla.
 */
export const useNotifications = (userId: string | undefined) =>
  usePagedQuery<AppNotification>({
    queryKey: qk.notifications(userId),
    enabled: Boolean(userId),
    keyOf: (row) => row.id,
    fetchPage: async (cursor) => {
      const { data, error } = await supabase.rpc("my_notifications_page", {
        p_before: cursor?.created_at,
        p_before_id: cursor?.id,
        p_limit: PAGE_SIZE,
      });

      if (error) throw error;

      return (data ?? []) as AppNotification[];
    },
  });

/**
 * Cuántos sin leer, para el punto de la cabecera.
 *
 * `refetchInterval` porque nada en esta app refresca al enfocar y el aviso lo
 * escribe otra persona: sin esto, el punto solo aparecería al matar la app. Un
 * minuto es suficiente para algo que no corre prisa y no hace ruido.
 */
export const useUnreadNotifications = (userId: string | undefined) =>
  useQuery({
    queryKey: qk.unreadNotifications(userId),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("my_unread_notifications");

      if (error) throw error;

      return (data ?? 0) as number;
    },
  });

/** Idempotente: se llama al abrir la pantalla, y abrirla dos veces no es error. */
export const useMarkNotificationsRead = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_notifications_read");

      if (error) throw error;

      return (data ?? 0) as number;
    },
    onSuccess: (changed) => {
      // Solo si algo cambió: invalidar la lista al abrir una pantalla que
      // acaba de cargarla es un viaje de más en cada visita.
      if (changed > 0) {
        void queryClient.invalidateQueries({
          queryKey: qk.notifications(userId),
        });
      }

      void queryClient.invalidateQueries({
        queryKey: qk.unreadNotifications(userId),
      });
    },
  });
};
