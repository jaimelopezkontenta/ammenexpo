import { createAdminClient, type SupabaseClient } from "../_shared/admin.ts";
import { CORS_INVOKER, jsonWith, preflight } from "../_shared/http.ts";
import {
  createLogger,
  describeError,
  type Logger,
  requestIdFrom,
} from "../_shared/log.ts";
import { renderEmail } from "../_shared/emails/render.ts";
import type {
  EmailLocale,
  EmailPayload,
  EmailTemplateId,
} from "../_shared/emails/copy.ts";
import {
  authorizeInvoker,
  isAllowlisted,
  resolveEmailSenderConfig,
} from "./config.ts";
import { deliveryErrorCode } from "./outcome.ts";

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "Ammen <hola@mail.ammen.app>";
const REPLY_TO = "hola@ammen.app";

/**
 * Sin timeout, un Resend que no contesta deja colgada toda la invocación (y con
 * ella los 50 correos arrendados) hasta que el reloj del edge la mata. Con él, el
 * fallo es reintentable como cualquier otro: el `Idempotency-Key` hace que un
 * reintento tras un correo que SÍ salió no lo duplique.
 */
const RESEND_TIMEOUT_MS = 20_000;

const json = jsonWith(CORS_INVOKER);

type ClaimedRow = {
  outbox_id: string;
  template: EmailTemplateId;
  locale: string;
  to_email: string;
  user_id: string | null;
  channel: string;
  payload: EmailPayload;
  idempotency_key: string;
  attempts: number;
};

const mark = async (
  supabase: SupabaseClient,
  logger: Logger,
  outboxId: string,
  status: "sent" | "permanent_failure" | "retryable_failure" | "skipped",
  resendId: string | null,
  error: string | null,
) => {
  const { error: rpcError } = await supabase.rpc("mark_email_delivery", {
    p_outbox_id: outboxId,
    p_status: status,
    p_resend_id: resendId,
    p_error: error,
  });

  if (rpcError) {
    // Sin `rpcError.message`: lleva el `p_error`, que puede citar la respuesta
    // de Resend (y con ella el destinatario).
    logger.error("mark.failed", {
      outbox_id: outboxId,
      status,
      ...describeError(rpcError),
    });
  }
};

const localeOf = (value: string): EmailLocale =>
  value.toLowerCase().startsWith("en") ? "en" : "es";

const sendOne = async (input: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  template: string;
  locale: string;
  transactional: boolean;
  unsubscribeUrl?: string;
}): Promise<
  | { id: string }
  | { permanent: true; error: string }
  | { retryable: true; error: string }
> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.apiKey}`,
    "Content-Type": "application/json",
    "Idempotency-Key": input.idempotencyKey,
  };

  const body: Record<string, unknown> = {
    from: FROM,
    to: [input.to],
    reply_to: REPLY_TO,
    subject: input.subject,
    html: input.html,
    text: input.text,
    tags: [
      { name: "template", value: input.template },
      { name: "locale", value: input.locale },
    ],
  };

  if (!input.transactional && input.unsubscribeUrl) {
    body.headers = {
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "transport_error";
    return { retryable: true, error: reason };
  }

  if (response.status === 429 || response.status >= 500) {
    return { retryable: true, error: `resend_${response.status}` };
  }

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 422 || response.status === 403) {
      return { permanent: true, error: `resend_${response.status}` };
    }
    return {
      retryable: true,
      error: `resend_${response.status}:${detail.slice(0, 80)}`,
    };
  }

  // Un 200 cuyo cuerpo no es JSON tampoco lanza: sin id no hay nada que dar por
  // enviado, así que se trata como cualquier respuesta sin id (y el
  // Idempotency-Key evita el duplicado al reintentar).
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
  };
  if (!payload.id) {
    return { retryable: true, error: "resend_missing_id" };
  }

  return { id: payload.id };
};

/**
 * Drain del email_outbox. No se llama desde el cliente Expo. Kill switch
 * `EMAIL_SENDER_ENABLED=false`. Staging: `EMAIL_ALLOWLIST` (si está, el resto
 * se marca skipped, no se llama a Resend).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflight(CORS_INVOKER);
  }

  const logger = createLogger("send-email", requestIdFrom(req.headers));

  if (
    authorizeInvoker(
      req.headers.get("x-ammen-invoker"),
      Deno.env.get("AMMEN_EMAIL_INVOKE_SECRET") ?? undefined,
      Deno.env.get("SUPABASE_URL") ?? undefined,
    ) === "unauthorized"
  ) {
    // Nunca el valor del header ni el secreto: solo que hubo un rechazo.
    logger.warn("auth.rejected");
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const config = resolveEmailSenderConfig({
    EMAIL_SENDER_ENABLED: Deno.env.get("EMAIL_SENDER_ENABLED") ?? undefined,
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? undefined,
    SUPABASE_SERVICE_ROLE_KEY:
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? undefined,
    RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ?? undefined,
    EMAIL_APP_ORIGIN: Deno.env.get("EMAIL_APP_ORIGIN") ?? undefined,
    EMAIL_ALLOWLIST: Deno.env.get("EMAIL_ALLOWLIST") ?? undefined,
    SITE_URL: Deno.env.get("SITE_URL") ?? undefined,
  });

  if (!config.enabled) {
    if (config.reason === "kill_switch") {
      logger.info("skipped", { reason: "kill_switch" });
      return json({ ok: true, skipped: "kill_switch", sent: 0 });
    }
    logger.error("sender.not_configured");
    return json({ ok: false, error: "sender_not_configured" }, 503);
  }

  const supabase = createAdminClient(config.supabaseUrl, config.serviceRoleKey);

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_email_outbox_batch",
    { p_limit: 50, p_lease_seconds: 120 },
  );

  if (claimError) {
    logger.error("claim.failed", describeError(claimError));
    return json({ ok: false, error: "claim_email_outbox_batch_failed" }, 500);
  }

  const rows = (claimed ?? []) as ClaimedRow[];

  if (rows.length === 0) {
    return json({ ok: true, sent: 0, retried: 0, failed: 0, skipped: 0 });
  }

  logger.info("batch.claimed", { rows: rows.length });

  let sent = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!isAllowlisted(row.to_email, config.allowlist)) {
      skipped += 1;
      await mark(
        supabase,
        logger,
        row.outbox_id,
        "skipped",
        null,
        "not_allowlisted",
      );
      continue;
    }

    let prefsToken: string | null = null;
    if (row.user_id && row.channel !== "T") {
      const { data: token, error: tokenError } = await supabase.rpc(
        "issue_email_prefs_token",
        { p_user: row.user_id },
      );

      if (tokenError) {
        // Un correo que no es transaccional sin enlace de baja (ni cabecera
        // List-Unsubscribe) no debe salir: se reintenta con backoff en vez de
        // mandarlo sin salida.
        retried += 1;
        logger.warn("prefs_token.failed", {
          outbox_id: row.outbox_id,
          ...describeError(tokenError),
        });
        await mark(
          supabase,
          logger,
          row.outbox_id,
          "retryable_failure",
          null,
          "prefs_token_failed",
        );
        continue;
      }

      prefsToken = (token as string | null) ?? null;

      if (prefsToken === null) {
        // La función devuelve null si la base no tiene su secreto HMAC. Se
        // sigue enviando (es lo que ya pasaba), pero queda dicho.
        logger.warn("prefs_token.missing", { outbox_id: row.outbox_id });
      }
    }

    const rendered = renderEmail({
      template: row.template,
      locale: localeOf(row.locale),
      payload: row.payload ?? {},
      prefsToken,
      appOrigin: config.appOrigin,
    });

    const functionsOrigin = `${config.supabaseUrl.replace(/\/$/u, "")}/functions/v1`;
    const unsubscribeUrl = prefsToken
      ? `${functionsOrigin}/email-unsubscribe?t=${encodeURIComponent(prefsToken)}`
      : undefined;

    const result = await sendOne({
      apiKey: config.resendApiKey,
      to: row.to_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: row.idempotency_key,
      template: row.template,
      locale: localeOf(row.locale),
      transactional: rendered.transactional,
      unsubscribeUrl,
    });

    if ("id" in result) {
      sent += 1;
      await mark(supabase, logger, row.outbox_id, "sent", result.id, null);
      continue;
    }

    // Ni el correo ni la respuesta de Resend: solo la plantilla y un código.
    const failure = {
      outbox_id: row.outbox_id,
      template: row.template,
      attempts: row.attempts,
      code: deliveryErrorCode(result.error),
    };

    if ("permanent" in result) {
      failed += 1;
      logger.warn("delivery.permanent_failure", failure);
      await mark(
        supabase,
        logger,
        row.outbox_id,
        "permanent_failure",
        null,
        result.error,
      );
      continue;
    }

    retried += 1;
    logger.warn("delivery.retryable_failure", failure);
    await mark(
      supabase,
      logger,
      row.outbox_id,
      "retryable_failure",
      null,
      result.error,
    );
  }

  logger.info("batch.done", { sent, retried, failed, skipped });

  return json({ ok: true, sent, retried, failed, skipped });
});
