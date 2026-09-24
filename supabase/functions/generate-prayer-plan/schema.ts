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
          interpretation: {
            type: "string",
            description:
              "Qué significa el pasaje, en español llano, entre 40 y 90 palabras. " +
              "Sin tecnicismos teológicos y conectado con la situación de la persona.",
          },
          daily_action: {
            type: "string",
            description:
              "Una sola acción concreta y pequeña para hoy, en español, en una o " +
              "dos frases. Debe poder hacerse en pocos minutos, depender solo de " +
              "la persona y no costar dinero.",
          },
          prayer_body: {
            type: "string",
            description:
              "Oración en primera persona, en español, entre 60 y 150 palabras.",
          },
          intercessor_prayer: {
            type: "string",
            description:
              "Oración para que OTRA PERSONA la rece por quien recorre el plan. " +
              "En español, entre 40 y 90 palabras. Dirígete a Dios hablando de " +
              "esa persona por su nombre y en tercera persona ('te pido por " +
              "Marta', nunca 'te pido por mí'). Concuerda el género con quien " +
              "recibe la oración, no con quien la reza. La leerán personas que " +
              "solo conocen el tema del plan, así que no repitas literalmente " +
              "lo que escribió ni añadas detalles que no haya compartido.",
          },
        },
        required: [
          "day_number",
          "title",
          "scripture_ref",
          "interpretation",
          "daily_action",
          "prayer_body",
          "intercessor_prayer",
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
  interpretation: string;
  daily_action: string;
  prayer_body: string;
  intercessor_prayer: string;
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
        Number.isInteger(d.day_number) &&
        d.day_number >= 1 &&
        typeof d.title === "string" &&
        typeof d.scripture_ref === "string" &&
        typeof d.interpretation === "string" &&
        typeof d.daily_action === "string" &&
        typeof d.prayer_body === "string" &&
        typeof d.intercessor_prayer === "string"
      );
    })
  );
};
