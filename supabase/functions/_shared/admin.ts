import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@^2.58.0";

export type { SupabaseClient };

/**
 * El cliente con `service_role`, para las funciones que trabajan sin usuario
 * (colas, webhooks, baja de correo). Una sola fábrica para que ninguna se
 * olvide de apagar la sesión: en un isolate de Deno no hay nada que persistir
 * ni que refrescar, y el refresco automático dejaría un temporizador vivo en
 * una función que debería morir con la respuesta.
 *
 * La `service_role` se salta RLS. Solo la crea quien ya autorizó a su
 * invocador; nunca sale de la función.
 */
export const createAdminClient = (url: string, key: string): SupabaseClient =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
