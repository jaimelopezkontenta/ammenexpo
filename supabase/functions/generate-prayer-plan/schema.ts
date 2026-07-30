/**
 * Shape the model must return.
 *
 * Note what is NOT here: `scripture_text`. The model only ever chooses a
 * reference; the text is looked up in the RVR1909 table. Letting a model write
 * the verse is how you end up quoting a Filipenses 4:6-7 that does not exist.
 */
export const PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Título del plan, en español, máximo 60 caracteres.",
    },
    theme: {
      type: "string",
      description: "Tema central en pocas palabras, en español.",
    },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day_number: { type: "integer" },
          title: {
            type: "string",
            description: "Título del día, en español, máximo 60 caracteres.",
          },
          scripture_ref: {
            type: "string",
            description:
              "Referencia bíblica en español, formato 'Libro Capítulo:Versículo' " +
              "o 'Libro Capítulo:Inicio-Fin'. Nunca incluyas el texto del versículo.",
          },
          prayer_body: {
            type: "string",
            description:
              "Oración en primera persona, en español, entre 60 y 150 palabras.",
          },
          reflection_question: {
            type: "string",
            description: "Una sola pregunta de reflexión, en español.",
          },
        },
        required: [
          "day_number",
          "title",
          "scripture_ref",
          "prayer_body",
          "reflection_question",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "theme", "days"],
  additionalProperties: false,
} as const;

export type GeneratedDay = {
  day_number: number;
  title: string;
  scripture_ref: string;
  prayer_body: string;
  reflection_question: string;
};

export type GeneratedPlan = {
  title: string;
  theme: string;
  days: GeneratedDay[];
};

export const isGeneratedPlan = (value: unknown): value is GeneratedPlan => {
  if (typeof value !== "object" || value === null) return false;

  const plan = value as Record<string, unknown>;

  return (
    typeof plan.title === "string" &&
    typeof plan.theme === "string" &&
    Array.isArray(plan.days) &&
    plan.days.every((day) => {
      const d = day as Record<string, unknown>;
      return (
        typeof d.day_number === "number" &&
        typeof d.title === "string" &&
        typeof d.scripture_ref === "string" &&
        typeof d.prayer_body === "string" &&
        typeof d.reflection_question === "string"
      );
    })
  );
};
