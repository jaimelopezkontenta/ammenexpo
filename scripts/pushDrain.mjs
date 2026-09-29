#!/usr/bin/env node
/**
 * Invocador local de `send-intercession-push`.
 *
 * Llama al sender por HTTP con el header `x-ammen-invoker` cuando
 * `AMMEN_PUSH_INVOKE_SECRET` está definido. No es un cron y no sustituye
 * a uno: en este host `pg_cron` puede no existir (Supabase local no lo
 * habilita siempre), así que el drenaje es a mano, desde aquí.
 *
 * **Esto no afirma entrega física.** No inserta dispositivos, no encola
 * outbox, no activa recordatorios. Si el sender no está servido o el
 * outbox está vacío, el resultado es una invocación, no un push.
 *
 * Uso:
 *   node scripts/pushDrain.mjs
 *
 * Entorno (ninguno se imprime):
 *   SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL  — default http://127.0.0.1:54421 (Kong de este proyecto)
 *   SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 *   AMMEN_PUSH_INVOKE_SECRET                 — si el sender lo exige
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

const invokeSecret = process.env.AMMEN_PUSH_INVOKE_SECRET ?? "";

const endpoint = `${supabaseUrl}/functions/v1/send-intercession-push`;

const headers = {
  "Content-Type": "application/json",
};

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
    `pushDrain: no se pudo llamar al sender (${endpoint}). ¿Está ` +
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
    `pushDrain: sender respondió ${response.status} (${parsed.error ?? "sin etiqueta"}). ` +
      "No es evidencia de entrega. Si AMMEN_PUSH_INVOKE_SECRET está definido " +
      "en la función, este proceso tiene que llevar el mismo valor.",
  );
  process.exitCode = 1;
  process.exit();
}

const sent = typeof parsed.sent === "number" ? parsed.sent : "?";
const skipped = parsed.skipped ?? null;
console.log(
  skipped
    ? `pushDrain: invocación ok, skipped=${skipped}`
    : `pushDrain: invocación ok, sent=${sent} (aceptados por el sender, no entregas físicas)`,
);
