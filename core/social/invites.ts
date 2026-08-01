import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

/**
 * Invitar a alguien a Ammen.
 *
 * `invites` se podía canjear desde la Fase 1 y **nada insertaba una fila**, así
 * que no podía existir un código que canjear. Esta es la otra mitad.
 *
 * Un solo código por persona, reutilizable: `redeem_invite_code` marca quién lo
 * aceptó primero pero sigue funcionando después, para que un enlace que circula
 * por un grupo de WhatsApp no se apague con la primera persona.
 */
export const useMyInviteCode = (userId: string | undefined) =>
  useQuery({
    queryKey: ["inviteCode", userId],
    enabled: Boolean(userId),
    // El código no cambia nunca: pedirlo otra vez es un viaje regalado.
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("invites")
        .select("code")
        .eq("inviter_id", userId!)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return (data as { code: string } | null)?.code ?? null;
    },
  });

/**
 * Se crea al pedirlo, no al abrir la pantalla: navegar a un sitio no debería
 * escribir nada, y un código por cada visita curiosa es basura que nadie va a
 * limpiar.
 */
export const useCreateInviteCode = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from("invites")
        .insert({ inviter_id: userId! })
        .select("code")
        .single();

      if (error) throw error;

      return (data as { code: string }).code;
    },
    onSuccess: (code) => {
      queryClient.setQueryData(["inviteCode", userId], code);
    },
  });
};

/** De quién es el enlace, para quien todavía no tiene cuenta. */
export const useInvitePreview = (code: string | undefined) =>
  useQuery({
    queryKey: ["invitePreview", code],
    enabled: Boolean(code),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("get_invite_preview", {
        p_code: code!,
      });

      if (error) throw error;

      return (
        ((data ?? []) as { inviter_name: string }[])[0]?.inviter_name ?? null
      );
    },
  });
