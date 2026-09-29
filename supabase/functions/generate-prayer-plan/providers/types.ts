import type { PlanLocale } from "../locale.ts";

export type ProviderMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateArgs = {
  system: string;
  messages: ProviderMessage[];
  schema: unknown;
  /**
   * Hasta cuándo puede tardar esta llamada, en ms desde la época (`Date.now()`).
   * Lo fija quien orquesta el tramo UNA vez, para que la generación y la pasada
   * de reparación gasten del mismo presupuesto (ver `retry.ts`). Sin él, cada
   * llamada parte de un presupuesto completo.
   */
  deadline?: number;
  /**
   * El idioma del plan. Los proveedores reales no lo necesitan (ya va en el
   * prompt y en el esquema); lo lee el de pruebas, que no lee el prompt y
   * tiene que contestar en el mismo idioma.
   */
  locale?: PlanLocale;
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
