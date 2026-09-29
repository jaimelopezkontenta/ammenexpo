#!/usr/bin/env node
/**
 * Invocador local de `send-email`.
 *
 * Igual que `pushDrain.mjs`: no es evidencia de entrega. No llama a Resend
 * si el sender está en kill switch o sin API key. Staging exige allowlist.
 *
 *   node scripts/emailDrain.mjs
 */

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "http://127.0.0.1:54421"
).replace(/\/$/u, "");

const apiKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const invokeSecret = process.env.AMMEN_EMAIL_INVOKE_SECRET ?? "";
const endpoint = `${supabaseUrl}/functions/v1/send-email`;

const headers = { "Content-Type": "application/json" };

if (apiKey) {
  headers.Authorization = `Bearer ${apiKey}`;
  headers.apikey = apiKey;
}

if (invokeSecret) {
  headers["x-ammen-invoker"] = invokeSecret;
}

let response;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: "{}",
  });
} catch (caught) {
  const reason = caught instanceof Error ? caught.message : String(caught);
  console.error(
    `emailDrain: no se pudo llamar al sender (${endpoint}). ¿Está ` +
      `\`supabase functions serve\` arriba? ${reason}`,
  );
  process.exitCode = 1;
  process.exit();
}

const body = await response.text();
let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  parsed = { raw: body.slice(0, 200) };
}

if (!response.ok) {
  console.error(
    `emailDrain: sender respondió ${response.status} (${parsed.error ?? "sin etiqueta"}).`,
  );
  process.exitCode = 1;
  process.exit();
}

const sent = typeof parsed.sent === "number" ? parsed.sent : "?";
const skipped = parsed.skipped ?? null;
console.log(
  skipped
    ? `emailDrain: invocación ok, skipped=${JSON.stringify(skipped)} sent=${sent}`
    : `emailDrain: invocación ok, sent=${sent} (aceptados por Resend, no bandeja)`,
);
