import Anthropic from "npm:@anthropic-ai/sdk@^0.70.0";

import { createLogger, describeError, type Logger } from "../../_shared/log.ts";
import {
  type GenerateArgs,
  type GenerateResult,
  type PlanProvider,
  ProviderRefusal,
} from "./types.ts";
import {
  AttemptTimeout,
  attemptTimeoutFor,
  backoffFor,
  type Budget,
  BudgetExhausted,
  canStartAttempt,
  DEFAULT_BUDGET,
  makeIsRetryable,
  remainingMs,
} from "./retry.ts";

/**
 * `output_config` (salida estructurada y `effort`), `thinking: adaptive` y
 * `stop_details` son de la API actual; el SDK fijado (0.70) todavía no los tipa, pero los pasa tal cual
 * en el cuerpo de la petición y deja la respuesta sin tocar. Se declaran aquí, en vez
 * de callar el compilador, para que `deno check` vigile el resto de la llamada.
 * Al subir el SDK a una versión que los traiga, estos tipos sobran.
 */
type OutputConfig = {
  effort?: string;
  format: { type: "json_schema"; schema: unknown };
};
type StreamParams = Omit<Anthropic.MessageStreamParams, "thinking"> & {
  thinking?: { type: "adaptive" } | Anthropic.ThinkingConfigParam;
  output_config: OutputConfig;
};
type RefusalDetails = { stop_details?: { category?: string | null } | null };

/**
 * Tried in order. Overload is per-model capacity, not per-account, so when
 * Sonnet is busy Haiku very often is not — and it is the *same* API, the same
 * schema and the same cached system prompt, so nothing about the contract
 * changes: still the plan's language, still a reference and never the verse
 * text, still every prohibition in the prompt. A cheaper day beats no day.
 *
 * Falling back to a different vendor would mean a second prompt to maintain and
 * re-validate on every change, no prompt cache, and quality drift nobody could
 * see. Falling back within Anthropic costs one entry in this list.
 *
 * The request shape differs by model: adaptive thinking and `effort` are 4.6+,
 * and Haiku 4.5 rejects both with a 400.
 */
const MODELS = [
  {
    id: "claude-sonnet-5",
    thinking: { type: "adaptive" as const },
    effort: "medium" as const,
  },
  { id: "claude-haiku-4-5", thinking: undefined, effort: undefined },
];

/**
 * `overloaded_error` means the API was momentarily busy, not that anything is
 * wrong with the request — and it does happen. Without a retry, a few seconds
 * of capacity pressure marked someone's whole plan as failed and left them
 * pressing "Reintentar" for a problem that had already passed.
 *
 * The SDK's own retries are OFF (`maxRetries: 0`) on purpose. They cover only
 * the *request*, and this call streams: once the stream is open an overload
 * surfaces from `finalMessage()`, past the point the SDK can help, so the whole
 * attempt has to be repeated here anyway. Two retry layers stacked multiply
 * each other; one layer, with one budget (`retry.ts`), does not.
 */
