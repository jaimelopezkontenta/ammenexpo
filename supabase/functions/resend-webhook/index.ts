import { createAdminClient } from "../_shared/admin.ts";
import { json, preflight } from "../_shared/http.ts";
import { createLogger, describeError, requestIdFrom } from "../_shared/log.ts";
import { verifyResendSignature } from "./svix.ts";

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
  };
};

/**
 * Webhook de Resend. Verifica Svix, persiste el evento, y bounce/complaint
 * escriben email_suppressions. Deduplica por svix-id en Postgres.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflight();
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const logger = createLogger("resend-webhook", requestIdFrom(req.headers));

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET")?.trim() ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

  if (!secret || !supabaseUrl || !serviceRoleKey) {
    logger.error("not_configured");
    return json({ ok: false, error: "webhook_not_configured" }, 503);
  }

  const body = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  const ok = await verifyResendSignature({
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
    body,
  });

  if (!ok) {
    logger.warn("signature.rejected");
    return json({ ok: false, error: "invalid_signature" }, 401);
  }

  let parsed: ResendEvent;
  try {
    parsed = JSON.parse(body) as ResendEvent;
  } catch {
    logger.warn("body.invalid_json");
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const supabase = createAdminClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("record_email_event", {
    p_svix_id: svixId,
    p_event_type: parsed.type ?? "unknown",
    p_resend_id: parsed.data?.email_id ?? null,
    p_payload: parsed,
  });

  if (error) {
    logger.error("record.failed", describeError(error));
    return json({ ok: false, error: "persist_failed" }, 500);
  }

  // `svix_id` es un id opaco; el tipo de evento, una etiqueta de Resend. Ni el
  // destinatario ni el payload.
  logger.info("event.recorded", {
    svix_id: svixId,
    event_type: parsed.type ?? "unknown",
    recorded: Boolean(data),
  });

  return json({ ok: true, recorded: Boolean(data) });
});
