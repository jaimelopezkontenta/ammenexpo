import { createAdminClient, type SupabaseClient } from "../_shared/admin.ts";
import { CORS_INVOKER, jsonWith, preflight } from "../_shared/http.ts";
import { createLogger, describeError, requestIdFrom } from "../_shared/log.ts";
import { authorizeInvoker } from "../_shared/invoker.ts";
import { avatarNameFromUrl, findOrphanAvatars } from "./orphans.ts";

/**
 * Limpieza diaria de avatares huérfanos en el bucket `avatars`.
 *
 * SQL no puede borrar de Storage: el trigger `storage.protect_delete` lo
 * prohíbe (y aunque se levantara con `storage.allow_delete_query`, en esta
 * versión el borrado de la fila deja el fichero físico en el disco — verificado
 * sobre el stack local). Así que el programa (pg_cron → `run_avatar_cleanup()`)
 * solo llama a esta función, que con el rol de servicio lista, decide y borra
 * por la API de Storage.
 *
 * Huérfanos (decisión en orphans.ts, pura y testeada):
 *   1. carpeta de una cuenta borrada que el cliente no alcanzó a limpiar;
 *   2. foto vieja tras cambiar de extensión (png → jpg hace un upsert en la
 *      otra ruta); o una cuenta sin avatar con un fichero suelto.
 *
 * `x-ammen-invoker` contra `AMMEN_AVATAR_CLEANUP_INVOKE_SECRET` (Vault:
 * `ammen_avatar_cleanup_invoke_secret`), igual que las colas: fuera de local,
 * sin secreto se cierra.
 */

const json = jsonWith(CORS_INVOKER);

const listAll = async (
  storage: SupabaseClient["storage"],
  bucket: string,
): Promise<{ name: string }[]> => {
  const objects: { name: string }[] = [];

  const top = await storage.from(bucket).list("", { limit: 1000 });
  if (top.error) throw top.error;

  // ponytail: un `list` por carpeta (O(usuario)). Con miles de usuarios esto
  // no cabe en una invocación de 150 s; el camino de mejora es un pre-filtro
  // SQL de carpetas sospechosas, no otro listado.
  for (const entry of top.data) {
    if (entry.metadata !== null) continue; // fichero suelto en raiz: no es un avatar

    const files = await storage.from(bucket).list(entry.name, { limit: 1000 });
    if (files.error) throw files.error;

    for (const file of files.data) {
      if (file.metadata === null) continue; // carpeta anidada: no esperada
      objects.push({ name: `${entry.name}/${file.name}` });
    }
  }

  return objects;
};

const listUserIds = async (supabase: SupabaseClient): Promise<Set<string>> => {
  const ids = new Set<string>();
  const PAGE = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page });
    if (error) throw error;

    for (const user of data.users) ids.add(user.id);
    if (data.users.length < PAGE) break;
  }

  return ids;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflight(CORS_INVOKER);
  }

  const logger = createLogger("cleanup-avatars", requestIdFrom(req.headers));

  if (
    authorizeInvoker(
      req.headers.get("x-ammen-invoker"),
      Deno.env.get("AMMEN_AVATAR_CLEANUP_INVOKE_SECRET") ?? undefined,
      Deno.env.get("SUPABASE_URL") ?? undefined,
    ) === "unauthorized"
  ) {
    // Nunca el valor del header ni el secreto: solo que hubo un rechazo.
    logger.warn("auth.rejected");
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    logger.error("config.missing", {
      detail: "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    });
    return json({ ok: false, error: "misconfigured" }, 500);
  }

  const supabase = createAdminClient(supabaseUrl, serviceKey);
  const started = performance.now();

  try {
    const [userIds, profiles, objects] = await Promise.all([
      listUserIds(supabase),
      supabase.from("profiles").select("id, avatar_url"),
      listAll(supabase.storage, "avatars"),
    ]);
    if (profiles.error) throw profiles.error;

    const orphans = findOrphanAvatars({
      objects,
      accounts: profiles.data.map((profile) => ({
        userId: profile.id,
        referencedName: avatarNameFromUrl(profile.avatar_url),
      })),
    });

    let deleted = 0;
    if (orphans.length > 0) {
      const { error } = await supabase.storage
        .from("avatars")
        .remove([...orphans]);
      if (error) throw error;
      deleted = orphans.length;
    }

    logger.info("cleanup.done", {
      objects: objects.length,
      users: userIds.size,
      orphans: orphans.length,
      deleted,
      ms: Math.round(performance.now() - started),
    });

    return json({
      ok: true,
      scanned: objects.length,
      orphans: orphans.length,
      deleted,
    });
  } catch (error) {
    const reason = describeError(error);
    logger.error("cleanup.failed", reason);
    return json({ ok: false, error: reason }, 500);
  }
});
