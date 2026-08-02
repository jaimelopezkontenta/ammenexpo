import { useMutation, useQueryClient } from "@tanstack/react-query";

import { TERMS_VERSION } from "@/core/legal/documents";
import { supabase } from "@/utils/supabase";

/**
 * Aceptar los términos.
 *
 * La fecha la pone el servidor dentro de `accept_terms`, no el cliente: con un
 * `update` desde el teléfono, la hora de la aceptación vendría del reloj de la
 * parte interesada, que es justo el dato que no puede venir de ahí.
 */
export const useAcceptTerms = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("accept_terms", {
        p_version: TERMS_VERSION,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // La consulta que mira la puerta de entrada. Sin invalidarla, aceptar
      // dejaría a alguien mirando la misma pantalla que acaba de despachar.
      void queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });
};
