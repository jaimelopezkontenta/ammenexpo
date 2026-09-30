import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import { requireUserId } from "@/core/auth/requireUserId";
import { qk } from "@/core/query/keys";
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
    queryKey: qk.inviteCode(userId),
    enabled: Boolean(userId),
    // Ya no es «para siempre»: se puede renovar (`useRotateMyInviteCode`), y
    // desde otro dispositivo la caché de este no se entera. Con el refresco por
    // defecto, volver a la pantalla trae el que vale.
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("invites")
        .select("code")
        .eq("inviter_id", requireUserId(userId))
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
        .insert({ inviter_id: requireUserId(userId) })
        .select("code")
        .single();

      if (error) throw error;

      return (data as { code: string }).code;
    },
    onSuccess: (code) => {
      queryClient.setQueryData(qk.inviteCode(userId), code);
    },
  });
};

/**
 * Renovar el código personal, para cuando el enlace ha llegado a donde no
 * debía.
 *
 * El viejo deja de canjearse en el acto (todos los de esta persona, si un
 * doble toque dejó dos); lo que ya se hizo con él —quién entró, a quién
 * sigue— se queda. La RPC devuelve el que enseña `useMyInviteCode` (el más
 * antiguo) y va directo a su caché.
 */
export const useRotateMyInviteCode = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      // La RPC usa la sesión, no este id; pero sin él no hay caché que
      // actualizar y la pantalla seguiría enseñando el código muerto.
      requireUserId(userId);

      const { data, error } = await supabase.rpc("rotate_my_invite_code");

      if (error) throw error;

      return data;
    },
    onSuccess: (code) => {
      queryClient.setQueryData(qk.inviteCode(userId), code);
    },
  });
};

/** De quién es el enlace, para quien todavía no tiene cuenta. */
export const useInvitePreview = (code: string | undefined) =>
  useQuery({
    queryKey: qk.invitePreview(code),
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
