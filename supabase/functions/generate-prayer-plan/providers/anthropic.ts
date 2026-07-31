import Anthropic from "npm:@anthropic-ai/sdk@^0.70.0";

import {
  type GenerateArgs,
  type GenerateResult,
  type PlanProvider,
  ProviderRefusal,
} from "./types.ts";

const MODEL = "claude-sonnet-5";

/**
 * `overloaded_error` means the API was momentarily busy, not that anything is
 * wrong with the request — and it does happen. Without a retry, a few seconds
 * of capacity pressure marked someone's whole plan as failed and left them
 * pressing "Reintentar" for a problem that had already passed.
 *
 * The SDK's own `maxRetries` is not enough on its own: it retries the *request*,
 * and this call streams. Once the stream is open an overload surfaces from
 * `finalMessage()`, past the point the SDK can help, so the whole attempt has to
 * be repeated here.
 */
const MAX_ATTEMPTS = 4;

const RETRYABLE = new Set([
  "overloaded_error",
  "api_error",
  "rate_limit_error",
  "timeout_error",
]);

const isRetryable = (error: unknown) => {
  const status = (error as { status?: number }).status;

  if (status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }

  const type = (error as { error?: { error?: { type?: string } } })?.error
    ?.error?.type;

  if (type && RETRYABLE.has(type)) {
    return true;
  }

  // Streaming surfaces the payload as the message, so fall back to reading it.
  return RETRYABLE.has(
    (() => {
      try {
        return JSON.parse(String((error as Error).message))?.error?.type ?? "";
      } catch {
        return "";
      }
    })(),
  );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createAnthropicProvider = (apiKey: string): PlanProvider => {
  const client = new Anthropic({ apiKey });

  const attempt = async ({
    system,
    messages,
    schema,
  }: GenerateArgs): Promise<GenerateResult> => {
    // Streaming is not optional here: a 30-day plan is a lot of output
    // tokens, and a non-streaming request at this max_tokens risks an HTTP
    // timeout well before the model is done.
    const stream = client.messages.stream({
      model: MODEL,
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
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema },
      },
      messages,
    });

    const message = await stream.finalMessage();

    // Check before touching content: a refusal can come back with an empty
    // content array, and indexing into it blindly throws.
    if (message.stop_reason === "refusal") {
      throw new ProviderRefusal(message.stop_details?.category ?? null);
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
      let lastError: unknown;

      for (let n = 1; n <= MAX_ATTEMPTS; n++) {
        try {
          return await attempt(args);
        } catch (error) {
          // A refusal is a decision, not a hiccup: repeating the same request
          // would only get the same answer back.
          if (error instanceof ProviderRefusal || !isRetryable(error)) {
            throw error;
          }

          lastError = error;

          if (n < MAX_ATTEMPTS) {
            const backoff = 1000 * 2 ** (n - 1);
            console.warn(`anthropic busy, retrying in ${backoff}ms`);
            await wait(backoff);
          }
        }
      }

      throw lastError;
    },
  };
};
