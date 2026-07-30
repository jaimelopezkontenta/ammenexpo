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
 * model validates the SHAPE of a plan, never its quality. In testing it happily
 * produced a fabricated Bible verse — which is precisely why the scripture
 * resolver exists, and why this provider must never be enabled in production.
 */
export const createOllamaProvider = (
  baseUrl: string,
  model: string,
): PlanProvider => ({
  name: "ollama",
  generate: async ({
    system,
    messages,
    schema,
  }: GenerateArgs): Promise<GenerateResult> => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: schema,
        options: { temperature: 0.7 },
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama responded ${response.status}: ${await response.text()}`,
      );
    }

    const payload = await response.json();
    const content = payload?.message?.content;

    if (typeof content !== "string") {
      throw new Error("Ollama returned no message content");
    }

    return { json: content, model: `ollama/${model}` };
  },
});
