import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2.58.0";

import { buildRepairPrompt, buildUserPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { createAnthropicProvider } from "./providers/anthropic.ts";
import { createOllamaProvider } from "./providers/ollama.ts";
import {
  type PlanProvider,
  type ProviderMessage,
  ProviderRefusal,
} from "./providers/types.ts";
import { isGeneratedPlan, PLAN_JSON_SCHEMA } from "./schema.ts";
import { resolveDays, unresolved, type ResolvedDay } from "./scripture.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const FREE_PLAN_LIMIT = 1;
const MIN_DAYS = 3;
const MAX_DAYS = 30;

/**
 * Generation runs past the response. An Edge Function has a hard request wall
 * clock (~150s locally) and a long plan can exceed it, so we create the row,
 * answer immediately, and finish the work in the background. The client watches
 * the row flip from 'generating' to 'active' over Realtime.
 */
const runInBackground = (promise: Promise<unknown>) => {
  const runtime = (
    globalThis as {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
    }
  ).EdgeRuntime;

  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
  } else {
    void promise;
  }
};

const selectProvider = (): PlanProvider => {
  const provider = Deno.env.get("AI_PROVIDER") ?? "anthropic";

  if (provider === "ollama") {
    return createOllamaProvider(
      Deno.env.get("OLLAMA_URL") ?? "http://host.docker.internal:11434",
      Deno.env.get("OLLAMA_MODEL") ?? "gemma3:4b",
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Set it with `supabase secrets set`, " +
        "or use AI_PROVIDER=ollama for local development.",
    );
  }

  return createAnthropicProvider(apiKey);
};

type FillArgs = {
  supabase: SupabaseClient;
  provider: PlanProvider;
  planId: string;
  userPrompt: string;
  startDate: Date;
};

