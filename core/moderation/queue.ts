import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PAGE_SIZE, usePagedQuery } from "@/core/paging";
import { supabase } from "@/utils/supabase";

export type ReportStatus = "open" | "reviewed" | "dismissed";

export type QueuedReport = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  status: ReportStatus;
  created_at: string;
  reporter_name: string;
  author_id: string | null;
  author_name: string | null;
  content: string | null;
  already_hidden: boolean;
};

/**
 * La cola de moderación.
 *
 * `reports` llevaba desde la Fase 1 siendo de solo escritura: se podía reportar
 * y **nadie** podía leer un reporte. La Guideline 1.2 exige actuar en 24 horas.
 *
 * Quien no es staff recibe cero filas — lo decide la RPC, no esta pantalla — así
 * que no hace falta esconder nada aquí para que sea seguro; se esconde solo para
 * que no haya una entrada que no lleva a ninguna parte.
 */
export const useReportQueue = (status: ReportStatus) =>
  usePagedQuery<QueuedReport>({
    queryKey: ["reportQueue", status],
    keyOf: (row) => row.id,
    fetchPage: async (before) => {
      const { data, error } = await supabase.rpc("report_queue", {
        p_status: status,
        p_before: before,
        p_limit: PAGE_SIZE,
      });

      if (error) throw error;

      return (data ?? []) as QueuedReport[];
    },
  });

export const useOpenReportCount = (userId: string | undefined) =>
  useQuery({
    queryKey: ["openReports", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("open_report_count");

      if (error) throw error;

      return (data ?? 0) as number;
    },
  });

export const useResolveReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      reportId: string;
      status: "reviewed" | "dismissed";
    }) => {
      const { data, error } = await supabase.rpc("resolve_report", {
        p_report_id: input.reportId,
        p_status: input.status,
      });

      if (error) throw error;

      // Contesta `false` en vez de lanzar cuando no eres staff o el id no
      // existe, así que ignorar el payload enseñaría un éxito sobre una
      // escritura que no ocurrió.
      if (data !== true) throw new Error("resolve_report_refused");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reportQueue"] });
      void queryClient.invalidateQueries({ queryKey: ["openReports"] });
    },
  });
};
