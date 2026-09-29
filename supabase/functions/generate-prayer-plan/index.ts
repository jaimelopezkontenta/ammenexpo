import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@^2.58.0";

import { CORS_USER, jsonWith, preflight } from "../_shared/http.ts";
import { buildRepairPrompt, buildUserPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { MAX_DAYS, MIN_DAYS } from "./bounds.ts";
import { deriveChunkRequestId } from "./chunkRequestId.ts";
import { parseGenerateBody, readJsonBody } from "./input.ts";
import { createAnthropicProvider } from "./providers/anthropic.ts";
import { createFixtureProvider } from "./providers/fixture.ts";
import {
  AttemptTimeout,
  BudgetExhausted,
  DEFAULT_BUDGET,
  remainingMs,
} from "./providers/retry.ts";
import { createUnslothProvider } from "./providers/unsloth.ts";
import {
  type PlanProvider,
  type ProviderMessage,
  ProviderRefusal,
} from "./providers/types.ts";
import { promptAnswersFrom, sanitizeDisplayName } from "./promptInputs.ts";
import { sanitizeGeneratedText } from "./sanitize.ts";
import { isGeneratedPlan, PLAN_JSON_SCHEMA } from "./schema.ts";
import { resolveDays, unresolved, type ResolvedDay } from "./scripture.ts";

const json = jsonWith(CORS_USER);

/**
 * Long enough for a full stretch, short enough that a dead invocation does not
 * hold the plan hostage. It matches the client's own "stuck after five
 * minutes" threshold, so the two agree on when a generation is truly gone.
 * The database clamps this both ways (30s floor, 1h ceiling).
 */
const LEASE_SECONDS = 300;

/**
 * Work continues after the response is sent. The isolate still has a time
 * budget, which is exactly why a stretch has to be small enough to finish
 * inside it.
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

  if (provider === "fixture") {
    return createFixtureProvider();
  }

  if (provider === "unsloth") {
    return createUnslothProvider(
      Deno.env.get("UNSLOTH_URL") ?? "http://host.docker.internal:8888/v1",
      Deno.env.get("UNSLOTH_MODEL") ?? "unsloth/Qwen3.8-27B-GGUF",
      Deno.env.get("UNSLOTH_API_KEY") ?? "",
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Set it with `supabase secrets set`, " +
        "or use AI_PROVIDER=unsloth for local development.",
    );
  }

  return createAnthropicProvider(apiKey);
};

type PlanRow = {
  id: string;
  owner_id: string;
  duration_days: number;
  start_date: string;
  status: string;
  source_prompt: {
    answers?: {
      /** Several since the onboarding went multi-select. */
      seasons?: string[];
      /** The single-season shape, kept so older rows still read. */
      season?: string;
      topics?: string[];
      gender?: string;
      custom_topic?: string;
      minutes?: number;
    };
  } | null;
};

// A client-supplied `request_id` is an idempotency key. `parseGenerateBody`
// keeps it only if it is a UUID; anything else is replaced here, so a malformed
// value can never collide. (It is not the correlation id of the logs: that one
// is `x-request-id`.)
const idempotencyKeyFrom = (requestId: string | null): string =>
  requestId ?? crypto.randomUUID();

