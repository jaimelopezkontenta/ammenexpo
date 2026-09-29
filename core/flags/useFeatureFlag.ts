import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/core/auth/SessionProvider";
import { qk } from "@/core/query/keys";
import { supabase } from "@/utils/supabase";

import { type FlagState, toFlagState } from "./flagState";

// Un flag lo mueve una persona desde una consola, no cambia mientras alguien
// lee: cinco minutos son de sobra para no preguntarlo en cada pantalla y lo
// bastante cortos para que abrir la comunidad no tarde un día en notarse.
const FLAG_STALE_MS = 5 * 60_000;

/**
 * ¿Está encendido este flag? Lo dice el servidor (`public.flag_enabled`).
 *
 * Hasta aquí el cliente no conocía `community_feed`: con el flag apagado el
 * servidor devuelve conjuntos vacíos, y la comunidad enseñaba «Todavía no hay
 * nada aquí. Sé la primera en pedir oración» — un vacío genérico que invita a
 * escribir en un sitio cerrado.
 *
 * **Sin `userId` en la clave**: el flag es de la instalación, no de la
 * persona; con el id cada cuenta pediría y cachearía lo mismo por separado.
 * Solo necesita sesión para poder preguntar (la RPC es de `authenticated`).
 *
 * Devuelve `unknown` mientras carga y si la lectura falla — ver `FlagState`.
 */
export const useFeatureFlag = (key: string): FlagState => {
  const { session } = useSession();

  const { data } = useQuery({
    queryKey: qk.featureFlag(key),
    enabled: Boolean(session),
    staleTime: FLAG_STALE_MS,
    queryFn: async (): Promise<boolean | null> => {
      const { data: enabled, error } = await supabase.rpc("flag_enabled", {
        p_key: key,
      });

      if (error) throw error;

      return enabled;
    },
  });

  return toFlagState(data);
};
