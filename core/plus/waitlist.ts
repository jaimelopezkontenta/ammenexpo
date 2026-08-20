import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Import relativo y no `@/utils/supabase` a propósito: es el mismo patrón que
// `core/plans/offline.ts`, y deja que el test mockee el módulo con `vi.mock`
// sin que Vitest tenga que resolver el alias `@/` (que no está configurado en
// `vitest.config.ts`).
import { supabase } from "../../utils/supabase";

/** Una fila de la lista de espera. Una por usuario. */
export type WaitlistEntry = {
  user_id: string;
  name: string;
  email: string;
  created_at: string;
};

export type WaitlistFieldError = "name" | "email" | null;

/**
 * Validación mínima en el cliente, antes de tocar la red: un nombre que no sea
 * espacio en blanco y un correo que al menos lleve `@`. El servidor tiene su
 * propio CHECK sobre `name`; esto solo evita mandar basura y poder decirlo sin
 * esperar el round-trip. El correo no se valida con la expresión completa del
 * alta: aquí basta `@`, que es lo que pide el contrato.
 */
export const waitlistInputError = (
  name: string,
  email: string,
): WaitlistFieldError => {
  if (name.trim().length === 0) return "name";
  if (!email.includes("@")) return "email";
  return null;
};

/**
 * La entrada de la lista de espera de quien está mirando, si ya se apuntó.
 * `maybeSingle` porque `user_id` es la clave: hay cero o una fila propia.
 */
export const useMyWaitlistEntry = (userId: string | undefined) =>
  useQuery({
    queryKey: ["plusWaitlist", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<WaitlistEntry | null> => {
      const { data, error } = await supabase
        .from("plus_waitlist")
        .select("user_id, name, email, created_at")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) throw error;

      return (data as WaitlistEntry | null) ?? null;
    },
  });

/**
 * Se apunta (o se re-apunta) a la lista de espera. Un upsert sobre `user_id`:
 * volver a apuntarse reescribe la fila en vez de fallar. Si aun así llega un
 * unique_violation —otra petición ganó la carrera— es exactamente el mismo
 * resultado, y no un fallo.
 */
export const useJoinWaitlist = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; email: string }) => {
      const { error } = await supabase.from("plus_waitlist").upsert(
        {
          user_id: userId!,
          name: input.name.trim(),
          email: input.email.trim(),
        },
        { onConflict: "user_id" },
      );

      // 23505 = unique_violation. El upsert ya la absorbe, pero entre dos
      // dispositivos a la vez puede colarse una carrera; el resultado —estás en
      // la lista— es el mismo, así que no se reporta como error.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["plusWaitlist", userId],
      });
    },
  });
};
