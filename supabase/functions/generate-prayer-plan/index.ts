import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@^2.58.0";

import { CORS_USER, jsonWith, preflight } from "../_shared/http.ts";
import {
  createLogger,
  describeError,
  type Logger,
  requestIdFrom,
} from "../_shared/log.ts";
import { buildRepairPrompt, buildUserPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { MAX_DAYS, MIN_DAYS } from "./bounds.ts";
import { deriveChunkRequestId } from "./chunkRequestId.ts";
import { isTransientAuthError } from "./authErrors.ts";
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
import {
  resolveDays,
  ScriptureLookupError,
  unresolved,
  type ResolvedDay,
} from "./scripture.ts";

const json = jsonWith(CORS_USER);

/**
 * Long enough for a full stretch, short enough that a dead invocation does not
 * hold the plan hostage. It matches the client's own "stuck after five
 * minutes" threshold, so the two agree on when a generation is truly gone.
 * The database clamps this both ways (30s floor, 1h ceiling).
 *
 * El presupuesto de tiempo del proveedor (`providers/retry.ts`) termina 30 s
 * antes que este lease a propósito: si un tramo lo sobrepasara, otro isolate
 * podría reclamarlo y el `complete_generation_chunk` de este se rechazaría
 * después de haber pagado al modelo.
 */
const LEASE_SECONDS = 300;

/**
 * El siguiente tramo contesta 202 en cuanto reclama su lease; si tarda más que
 * esto, el plan conserva lo que tiene y la persona puede pulsar «Continuar».
 */
const NEXT_CHUNK_TIMEOUT_MS = 15_000;

/**
 * Work continues after the response is sent. The isolate still has a time
 * budget, which is exactly why a stretch has to be small enough to finish
 * inside it.
 *
 * Nada de lo que falle ahí dentro tiene a quién avisar (el cliente ya recibió
 * el 202), así que un rechazo no capturado se registra en vez de perderse.
 */
const runInBackground = (promise: Promise<unknown>, logger: Logger) => {
  const guarded = promise.catch((error) => {
    logger.error("background.crashed", describeError(error));
  });

  const runtime = (
    globalThis as {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
    }
  ).EdgeRuntime;

  if (runtime?.waitUntil) {
    runtime.waitUntil(guarded);
  } else {
    void guarded;
  }
};

const selectProvider = (logger: Logger): PlanProvider => {
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

  return createAnthropicProvider(apiKey, { logger });
};

type PlanRow = {
  id: string;
  owner_id: string;
  duration_days: number;
  start_date: string;
  status: string;
  /**
   * Un jsonb que nadie validó al guardarlo: `answers` se lee siempre a través de
   * `promptAnswersFrom`, nunca por campo.
   */
  source_prompt: { answers?: unknown } | null;
};

// A client-supplied `request_id` is an idempotency key. `parseGenerateBody`
// keeps it only if it is a UUID; anything else is replaced here, so a malformed
// value can never collide. (It is not the correlation id of the logs: that one
// is `x-request-id`.)
const idempotencyKeyFrom = (requestId: string | null): string =>
  requestId ?? crypto.randomUUID();

/**
 * Asks this same function to write the next stretch, in a fresh isolate.
 *
 * Es un extra, no una condición: si no sale, el plan conserva los días que ya
 * tiene y la persona sigue pudiendo orar hoy (el cliente ofrece «Continuar»).
 * Por eso un fallo aquí se registra y no se propaga — pero se registra, con el
 * status si el siguiente tramo lo rechazó. Reenvía el `x-request-id` para que
 * los logs de todos los tramos de un plan compartan id de correlación.
 */
const requestNextChunk = async (
  planId: string,
  authHeader: string,
  logger: Logger,
) => {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-prayer-plan`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          "Content-Type": "application/json",
          "x-request-id": logger.requestId,
        },
        body: JSON.stringify({
          continue_plan_id: planId,
          request_id: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(NEXT_CHUNK_TIMEOUT_MS),
      },
    );

    // Solo interesa el status; soltar el cuerpo evita dejar la conexión abierta.
    await response.body?.cancel();

    if (!response.ok) {
      logger.warn("next_chunk.rejected", {
        plan_id: planId,
        status: response.status,
      });
    }
  } catch (error) {
    logger.error("next_chunk.unreachable", {
      plan_id: planId,
      ...describeError(error),
    });
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
  logger: Logger;
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

/**
 * A failure is settled through the lease, so a provider failure cannot leave
 * an eternal lease — and the lease itself is the fence: if it has expired or
 * been reclaimed, `fail_generation_chunk` refuses and the stale invocation
 * cannot mark the plan failed.
 */
const failChunk = async (args: ChunkArgs, reason: string) => {
  const { supabase, plan, leaseId, authHeader, logger } = args;

  const { data: failRows, error: failError } = await supabase.rpc(
    "fail_generation_chunk",
    {
      p_lease_id: leaseId,
      p_error: reason,
    },
  );

  if (failError) {
    // No hay a quién propagarlo: el lease vencerá solo y el plan podrá
    // reclamarse. Queda dicho con el motivo original.
    logger.error("chunk.fail_unrecorded", {
      plan_id: plan.id,
      reason,
      ...describeError(failError),
    });
    return;
  }

  const fail = (failRows ?? [])[0];

  logger.warn("chunk.failed", {
    plan_id: plan.id,
    from_day: args.fromDay,
    to_day: args.toDay,
    reason,
    settled: Boolean(fail?.ok),
    plan_failed: Boolean(fail?.plan_failed),
    will_retry: Boolean(fail?.ok && fail.retry),
  });

  // The server decides — from the append-only ledger, not from the client —
  // whether the first stretch deserves another isolate. A later stretch just
  // keeps the days it already has; nothing is thrown away.
  if (fail?.ok && fail.retry) {
    await requestNextChunk(plan.id, authHeader, logger);
  }
};

const generateChunk = async (args: ChunkArgs) => {
  const {
    supabase,
    provider,
    plan,
    displayName,
    fromDay,
    toDay,
    leaseId,
    authHeader,
    logger,
  } = args;

  const isFirstChunk = fromDay === 1;

  // Not a plain select: prayer_plan_days hides days whose unlock_date is in the
  // future, even from the owner, so a direct query would report only the days
  // already unlocked and the generator would rewrite the rest.
  //
  // Su error NO se ignora: sin la lista de días ya escritos el modelo escribiría
  // como si empezara de cero y repetiría pasajes. Es una lectura barata — si
  // falla, se falla el tramo (recuperable) antes de pagar al modelo.
  const { data: existing, error: existingError } = await supabase.rpc(
    "plan_written_days",
    { p_plan_id: plan.id },
  );

  if (existingError) {
    logger.error("chunk.history_unavailable", {
      plan_id: plan.id,
      ...describeError(existingError),
    });
    await failChunk(args, "history_unavailable");
    return;
  }

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
    logger.error("chunk.generation_failed", {
      plan_id: plan.id,
      from_day: fromDay,
      to_day: toDay,
      ...describeError(error),
    });
    const reason =
      error instanceof ProviderRefusal
        ? "refused"
        : error instanceof AttemptTimeout || error instanceof BudgetExhausted
          ? "generation_timeout"
          : "generation_failed";
    await failChunk(args, reason);
    return;
  }

  if (result.usage) {
    // cache_read_input_tokens should be non-zero from the second stretch
    // onward. If it stays at zero something varies inside the system prompt,
    // and the per-user cost roughly triples.
    logger.info("chunk.generated", {
      plan_id: plan.id,
      from_day: fromDay,
      to_day: toDay,
      model: result.model,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      cache_read_tokens: result.usage.cache_read_input_tokens,
      cache_write_tokens: result.usage.cache_creation_input_tokens,
    });
  }

  let generated;

  try {
    generated = JSON.parse(result.json);
  } catch {
    await failChunk(args, "invalid_model_output");
    return;
  }

  if (!isGeneratedPlan(generated) || generated.days.length === 0) {
    await failChunk(args, "invalid_model_output");
    return;
  }

  // Scripture validation: the gate that keeps invented verses out. Anything
  // that does not resolve against the real RVR1909 text gets one repair
  // attempt; if it still fails the day ships WITHOUT a verse rather than with
  // a fabricated one.
  //
  // Una búsqueda que NO PUDO responder no es una referencia que no existe: se
  // falla el tramo (recuperable) en vez de mandar una pasada de reparación por
  // versículos reales o dejarlos salir sin texto para siempre.
  let days: ResolvedDay[];

  try {
    days = await resolveDays(supabase, generated.days);
  } catch (error) {
    if (!(error instanceof ScriptureLookupError)) throw error;

    logger.error("chunk.scripture_lookup_failed", {
      plan_id: plan.id,
      failed: error.failed,
      error_code: error.code,
    });
    await failChunk(args, "scripture_lookup_failed");
    return;
  }

  let bad = unresolved(days);

  // The repair is a nicety: with too little of the budget left it is skipped
  // and the days ship without those verses, exactly as if it had failed.
  const canRepair =
    remainingMs(deadline, Date.now()) >= DEFAULT_BUDGET.repairMinRemainingMs;

  if (bad.length > 0 && !canRepair) {
    logger.warn("chunk.repair_skipped", {
      plan_id: plan.id,
      unresolved: bad.length,
      remaining_ms: remainingMs(deadline, Date.now()),
    });
  }

  if (bad.length > 0 && canRepair) {
    // Cuántas, no cuáles: la referencia la escribió el modelo.
    logger.warn("chunk.unresolved_references", {
      plan_id: plan.id,
      unresolved: bad.length,
    });

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
      logger.warn("chunk.repair_failed", {
        plan_id: plan.id,
        ...describeError(error),
      });
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
    logger.error("chunk.persist_failed", {
      plan_id: plan.id,
      ...describeError(completeError),
    });
    // The client already got 202. Swallowing this would leave the lease
    // held after we paid for the model — fail/settle so the plan can recover.
    await failChunk(args, "persist_failed");
    return;
  }

  if (!complete?.ok) {
    logger.warn("chunk.lease_lost", {
      plan_id: plan.id,
      from_day: fromDay,
      to_day: toDay,
      reason: complete?.reason,
    });
    return;
  }

  logger.info("chunk.completed", {
    plan_id: plan.id,
    from_day: fromDay,
    to_day: toDay,
    days_written: slotted.length,
    without_verse: bad.length,
    is_complete: Boolean(complete.is_complete),
  });

  // Only continue while the stretch actually produced days, so a model that
  // returns nothing cannot spin this forever. `is_complete` comes from the
  // database (days written vs. promised), not from what the model returned.
  if (!complete.is_complete) {
    await requestNextChunk(plan.id, authHeader, logger);
  }
};

/**
 * Lo que corre tras el 202. Cualquier excepción que se escape de `generateChunk`
 * (un fallo de red que lance en vez de devolver `error`, un bug) no puede dejar
 * el lease agarrado hasta que caduque: se registra y se salda por el mismo
 * camino que un fallo normal, que además decide si merece otro intento.
 */
const writeChunk = async (args: ChunkArgs) => {
  try {
    await generateChunk(args);
  } catch (error) {
    args.logger.error("chunk.crashed", {
      plan_id: args.plan.id,
      from_day: args.fromDay,
      to_day: args.toDay,
      ...describeError(error),
    });

    await failChunk(args, "internal_error").catch((settleError) => {
      args.logger.error("chunk.crash_unsettled", describeError(settleError));
    });
  }
};

const handle = async (req: Request, requestLogger: Logger) => {
  let logger = requestLogger;

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    logger.warn("auth.missing");
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    // Una condición de despliegue, no un fallo de esta petición: como las demás
    // funciones, 503 con una etiqueta fija (nunca la URL ni la clave).
    logger.error("env.missing");
    return json({ error: "not_configured" }, 503);
  }

  // Deliberately the user's client, not the service role: every write below
  // still passes through RLS, so a bug here cannot touch someone else's plan.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    // Que el servicio de auth no conteste NO es que la sesión sea inválida: un
    // 401 haría que la app creyera que hay que volver a entrar.
    if (isTransientAuthError(userError)) {
      logger.error("auth.unavailable", describeError(userError));
      return json({ error: "auth_unavailable" }, 503);
    }

    logger.warn("auth.rejected");
    return json({ error: "unauthorized" }, 401);
  }

  logger = createLogger("generate-prayer-plan", logger.requestId, {
    user_id: user.id,
  });

  // Shape and bounds of everything the caller sent, decided before any read
  // of the database or any call to the model. A rejection is a clean 400 with
  // a stable reason, never a 500 from Postgres choking on a malformed value.
  const read = await readJsonBody(req);

  if (!read.ok) {
    logger.warn("input.rejected", { ...read.rejection });
    return json(read.rejection, 400);
  }

  const parsed = parseGenerateBody(read.body);

  if (!parsed.ok) {
    logger.warn("input.rejected", { ...parsed.rejection });
    return json(parsed.rejection, 400);
  }

  const request = parsed.value;

  // Solo formas y cuentas, nunca el contenido (el tema libre es texto de la
  // persona).
  logger.info(
    "request.accepted",
    request.kind === "continue"
      ? { kind: request.kind, plan_id: request.planId }
      : {
          kind: request.kind,
          duration_days: request.durationDays,
          visibility: request.visibility,
          topics: request.topics.length,
          custom_topic_chars: request.customTopic?.length ?? 0,
          circles: request.circleIds.length,
          circle_plan: request.groupId !== null,
        },
  );

  let provider: PlanProvider;

  try {
    provider = selectProvider(logger);
  } catch (error) {
    logger.error("provider.misconfigured", describeError(error));
    return json({ error: "provider_unavailable" }, 503);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (profileError) {
    logger.error("profile.unavailable", describeError(profileError));
    return json({ error: "profile_unavailable" }, 500);
  }

  // A name is data on its way into a prompt, not an instruction.
  const displayName = sanitizeDisplayName(profile?.display_name);

  // --- Continuation: write the next stretch of an existing plan ------------
  if (request.kind === "continue") {
    const { data: plan, error: planError } = await supabase
      .from("prayer_plans")
      .select("id, owner_id, duration_days, start_date, status, source_prompt")
      .eq("id", request.planId)
      .maybeSingle();

    // Un error de lectura no es «ese plan no existe»: contestar 404 le decía a
    // la app que el plan de la persona había desaparecido por un fallo pasajero.
    if (planError) {
      logger.error("plan.unavailable", describeError(planError));
      return json({ error: "plan_unavailable" }, 500);
    }

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
      logger.error("claim.failed", {
        plan_id: plan.id,
        ...describeError(claimError),
      });
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
      logger.error("claim.no_reservation", { plan_id: plan.id });
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
      logger.info("chunk.claimed", {
        plan_id: plan.id,
        from_day: claim.from_day,
        to_day: claim.to_day,
      });

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
          logger,
        }),
        logger,
      );

      return json(
        { plan_id: plan.id, from_day: claim.from_day, to_day: claim.to_day },
        202,
      );
    }

    logger.error("claim.unexpected", {
      plan_id: plan.id,
      reason: claim?.reason ?? "no_row",
    });
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
    logger.error("settings.unavailable", describeError(settingsError));
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
    logger.error("reserve.failed", describeError(reserveError));
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

    logger.error("reserve.unexpected", { reason: reserve?.reason ?? "no_row" });
    return json({ error: "reservation_failed" }, 500);
  }

  const createdId = reserve.plan_id;

  logger.info("plan.reserved", {
    plan_id: createdId,
    created: Boolean(reserve.created),
    quota_used: reserve.quota_used,
    quota_limit: reserve.quota_limit,
  });

  let shareToken: string | null = null;

  // Circle shares were created atomically with the reservation, so a failed
  // share can no longer leave a plan whose quota is burned but whose circles
  // are empty. The public link is an optional extra, attached only on a fresh
  // creation.
  //
  // Su fallo es de los que SÍ se toleran, y por eso se registra en vez de
  // propagarse: el plan ya existe y la cuota ya está gastada, así que devolver
  // un error aquí haría que la app reintentara —con la misma clave— sobre una
  // reserva que ya no crea el enlace (`created` sería falso), perdiéndolo igual.
  // La pantalla de compartir lee el enlace por su cuenta y puede crearlo. Va
  // ANTES de releer el plan para que un fallo de esa lectura (que sí se
  // reintenta) no se lleve el enlace por delante.
  if (reserve.created && visibility === "link") {
    const { data: link, error: linkError } = await supabase
      .from("share_links")
      .insert({ scope: "plan", plan_id: createdId, created_by: user.id })
      .select("token")
      .single();

    if (linkError) {
      logger.warn("share_link.failed", {
        plan_id: createdId,
        ...describeError(linkError),
      });
    }

    shareToken = link?.token ?? null;
  }

  // Read back the row the reservation created, so the generator works from the
  // exact start_date the database stored.
  //
  // Su error NO es tolerable: sin la fila no hay quien escriba el plan, y la
  // respuesta 202 diría «generating» sobre un plan al que nadie va a dar
  // contenido. Se responde 500 antes de reclamar el tramo: la cuota ya está
  // gastada pero la reserva es idempotente, así que reintentar con la misma
  // clave devuelve este mismo plan y sigue desde aquí.
  const { data: created, error: createdError } = await supabase
    .from("prayer_plans")
    .select("id, owner_id, duration_days, start_date, status, source_prompt")
    .eq("id", createdId)
    .single();

  if (createdError || !created) {
    logger.error("plan.readback_failed", {
      plan_id: createdId,
      ...describeError(createdError),
    });
    return json({ error: "persist_failed" }, 500);
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
    logger.error("claim.failed", {
      plan_id: createdId,
      ...describeError(claimError),
    });
    return json({ error: "persist_failed" }, 500);
  }

  const claim = (claimRows ?? [])[0];

  if (claim?.reason === "claimed") {
    logger.info("chunk.claimed", {
      plan_id: createdId,
      from_day: claim.from_day,
      to_day: claim.to_day,
    });

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
        logger,
      }),
      logger,
    );
  } else if (
    claim?.reason !== "already" &&
    claim?.reason !== "in_flight" &&
    claim?.reason !== "complete"
  ) {
    // Un reintento del mismo alta (`already`), otro isolate ya escribiéndolo
    // (`in_flight`) o un plan ya escrito (`complete`) son respuestas normales: el
    // 202 de siempre. Cualquier otra cosa —ninguna fila, un motivo de rechazo—
    // significa que NADIE va a generar este plan, y contestar 202 «generating»
    // lo dejaría esperando en falso hasta que la app lo dé por atascado.
    logger.error("claim.unexpected", {
      plan_id: createdId,
      reason: claim?.reason ?? "no_row",
    });
    return json({ error: "claim_failed" }, 500);
  }

  return json(
    { plan_id: createdId, status: "generating", share_token: shareToken },
    202,
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflight(CORS_USER);
  }

  const logger = createLogger(
    "generate-prayer-plan",
    requestIdFrom(req.headers),
  );

  try {
    return await handle(req, logger);
  } catch (error) {
    // Sin este `catch`, una excepción no prevista sale como un 500 sin cabeceras
    // CORS: el navegador lo ve como un fallo de red, no como un 500.
    logger.error("request.crashed", describeError(error));
    return json({ error: "internal_error" }, 500);
  }
});
