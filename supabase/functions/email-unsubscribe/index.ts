import { createAdminClient } from "../_shared/admin.ts";
import { CORS_UNSUBSCRIBE, jsonWith, preflight } from "../_shared/http.ts";
import { createLogger, describeError, requestIdFrom } from "../_shared/log.ts";

const json = jsonWith(CORS_UNSUBSCRIBE);

/**
 * Baja one-click (RFC 8058). POST pone cadence=off. GET redirige a /correo?t=.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflight(CORS_UNSUBSCRIBE);
  }

  const logger = createLogger("email-unsubscribe", requestIdFrom(req.headers));

  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const appOrigin = (
    Deno.env.get("EMAIL_APP_ORIGIN") ||
    Deno.env.get("SITE_URL") ||
    "https://ammen.app"
  ).replace(/\/$/u, "");

  if (!token) {
    return json({ ok: false, error: "missing_token" }, 400);
  }

  if (req.method === "GET") {
    return Response.redirect(
      `${appOrigin}/correo?t=${encodeURIComponent(token)}`,
      302,
    );
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("not_configured");
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const supabase = createAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("unsubscribe_email_one_click", {
    p_token: token,
  });

  if (error) {
    logger.error("unsubscribe.failed", describeError(error));
    return json({ ok: false, error: "unsubscribe_failed" }, 500);
  }

  // El token de baja identifica a una persona: no se registra ni su valor.
  logger.info("unsubscribe.done", { applied: Boolean(data) });

  return json({ ok: Boolean(data) });
});
