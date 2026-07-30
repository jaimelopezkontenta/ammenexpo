export type ProviderMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateArgs = {
  system: string;
  messages: ProviderMessage[];
  schema: unknown;
};

export type GenerateResult = {
  /** Raw JSON text; the caller validates it against the schema. */
  json: string;
  model: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
};

export type PlanProvider = {
  name: string;
  generate: (args: GenerateArgs) => Promise<GenerateResult>;
};

/** Raised when the model declines the request rather than failing technically. */
export class ProviderRefusal extends Error {
  constructor(public category: string | null) {
    super(`Model refused the request (${category ?? "unspecified"})`);
    this.name = "ProviderRefusal";
  }
}
