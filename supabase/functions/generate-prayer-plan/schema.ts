import type { PlanLocale } from "./locale.ts";

/**
 * Lo que el esquema le dice al modelo de cada campo. El modelo lee estas
 * descripciones igual que el prompt, así que van en el idioma del plan: un
 * esquema que dijera «en español» debajo de un prompt en inglés le daría dos
 * órdenes contrarias.
 */
type SchemaDescriptions = {
  title: string;
  theme: string;
  dayTitle: string;
  scriptureRef: string;
  interpretation: string;
  dailyAction: string;
  prayerBody: string;
  intercessorPrayer: string;
};

/**
 * Shape the model must return.
 *
 * Note what is NOT here: `scripture_text`. The model only ever chooses a
 * reference; the text is looked up in the Bible table, in the version of the
 * plan's language (RVR1909 or WEB). Letting a model write the verse is how you
 * end up quoting a Filipenses 4:6-7 that does not exist.
 *
 * La misma forma para los dos idiomas; solo cambian las descripciones. El
 * orden de las claves es el de siempre: el esquema español sale byte a byte
 * igual que cuando era un literal (`prompt.test.ts` lo fija).
 */
const planJsonSchema = (d: SchemaDescriptions) =>
  ({
    type: "object",
    properties: {
      title: {
        type: "string",
        description: d.title,
      },
      theme: {
        type: "string",
        description: d.theme,
      },
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            day_number: { type: "integer" },
            title: {
              type: "string",
              description: d.dayTitle,
            },
            scripture_ref: {
              type: "string",
              description: d.scriptureRef,
            },
            interpretation: {
              type: "string",
              description: d.interpretation,
            },
            daily_action: {
              type: "string",
              description: d.dailyAction,
            },
            prayer_body: {
              type: "string",
              description: d.prayerBody,
            },
            intercessor_prayer: {
              type: "string",
              description: d.intercessorPrayer,
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
  }) as const;

export const PLAN_JSON_SCHEMA = planJsonSchema({
  title: "Título del plan, en español, máximo 60 caracteres.",
  theme: "Tema central en pocas palabras, en español.",
  dayTitle: "Título del día, en español, máximo 60 caracteres.",
  scriptureRef:
    "Referencia bíblica en español, formato 'Libro Capítulo:Versículo' " +
    "o 'Libro Capítulo:Inicio-Fin'. Nunca incluyas el texto del versículo.",
  interpretation:
    "Qué significa el pasaje, en español llano, entre 40 y 90 palabras. " +
    "Sin tecnicismos teológicos y conectado con la situación de la persona.",
  dailyAction:
    "Una sola acción concreta y pequeña para hoy, en español, en una o " +
    "dos frases. Debe poder hacerse en pocos minutos, depender solo de " +
    "la persona y no costar dinero.",
  prayerBody:
    "Oración en primera persona, en español, entre 60 y 150 palabras.",
  intercessorPrayer:
    "Oración para que OTRA PERSONA la rece por quien recorre el plan. " +
    "En español, entre 40 y 90 palabras. Dirígete a Dios hablando de " +
    "esa persona por su nombre y en tercera persona ('te pido por " +
    "Marta', nunca 'te pido por mí'). Concuerda el género con quien " +
    "recibe la oración, no con quien la reza. La leerán personas que " +
    "solo conocen el tema del plan, así que no repitas literalmente " +
    "lo que escribió ni añadas detalles que no haya compartido.",
});

export const PLAN_JSON_SCHEMA_EN = planJsonSchema({
  title: "Title of the plan, in English, 60 characters at most.",
  theme: "Central theme in a few words, in English.",
  dayTitle: "Title of the day, in English, 60 characters at most.",
  scriptureRef:
    "Bible reference with the book name in English, format " +
    "'Book Chapter:Verse' or 'Book Chapter:Start-End'. Never include the " +
    "text of the verse.",
  interpretation:
    "What the passage means, in plain English, between 40 and 90 words. " +
    "No theological jargon, and connected with the person's situation.",
  dailyAction:
    "One single small, concrete action for today, in English, in one or " +
    "two sentences. It must be doable in a few minutes, depend only on " +
    "the person and cost no money.",
  prayerBody:
    "Prayer in the first person, in English, between 60 and 150 words.",
  intercessorPrayer:
    "Prayer for ANOTHER PERSON to pray for the one walking the plan. " +
    "In English, between 40 and 90 words. Address God speaking about " +
    "that person by name and in the third person ('I pray for Marta', " +
    "never 'I pray for myself'). Match the pronouns to the person " +
    "receiving the prayer, not the one praying it. It will be read by " +
    "people who only know the topic of the plan, so do not repeat word " +
    "for word what they wrote or add details they have not shared.",
});

/** El esquema de salida en el idioma del plan. */
export const planJsonSchemaFor = (locale: PlanLocale) =>
  locale === "en" ? PLAN_JSON_SCHEMA_EN : PLAN_JSON_SCHEMA;

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
