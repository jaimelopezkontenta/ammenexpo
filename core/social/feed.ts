import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/utils/supabase";

export type FeedKind = "request" | "testimony" | "plan";

export type FeedEntry = {
  kind: FeedKind;
  id: string;
  body: string | null;
  title: string | null;
  /**
   * Se adivinaba por un `author_id` nulo —cierto, pero indirecto— y la tarjeta
   * del muro lo pide por su nombre. Igual que `answered_at`, que no llegaba
   * aquí de ninguna forma.
   */
  is_anonymous: boolean;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  prayer_count: number;
  comment_count: number;
  answered_at: string | null;
  created_at: string;
  i_prayed: boolean;
  is_mine: boolean;
};

/**
 * La comunidad, en una sola lectura.
 *
 * Media red social ya estaba construida y escondida: el muro abierto era un
 * enlace dentro de la pestaña Orar, y los testimonios estaban detrás de un
 * botón en el Perfil. Esto los junta y les añade los planes públicos.
 *
 * **Sin seguir a nadie no sale vacío**: el servidor sirve lo público reciente.
 * Un feed en blanco el primer día es la forma más rápida de no volver, y es
 * justo el día en que no sigues a nadie.
 */
export const useHomeFeed = () =>
  useQuery({
    queryKey: ["homeFeed"],
    queryFn: async (): Promise<FeedEntry[]> => {
      const { data, error } = await supabase.rpc("home_feed");

      if (error) throw error;

      return (data ?? []) as FeedEntry[];
    },
  });

export type PersonSearchResult = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  follower_count: number;
  i_follow: boolean;
};

/**
 * Buscar a una persona, que no se podía de ninguna forma.
 *
 * Misma forma que el buscador de círculos: filtra mientras se escribe, y sin
 * acentos — `maria` encuentra *María* y `nunez` encuentra *Núñez*.
 */
export const useSearchPeople = (query: string) => {
  // Sin esto se lanzaba una petición por tecla. El buscador de círculos ya
  // llevaba su espera de 250 ms desde el bloque D; al copiar la forma de la RPC
  // no copié esta parte.
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ["searchPeople", debounced],
    // La consulta vacía sí se manda: devuelve el directorio, y "cero
    // resultados" antes de escribir nada se lee como "no hay nadie".
    queryFn: async (): Promise<PersonSearchResult[]> => {
      const { data, error } = await supabase.rpc("search_people", {
        p_query: debounced,
      });

      if (error) throw error;

      return (data ?? []) as PersonSearchResult[];
    },
  });
};

export type PersonPost = {
  id: string;
  body: string;
  prayer_count: number;
  comment_count: number;
  answered_at: string | null;
  created_at: string;
  i_prayed: boolean;
  is_mine: boolean;
};

/** Lo que esa persona pidió en el muro abierto. Nunca lo anónimo. */
export const usePersonPosts = (userId: string | undefined) =>
  useQuery({
    queryKey: ["personPosts", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PersonPost[]> => {
      const { data, error } = await supabase.rpc("person_posts", {
        p_user_id: userId!,
      });

      if (error) throw error;

      return (data ?? []) as PersonPost[];
    },
  });

export type PersonPlan = {
  id: string;
  title: string;
  duration_days: number;
  created_at: string;
  is_mine: boolean;
};

export const usePersonPlans = (userId: string | undefined) =>
  useQuery({
    queryKey: ["personPlans", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PersonPlan[]> => {
      const { data, error } = await supabase.rpc("person_plans", {
        p_user_id: userId!,
      });

      if (error) throw error;

      return (data ?? []) as PersonPlan[];
    },
  });