const fillPlan = async ({
  supabase,
  provider,
  planId,
  userPrompt,
  startDate,
}: FillArgs) => {
  const fail = async (reason: string) => {
    await supabase
      .from("prayer_plans")
      .update({ status: "failed", generation_error: reason })
      .eq("id", planId);
  };

  const messages: ProviderMessage[] = [{ role: "user", content: userPrompt }];
  let result;

  try {
    result = await provider.generate({
      system: SYSTEM_PROMPT,
      messages,
      schema: PLAN_JSON_SCHEMA,
    });
  } catch (error) {
    console.error("generation failed", error);
    await fail(
      error instanceof ProviderRefusal ? "refused" : "generation_failed",
    );
    return;
  }

  let plan;

  try {
    plan = JSON.parse(result.json);
  } catch {
    await fail("invalid_model_output");
    return;
  }

  if (!isGeneratedPlan(plan) || plan.days.length === 0) {
    await fail("invalid_model_output");
    return;
  }

  // Scripture validation: the gate that keeps invented verses out. Anything
  // that does not resolve against the real RVR1909 text gets one repair
  // attempt; if it still fails the day ships WITHOUT a verse rather than with
  // a fabricated one.
  let days: ResolvedDay[] = await resolveDays(supabase, plan.days);
  let bad = unresolved(days);

  if (bad.length > 0) {
    console.warn(
      `unresolved references: ${bad.map((d) => d.scripture_ref).join(", ")}`,
    );

    try {
      const repaired = await provider.generate({
        system: SYSTEM_PROMPT,
        messages: [
          ...messages,
          { role: "assistant", content: result.json },
          { role: "user", content: buildRepairPrompt(bad) },
        ],
        schema: PLAN_JSON_SCHEMA,
      });

      const repairedPlan = JSON.parse(repaired.json);

      if (isGeneratedPlan(repairedPlan)) {
        const rechecked = await resolveDays(supabase, repairedPlan.days);

        if (unresolved(rechecked).length < bad.length) {
          days = rechecked;
          bad = unresolved(days);
        }
      }
    } catch (error) {
      console.warn("repair pass failed; shipping without those verses", error);
    }
  }

  const { error: daysError } = await supabase.from("prayer_plan_days").insert(
    days.map((day, index) => {
      const unlock = new Date(startDate);
      unlock.setDate(unlock.getDate() + index);

      return {
        plan_id: planId,
        day_number: index + 1,
        title: day.title,
        // Canonical spelling from our own Bible table, not the model's.
        scripture_ref: day.canonical_ref,
        scripture_text: day.scripture_text,
        prayer_body: day.prayer_body,
        reflection_question: day.reflection_question,
        unlock_date: unlock.toISOString().slice(0, 10),
      };
    }),
  );

  if (daysError) {
    console.error("could not save plan days", daysError);
    await fail("persist_failed");
    return;
  }

  await supabase
    .from("prayer_plans")
    .update({
      title: plan.title.slice(0, 140),
      theme: plan.theme?.slice(0, 140) ?? null,
      duration_days: days.length,
      status: "active",
      source_prompt: {
        model: result.model,
        provider: provider.name,
        days_without_scripture: bad.length,
        usage: result.usage ?? null,
      },
    })
    .eq("id", planId);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return json({ error: "unauthorized" }, 401);
  }

  // Deliberately the user's client, not the service role: every write below
  // still passes through RLS, so a bug here cannot touch someone else's plan.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const durationDays =
    typeof body?.duration_days === "number" ? Math.round(body.duration_days) : 7;

  if (durationDays < MIN_DAYS || durationDays > MAX_DAYS) {
    return json({ error: "invalid_duration", min: MIN_DAYS, max: MAX_DAYS }, 400);
  }

  // Generation is the expensive part, so it is what the paywall guards, and the
  // check lives here because the client can be lied to. Failed attempts do not
  // count against the allowance.
  const [{ count: planCount }, { data: subscription }] = await Promise.all([
    supabase
      .from("prayer_plans")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .neq("status", "failed"),
    supabase
      .from("subscriptions")
      .select("status, expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isSubscribed =
    subscription?.status === "active" &&
    (!subscription.expires_at ||
      new Date(subscription.expires_at) > new Date());

  if (!isSubscribed && (planCount ?? 0) >= FREE_PLAN_LIMIT) {
    return json({ error: "plan_limit_reached", limit: FREE_PLAN_LIMIT }, 402);
  }

  const [
    { data: profile, error: profileError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase
      .from("profile_settings")
      .select("onboarding_answers")
      .eq("id", user.id)
      .single(),
  ]);

  if (profileError || settingsError) {
    // Worth failing loudly: silently falling back to a generic prompt would
    // produce a bland plan and hide a broken auth or RLS setup.
    console.error("could not read the caller's profile", {
      profileError,
      settingsError,
    });
    return json({ error: "profile_unavailable" }, 500);
  }

  const answers = (settings?.onboarding_answers ?? {}) as {
    season?: string;
    topics?: string[];
    minutes?: number;
  };

  let provider: PlanProvider;

  try {
    provider = selectProvider();
  } catch (error) {
    console.error("provider misconfigured", error);
    return json({ error: "provider_unavailable" }, 503);
  }

  const startDate = new Date();

  const { data: created, error: planError } = await supabase
    .from("prayer_plans")
    .insert({
      owner_id: user.id,
      title: "…",
      duration_days: durationDays,
      start_date: startDate.toISOString().slice(0, 10),
      visibility: "private",
      status: "generating",
      generated_by: "ai",
      source_prompt: { answers, duration_days: durationDays },
    })
    .select("id")
    .single();

  if (planError || !created) {
    console.error("could not create plan row", planError);
    return json({ error: "persist_failed" }, 500);
  }

  runInBackground(
    fillPlan({
      supabase,
      provider,
      planId: created.id,
      userPrompt: buildUserPrompt({
        displayName: profile?.display_name?.trim() || "esta persona",
        durationDays,
        season: answers.season ?? null,
        topics: answers.topics ?? [],
        minutes: answers.minutes ?? null,
      }),
      startDate,
    }),
  );

  return json({ plan_id: created.id, status: "generating" }, 202);
});
