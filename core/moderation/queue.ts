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
    fetchPage: async (cursor) => {
      const { data, error } = await supabase.rpc("report_queue_page", {
        p_status: status,
        p_before: cursor?.created_at ?? null,
        p_before_id: cursor?.id ?? null,
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

/**
 * Ocultar lo reportado, desde el reporte.
 *
 * La cola usaba \`hide_post\`/\`hide_comment\`/\`hide_message\`, que son de admin
 * de círculo: el staff no podía ocultar nada de un círculo ajeno y nada del
 * muro abierto, que no tiene admin. \`hide_reported_content\` es de staff, parte
 * de un reporte abierto (no de un id cualquiera) y deja escrito quién ocultó.
 */
export const useHideReportedContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      const { data, error } = await supabase.rpc("hide_reported_content", {
        p_report_id: reportId,
      });

      if (error) throw error;
      if (data !== true) throw new Error("hide_reported_content_refused");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reportQueue"] });
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
      void queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
      void queryClient.invalidateQueries({ queryKey: ["postComments"] });
      void queryClient.invalidateQueries({ queryKey: ["circleMessages"] });
    },
  });
};

export type HoldStatus = "pending" | "claimed" | "released" | "removed";

export type HeldContent = {
  id: string;
  target_type: "post" | "comment";
  target_id: string;
  author_id: string;
  author_name: string;
  body: string | null;
  status: HoldStatus;
  claimed_by: string | null;
  claimed_by_name: string | null;
  reason: string | null;
  created_at: string;
};

/**
 * B1a: la cola de lo retenido automáticamente por el filtro — distinta de
 * `useReportQueue`, que es lo que alguien reporta a mano. Aquí no hay
 * reportero: el sistema lo retuvo solo, y alguien de staff decide si era un
 * falso positivo o no.
 */
export const useHeldContentQueue = (
  statuses: HoldStatus[] = ["pending", "claimed"],
) =>
  usePagedQuery<HeldContent>({
    queryKey: ["heldContentQueue", statuses.join(",")],
    keyOf: (row) => row.id,
    // Más antiguo primero y el cursor hacia delante: es la cola de un SLA. La
    // RPC vieja ordenaba así pero paginaba con `created_at <`, y la segunda
    // página volvía a pedir la primera — la cola no pasaba de 30.
    fetchPage: async (cursor) => {
      const { data, error } = await supabase.rpc("held_content_queue_page", {
        p_statuses: statuses,
        p_after: cursor?.created_at ?? null,
        p_after_id: cursor?.id ?? null,
        p_limit: PAGE_SIZE,
      });

      if (error) throw error;

      return (data ?? []) as HeldContent[];
    },
  });

const invalidateHoldQueue = (
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  void queryClient.invalidateQueries({ queryKey: ["heldContentQueue"] });
  void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
  void queryClient.invalidateQueries({ queryKey: ["homeFeed"] });
};

export const useClaimHold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (holdId: string) => {
      const { data, error } = await supabase.rpc("claim_hold", {
        p_hold_id: holdId,
      });

      if (error) throw error;
      if (data !== true) throw new Error("claim_hold_refused");
    },
    onSuccess: () => invalidateHoldQueue(queryClient),
  });
};

/** El falso positivo: libera, y vuelve a ser visible para todo el mundo. */
export const useReleaseHold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { holdId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("release_hold", {
        p_hold_id: input.holdId,
        p_reason: input.reason,
      });

      if (error) throw error;
      if (data !== true) throw new Error("release_hold_refused");
    },
    onSuccess: () => invalidateHoldQueue(queryClient),
  });
};

/** Lo abusivo: retira. Su autor sigue viéndolo como retenido, nunca como publicado. */
export const useRemoveHold = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { holdId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("remove_hold", {
        p_hold_id: input.holdId,
        p_reason: input.reason,
      });

      if (error) throw error;
      if (data !== true) throw new Error("remove_hold_refused");
    },
    onSuccess: () => invalidateHoldQueue(queryClient),
  });
};

export type CrisisEscalation = {
  id: string;
  target_type: "post" | "comment";
  target_id: string;
  author_id: string;
  author_name: string;
  body: string | null;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
};

/** El máximo que sirve `open_crisis_queue` por llamada. */
const CRISIS_PAGE = 50;
/** Un tope para no quedarse en bucle si la RPC cambiara de contrato. */
const CRISIS_MAX_PAGES = 40;

/**
 * B1b: crisis, en su propia cola, nunca mezclada con el filtro genérico.
 *
 * No pagina con `usePagedQuery`: es una cola de guardia, no un muro — se
 * espera que esté vacía casi siempre, y cuando no lo está, se quiere entera
 * en pantalla, no cargada "de 30 en 30". Por eso se recorren todas las
 * páginas de `open_crisis_queue` (solo lo abierto, lo más antiguo primero,
 * cursor compuesto): `crisis_queue` mezclaba abiertas y atendidas y cortaba en
 * 30, así que con historial una crisis abierta podía no salir nunca.
 */
export const useCrisisQueue = (userId: string | undefined) =>
  useQuery({
    queryKey: ["crisisQueue", userId],
    enabled: Boolean(userId),
    // El deber de guardia no espera a que alguien vuelva a abrir la pantalla.
    refetchInterval: 30_000,
    queryFn: async (): Promise<CrisisEscalation[]> => {
      const rows: CrisisEscalation[] = [];
      let after: CrisisEscalation | undefined;

      for (let page = 0; page < CRISIS_MAX_PAGES; page += 1) {
        const { data, error } = await supabase.rpc("open_crisis_queue", {
          p_after: after?.created_at ?? null,
          p_after_id: after?.id ?? null,
          p_limit: CRISIS_PAGE,
        });

        if (error) throw error;

        const batch = (data ?? []) as CrisisEscalation[];
        rows.push(...batch);
        if (batch.length < CRISIS_PAGE) break;
        after = batch[batch.length - 1];
      }

      return rows;
    },
  });

export const useAcknowledgeCrisis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { escalationId: string; note: string }) => {
      const { data, error } = await supabase.rpc("acknowledge_crisis", {
        p_id: input.escalationId,
        p_note: input.note,
      });

      if (error) throw error;
      if (data !== true) throw new Error("acknowledge_crisis_refused");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["crisisQueue"] });
    },
  });
};

export const useReportProfile = (userId: string | undefined) =>
  useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId!,
        target_type: "profile",
        target_id: profileId,
      });

      if (error) throw error;
    },
  });