export type AnthropicProviderOptions = {
  /** Where the retries and fallbacks are reported. */
  logger?: Logger;
  /** Overrides of `DEFAULT_BUDGET`, mainly for tests. */
  budget?: Partial<Budget>;
  /** Injected so the retry loop can be tested without really waiting. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
};

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const createAnthropicProvider = (
  apiKey: string,
  options: AnthropicProviderOptions = {},
): PlanProvider => {
  const budget: Budget = { ...DEFAULT_BUDGET, ...options.budget };
  const logger =
    options.logger ?? createLogger("generate-prayer-plan", "no-request");
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;

  const isRetryable = makeIsRetryable({
    APIConnectionError: Anthropic.APIConnectionError,
    AnthropicError: Anthropic.AnthropicError,
  });

  // La clasificación por tipo depende de que el SDK exponga sus clases de error
  // como estáticas. Si una versión futura las mueve, no se rompe (se clasifica
  // solo por status y por el payload del stream), pero los errores de conexión
  // dejarían de reintentarse sin que nada lo diga: que al menos se vea.
  if (
    typeof Anthropic.APIConnectionError !== "function" ||
    typeof Anthropic.AnthropicError !== "function"
  ) {
    logger.warn("provider.sdk_error_classes_missing");
  }

  // `timeout` is the SDK's time to the first byte; the per-attempt `signal`
  // below is what bounds the whole stream. Without either, the default is ten
  // minutes — longer than the edge's own wall clock.
  const client = new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: budget.attemptTimeoutMs,
  });

  const attempt = async (
    { system, messages, schema }: GenerateArgs,
    model: (typeof MODELS)[number],
    timeoutMs: number,
  ): Promise<GenerateResult> => {
    const signal = AbortSignal.timeout(timeoutMs);
    let message;

    try {
      // Streaming is not optional here: a 30-day plan is a lot of output
      // tokens, and a non-streaming request at this max_tokens risks an HTTP
      // timeout well before the model is done.
      const params: StreamParams = {
        model: model.id,
        max_tokens: 64000,
        // Identical for every user, so it caches. Volatile content lives in
        // the user turn, after this breakpoint.
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          },
        ],
        ...(model.thinking ? { thinking: model.thinking } : {}),
        output_config: {
          ...(model.effort ? { effort: model.effort } : {}),
          format: { type: "json_schema", schema },
        },
        messages,
      };
      // El único punto donde se afirma el tipo del SDK: ver StreamParams arriba.
      const stream = client.messages.stream(
        params as Anthropic.MessageStreamParams,
        {
          signal,
          timeout: timeoutMs,
          maxRetries: 0,
        },
      );

      message = await stream.finalMessage();
    } catch (error) {
      // Our own timer fired: the SDK reports that as a user abort, which is not
      // retryable — but here it is exactly a slow attempt, and it is.
      if (signal.aborted) {
        throw new AttemptTimeout(model.id, timeoutMs);
      }

      throw error;
    }

    // Check before touching content: a refusal can come back with an empty
    // content array, and indexing into it blindly throws.
    if (message.stop_reason === "refusal") {
      throw new ProviderRefusal(
        (message as typeof message & RefusalDetails).stop_details?.category ??
          null,
      );
    }

    const text = message.content.find((block) => block.type === "text");

    if (!text || text.type !== "text") {
      throw new Error("Model returned no text block");
    }

    return {
      json: text.text,
      model: message.model,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens:
          message.usage.cache_creation_input_tokens ?? 0,
      },
    };
  };

  return {
    name: "anthropic",
    generate: async (args: GenerateArgs): Promise<GenerateResult> => {
      const deadline = args.deadline ?? now() + budget.totalMs;
      let lastError: unknown;
      let failedAttempts = 0;

      for (const [modelIndex, model] of MODELS.entries()) {
        for (let n = 1; n <= budget.maxAttemptsPerModel; n++) {
          const remaining = remainingMs(deadline, now());

          if (!canStartAttempt(remaining, budget)) {
            logger.warn("provider.budget_exhausted", {
              model: model.id,
              failed_attempts: failedAttempts,
              remaining_ms: remaining,
            });

            throw lastError ?? new BudgetExhausted();
          }

          try {
            const result = await attempt(
              args,
              model,
              attemptTimeoutFor(remaining, budget),
            );

            if (failedAttempts > 0) {
              logger.info("provider.recovered", {
                model: model.id,
                failed_attempts: failedAttempts,
              });
            }

            return result;
          } catch (error) {
            // A refusal is a decision, not a hiccup: repeating the same request
            // would only get the same answer back, from any model.
            if (error instanceof ProviderRefusal || !isRetryable(error)) {
              throw error;
            }

            lastError = error;
            failedAttempts += 1;

            logger.warn("provider.attempt_failed", {
              model: model.id,
              attempt: n,
              ...describeError(error),
            });

            if (n < budget.maxAttemptsPerModel) {
              const delay = backoffFor({
                error,
                attempt: n,
                remaining: remainingMs(deadline, now()),
                budget,
                random: options.random,
              });

              logger.warn("provider.retrying", {
                model: model.id,
                delay_ms: delay,
              });

              await sleep(delay);
            }
          }
        }

        if (modelIndex < MODELS.length - 1) {
          logger.warn("provider.fallback", { from_model: model.id });
        }
      }

      throw lastError;
    },
  };
};
