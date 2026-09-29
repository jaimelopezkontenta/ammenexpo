import { createClient } from "npm:@supabase/supabase-js@^2.58.0";

import { authorizeInvoker } from "../send-email/config.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ammen-invoker",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/**
 * Encola hábito / digest / drip / win-back. Idempotente. Lo llama el cron
 * cada 15 minutos (o `npm run email:enqueue` en local).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (
    authorizeInvoker(
      req.headers.get("x-ammen-invoker"),
      Deno.env.get("AMMEN_EMAIL_INVOKE_SECRET") ?? undefined,
      Deno.env.get("SUPABASE_URL") ?? undefined,
    ) === "unauthorized"
  ) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.rpc("enqueue_all_email_jobs");

  if (error) {
    console.error("enqueue_all_email_jobs failed", error);
    return json({ ok: false, error: "enqueue_failed" }, 500);
  }

  return json({ ok: true, jobs: data });
});
