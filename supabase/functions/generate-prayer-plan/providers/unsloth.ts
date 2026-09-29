import {
  type GenerateArgs,
  type GenerateResult,
  type PlanProvider,
} from "./types.ts";

/**
 * DEVELOPMENT ONLY.
 *
 * Lets us exercise persistence, scripture validation and the UI end to end
 * without an Anthropic key. It is a test fixture, not a fallback: a small local
 * model validates the SHAPE of a plan, never its quality. In testing a local
 * model happily produced a fabricated Bible verse — which is precisely why the
 * scripture resolver exists, and why this provider must never be enabled in
 * production.
 *
 * Talks to Unsloth Studio's OpenAI-compatible server (default
 * http://127.0.0.1:8888/v1 on the host; from inside the functions container
 * that is host.docker.internal:8888). Structured output rides on
 * `response_format: json_schema`.
 */
export const createUnslothProvider = (
  baseUrl: string,
  model: string,
  apiKey: string,
): PlanProvider => ({
  name: "unsloth",
  generate: async ({
    system,
    messages,
    schema,
  }: GenerateArgs): Promise<GenerateResult> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.7,
        enable_thinking: false,
        response_format: {
          type: "json_schema",
          json_schema: { name: "plan", strict: false, schema },
        },
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Unsloth Studio responded ${response.status}: ${await response.text()}`,
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("Unsloth Studio returned no message content");
    }

    return { json: content, model: `unsloth/${model}` };
  },
});