/** Asks this same function to write the next stretch, in a fresh isolate. */
const requestNextChunk = async (planId: string, authHeader: string) => {
  try {
    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-prayer-plan`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          continue_plan_id: planId,
          request_id: crypto.randomUUID(),
        }),
      },
    );
  } catch (error) {
    // The plan keeps the days it already has; the user can still pray today.
    console.error("could not schedule the next stretch", error);
  }
};

type ChunkArgs = {
  supabase: SupabaseClient;
  provider: PlanProvider;
  plan: PlanRow;
  displayName: string;
  fromDay: number;
  toDay: number;
  leaseId: string;
  authHeader: string;
};

/**
 * The shape of one day sent to `complete_generation_chunk`. The `plan_id` is
 * deliberately absent: the database takes it from the lease, so a caller cannot
 * point the write at a different plan.
 */
type DayPayload = {
  day_number: number;
  title: string;
  scripture_ref: string | null;
  scripture_text: string | null;
  interpretation: string | null;
  daily_action: string | null;
  prayer_body: string;
  intercessor_prayer: string | null;
  unlock_date: string;
};

const writeChunk = async ({
  supabase,
  provider,
  plan,
  displayName,
  fromDay,
  toDay,
  leaseId,
  authHeader,
}: ChunkArgs) => {
  const isFirstChunk = fromDay === 1;

  // A failure is settled through the lease, so a provider failure cannot leave
  // an eternal lease — and the lease itself is the fence: if it has expired or
  // been reclaimed, `fail_generation_chunk` refuses and the stale invocation
  // cannot mark the plan failed.
  const failChunk = async (reason: string) => {
    const { data: failRows, error: failError } = await supabase.rpc(
      "fail_generation_chunk",
      {
        p_lease_id: leaseId,
        p_error: reason,
      },
    );

    if (failError) {
      console.error("could not fail the chunk lease", failError);
      return;
    }

    const fail = (failRows ?? [])[0];

    // The server decides — from the append-only ledger, not from the client —
    // whether the first stretch deserves another isolate. A later stretch just
    // keeps the days it already has; nothing is thrown away.
    if (fail?.ok && fail.retry) {
      await requestNextChunk(plan.id, authHeader);
    }
  };

  // Not a plain select: prayer_plan_days hides days whose unlock_date is in the
  // future, even from the owner, so a direct query would report only the days
  // already unlocked and the generator would rewrite the rest.
  const { data: existing } = await supabase.rpc("plan_written_days", {
    p_plan_id: plan.id,
  });

  // The answers are a jsonb nobody validated when it was stored: everything
  // that reaches the prompt goes through `promptAnswersFrom` first (known keys
  // only, the free topic fenced and bounded). Plans written before the
  // onboarding went multi-select carry a single `season`; it reads both.
  const answers = promptAnswersFrom(plan.source_prompt?.answers);

  const userPrompt = buildUserPrompt({
    displayName,
    durationDays: plan.duration_days,
    seasons: answers.seasons,
    topics: answers.topics,
    gender: answers.gender,
    customTopic: answers.customTopic,
    minutes: answers.minutes,
    fromDay,
    toDay,
    previousDays: (existing ?? []) as {
      day_number: number;
      title: string;
      scripture_ref: string | null;
    }[],
  });

  const messages: ProviderMessage[] = [{ role: "user", content: userPrompt }];

  // ONE time budget for the whole stretch — the generation and the scripture
  // repair pass draw from the same deadline, and it ends before the lease does
  // (see providers/retry.ts). Otherwise each call started with a full budget of
  // its own and a slow stretch could outlive the lease it was holding.
  const deadline = Date.now() + DEFAULT_BUDGET.totalMs;
  let result;

  try {
    result = await provider.generate({
      system: SYSTEM_PROMPT,
      messages,
      schema: PLAN_JSON_SCHEMA,
      deadline,
    });
  } catch (error) {
    console.error("generation failed", error);
    const reason =
      error instanceof ProviderRefusal
        ? "refused"
        : error instanceof AttemptTimeout || error instanceof BudgetExhausted
          ? "generation_timeout"
          : "generation_failed";
    await failChunk(reason);
    return;
  }

  if (result.usage) {
    // cache_read_input_tokens should be non-zero from the second stretch
    // onward. If it stays at zero something varies inside the system prompt,
    // and the per-user cost roughly triples.
    console.log(
      `stretch ${fromDay}-${toDay} · ${result.model} · in ${result.usage.input_tokens} ` +
        `out ${result.usage.output_tokens} · cache read ${result.usage.cache_read_input_tokens} ` +
        `write ${result.usage.cache_creation_input_tokens}`,
    );
  }

  let generated;

  try {
    generated = JSON.parse(result.json);
  } catch {
    await failChunk("invalid_model_output");
    return;
  }

  if (!isGeneratedPlan(generated) || generated.days.length === 0) {
    await failChunk("invalid_model_output");
    return;
  }

  // Scripture validation: the gate that keeps invented verses out. Anything
  // that does not resolve against the real RVR1909 text gets one repair
  // attempt; if it still fails the day ships WITHOUT a verse rather than with
  // a fabricated one.
  let days: ResolvedDay[] = await resolveDays(supabase, generated.days);
  let bad = unresolved(days);

  // The repair is a nicety: with too little of the budget left it is skipped
  // and the days ship without those verses, exactly as if it had failed.
  const canRepair =
    remainingMs(deadline, Date.now()) >= DEFAULT_BUDGET.repairMinRemainingMs;

  if (bad.length > 0 && !canRepair) {
    console.warn(
      `repair pass skipped (${bad.length} unresolved reference(s)): not enough of the time budget is left`,
    );
  }

  if (bad.length > 0 && canRepair) {
    console.warn(
      `unresolved references: ${bad
        .slice(0, 10)
        .map((d) => d.scripture_ref)
        .join(", ")}${bad.length > 10 ? ` (+${bad.length - 10} more)` : ""}`,
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
        deadline,
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

  // The model is told which absolute day numbers to write, but its numbering is
  // not load-bearing: the slot a day occupies is decided here.
  const slotted: DayPayload[] = days
    .slice(0, toDay - fromDay + 1)
    .map((day, index) => {
      const dayNumber = fromDay + index;
      const unlock = new Date(`${plan.start_date}T00:00:00Z`);
      unlock.setUTCDate(unlock.getUTCDate() + dayNumber - 1);

      return {
        day_number: dayNumber,
        title: sanitizeGeneratedText(day.title),
        // Canonical spelling from our own Bible table, not the model's.
        scripture_ref: day.canonical_ref,
        // Straight from the RVR1909 table, so it needs no cleaning.
        scripture_text: day.scripture_text,
        interpretation: sanitizeGeneratedText(day.interpretation),
        daily_action: sanitizeGeneratedText(day.daily_action),
        prayer_body: sanitizeGeneratedText(day.prayer_body),
        intercessor_prayer: sanitizeGeneratedText(day.intercessor_prayer),
        unlock_date: unlock.toISOString().slice(0, 10),
      };
    });

  // The whole persistence — days, plan status, ledger row, lease release — is
  // one fenced transaction. If this invocation's lease has expired or been
  // reclaimed, `complete_generation_chunk` refuses and writes nothing, so a
  // stale isolate can never overwrite days an active plan already has.
  const { data: completeRows, error: completeError } = await supabase.rpc(
    "complete_generation_chunk",
    {
      p_lease_id: leaseId,
      p_days: slotted,
      p_title: isFirstChunk
        ? (sanitizeGeneratedText(generated.title) ?? "").slice(0, 140)
        : null,
      p_theme: isFirstChunk
        ? (sanitizeGeneratedText(generated.theme)?.slice(0, 140) ?? null)
        : null,
      p_source_prompt: isFirstChunk
        ? {
            ...(plan.source_prompt ?? {}),
            model: result.model,
            provider: provider.name,
          }
        : null,
    },
  );

  const complete = (completeRows ?? [])[0];

  if (completeError) {
    console.error("could not persist the chunk", completeError);
    // The client already got 202. Swallowing this would leave the lease
    // held after we paid for the model — fail/settle so the plan can recover.
    await failChunk("persist_failed");
    return;
  }

  if (!complete?.ok) {
    console.warn(
      `stretch ${fromDay}-${toDay} lost its lease (${complete?.reason}); skipping`,
    );
    return;
  }

  // Only continue while the stretch actually produced days, so a model that
  // returns nothing cannot spin this forever. `is_complete` comes from the
  // database (days written vs. promised), not from what the model returned.
  if (!complete.is_complete) {
    await requestNextChunk(plan.id, authHeader);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflight(CORS_USER);
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

  // Shape and bounds of everything the caller sent, decided before any read
  // of the database or any call to the model. A rejection is a clean 400 with
  // a stable reason, never a 500 from Postgres choking on a malformed value.
  const read = await readJsonBody(req);

  if (!read.ok) {
    return json(read.rejection, 400);
  }

  const parsed = parseGenerateBody(read.body);

  if (!parsed.ok) {
    return json(parsed.rejection, 400);
  }

  const request = parsed.value;

  let provider: PlanProvider;

  try {
    provider = selectProvider();
  } catch (error) {
    console.error("provider misconfigured", error);
    return json({ error: "provider_unavailable" }, 503);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("could not read the caller's profile", profileError);
    return json({ error: "profile_unavailable" }, 500);
  }

  // A name is data on its way into a prompt, not an instruction.
  const displayName = sanitizeDisplayName(profile?.display_name);

  // --- Continuation: write the next stretch of an existing plan ------------
  if (request.kind === "continue") {
    const { data: plan } = await supabase
      .from("prayer_plans")
      .select("id, owner_id, duration_days, start_date, status, source_prompt")
      .eq("id", request.planId)
      .maybeSingle();

    // RLS already limits this to plans the caller can read; the ownership check
    // makes sure a plan merely shared with them cannot be extended.
    if (!plan || plan.owner_id !== user.id) {
      return json({ error: "not_found" }, 404);
    }

    const { data: claimRows, error: claimError } = await supabase.rpc(
      "claim_generation_chunk",
      {
        p_plan_id: plan.id,
        p_request_id: idempotencyKeyFrom(request.requestId),
        p_lease_seconds: LEASE_SECONDS,
      },
    );

    if (claimError) {
      console.error("could not claim the next stretch", claimError);
      return json({ error: "persist_failed" }, 500);
    }

    const claim = (claimRows ?? [])[0];

    if (claim?.reason === "complete") {
      return json({ status: "complete" });
    }

    if (claim?.reason === "not_found" || claim?.reason === "not_owner") {
      return json({ error: "not_found" }, 404);
    }

    // Another invocation already holds the lease on the same stretch.
    if (claim?.reason === "in_flight") {
      return json({ error: "generation_in_flight" }, 409);
    }

    // `request_id` is globally unique while a lease is live. Reusing a key
    // that belongs to another plan is definitive, not a persistence failure.
    if (claim?.reason === "request_id_conflict") {
      return json({ error: "request_id_conflict" }, 409);
    }

    if (claim?.reason === "request_id_required") {
      return json({ error: "request_id_required" }, 400);
    }

    // A terminal plan (failed/completed/archived) can never be continued:
    // `claim_generation_chunk` refuses it server-side, so a manipulated client
    // cannot keep burning provider budget on a plan that is already over.
    if (claim?.reason === "not_generatable") {
      return json({ error: "plan_not_generatable" }, 422);
    }

    // #9b: el plan no tiene reserva en el ledger — fue creado fuera de
    // `reserve_generation` (service_role, migración, seed). No puede
    // generar contenido porque no pasó por la cuota.
    if (claim?.reason === "no_reservation") {
      return json({ error: "no_reservation" }, 500);
    }

    // This exact request already claimed (or already settled) its stretch: a
    // retry must not generate twice.
    if (claim?.reason === "already") {
      return json(
        { plan_id: plan.id, from_day: claim.from_day, to_day: claim.to_day },
        202,
      );
    }

    if (claim?.reason === "claimed") {
      runInBackground(
        writeChunk({
          supabase,
          provider,
          plan: plan as PlanRow,
          displayName,
          fromDay: claim.from_day,
          toDay: claim.to_day,
          leaseId: claim.lease_id,
          authHeader,
        }),
      );

      return json(
        { plan_id: plan.id, from_day: claim.from_day, to_day: claim.to_day },
        202,
      );
    }

    return json({ error: "claim_failed" }, 500);
  }

  // --- New plan ------------------------------------------------------------
  // Duration, visibility, topics, the free topic and the ids were already
  // checked by `parseGenerateBody`; what is left here is what needs the
  // database.
  const { durationDays, visibility, groupId, circleIds } = request;

  // The onboarding answers are the baseline; anything chosen for this specific
  // plan overrides them, which is what stops a second plan from reading like a
  // copy of the first.
  const { data: settings, error: settingsError } = await supabase
    .from("profile_settings")
    .select("onboarding_answers")
    .eq("id", user.id)
    .single();

  if (settingsError) {
    console.error("could not read the caller's settings", settingsError);
    return json({ error: "profile_unavailable" }, 500);
  }

  const onboarding = (settings?.onboarding_answers ?? {}) as Record<
    string,
    unknown
  >;

  const answers = {
    ...onboarding,
    ...(request.topics.length ? { topics: request.topics } : {}),
    ...(request.customTopic ? { custom_topic: request.customTopic } : {}),
  };

  // A circle's own plan (`groupId`): one shared walk everybody reads, rather
  // than a personal plan shared outward. `prayer_plans.group_id` has carried
  // the policies for it since the first migration.

  // The plan's row-level visibility. 'circles' is an app-level concept; at the
  // row level a plan shared with circles is simply not private, and
  // plan_shares says with whom. A circle's *own* plan is 'group'.
  const planVisibility = groupId
    ? "group"
    : visibility === "link"
      ? "link"
      : visibility === "public"
        ? "public"
        : "private";

  // One stable idempotency key for the whole "create a plan" operation. The
  // reservation uses it, and the first chunk derives its own key from it — so a
  // retry of the same create is idempotent end to end, without the reservation
  // and its first chunk colliding on the globally-unique `request_id`.
  const reservationId = idempotencyKeyFrom(request.requestId);

  // The reservation is the quota gate: atomic per user, append-only, and not
  // refunded by deleting or failing the plan. It also creates the plan row and
  // its circle shares in the same transaction, so there is no window where
  // quota is spent but the plan (or its sharing) does not exist.
  const { data: reserveRows, error: reserveError } = await supabase.rpc(
    "reserve_generation",
    {
      p_request_id: reservationId,
      p_scope: groupId ? "circle" : "personal",
      p_duration_days: durationDays,
      p_group_id: groupId ?? null,
      p_visibility: planVisibility,
      p_source_prompt: { answers },
      p_circle_ids: visibility === "circles" ? circleIds : null,
    },
  );

  if (reserveError) {
    console.error("could not reserve a generation", reserveError);
    return json({ error: "persist_failed" }, 500);
  }

  const reserve = (reserveRows ?? [])[0];

  if (!reserve?.ok) {
    if (reserve?.reason === "quota_exhausted") {
      return json(
        { error: "plan_limit_reached", limit: reserve.quota_limit },
        402,
      );
    }

    if (reserve?.reason === "circle_not_allowed") {
      return json({ error: "circle_plan_not_allowed" }, 403);
    }

    if (reserve?.reason === "invalid_duration") {
      return json(
        { error: "invalid_duration", min: MIN_DAYS, max: MAX_DAYS },
        400,
      );
    }

    if (reserve?.reason === "invalid_circles") {
      return json({ error: "invalid_circles" }, 400);
    }

    // A request_id already used by another user, or something unexpected.
    if (reserve?.reason === "request_id_conflict") {
      return json({ error: "request_id_conflict" }, 409);
    }

    return json({ error: "reservation_failed" }, 500);
  }

  const createdId = reserve.plan_id;

  // Read back the row the reservation created, so the generator works from the
  // exact start_date the database stored.
  const { data: created } = await supabase
    .from("prayer_plans")
    .select("id, owner_id, duration_days, start_date, status, source_prompt")
    .eq("id", createdId)
    .single();

  let shareToken: string | null = null;

  // Circle shares were created atomically with the reservation, so a failed
  // share can no longer leave a plan whose quota is burned but whose circles
  // are empty. The public link is an optional extra, attached only on a fresh
  // creation; a failure here leaves the plan intact and simply returns no
  // token.
  if (reserve.created && visibility === "link") {
    const { data: link } = await supabase
      .from("share_links")
      .insert({ scope: "plan", plan_id: createdId, created_by: user.id })
      .select("token")
      .single();

    shareToken = link?.token ?? null;
  }

  // Claim the first stretch through the same lease everyone else uses, so the
  // first chunk and every later one obey the same "only one writer" rule. The
  // request id is derived from the reservation, so a retry of this same create
  // claims the same chunk instead of generating a second one.
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "claim_generation_chunk",
    {
      p_plan_id: createdId,
      p_request_id: await deriveChunkRequestId(reservationId),
      p_lease_seconds: LEASE_SECONDS,
    },
  );

  if (claimError) {
    console.error("could not claim the first stretch", claimError);
    return json({ error: "persist_failed" }, 500);
  }

  const claim = (claimRows ?? [])[0];

  if (claim?.reason === "claimed" && created) {
    runInBackground(
      writeChunk({
        supabase,
        provider,
        plan: created as PlanRow,
        displayName,
        fromDay: claim.from_day,
        toDay: claim.to_day,
        leaseId: claim.lease_id,
        authHeader,
      }),
    );
  }

  return json(
    { plan_id: createdId, status: "generating", share_token: shareToken },
    202,
  );
});
