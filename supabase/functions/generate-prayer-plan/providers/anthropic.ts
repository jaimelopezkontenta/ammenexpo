import Anthropic from "npm:@anthropic-ai/sdk@^0.70.0";

import {
  type GenerateArgs,
  type GenerateResult,
  type PlanProvider,
  ProviderRefusal,
} from "./types.ts";

const MODEL = "claude-sonnet-5";

export const createAnthropicProvider = (apiKey: string): PlanProvider => {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    generate: async ({
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
    },
  };
};
