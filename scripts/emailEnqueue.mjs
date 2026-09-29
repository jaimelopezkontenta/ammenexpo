#!/usr/bin/env node
/**
 * Invocador local de `enqueue-emails` (hábito, digest, drip, win-back).
 *
 *   node scripts/emailEnqueue.mjs
 */

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "http://127.0.0.1:54321"
).replace(/\/$/u, "");

const apiKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const invokeSecret = process.env.AMMEN_EMAIL_INVOKE_SECRET ?? "";
const endpoint = `${supabaseUrl}/functions/v1/enqueue-emails`;

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
    `emailEnqueue: no se pudo llamar (${endpoint}). ${reason}`,
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
    `emailEnqueue: respondió ${response.status} (${parsed.error ?? "sin etiqueta"}).`,
  );
  process.exitCode = 1;
  process.exit();
}

console.log("emailEnqueue: ok", parsed.jobs ?? parsed);
