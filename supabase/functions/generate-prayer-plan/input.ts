/**
 * Lo que `generate-prayer-plan` acepta de fuera, con esquema explícito.
 *
 * Antes cada campo se comprobaba «lo justo» en su sitio: `typeof === "string"`
 * y a la base. Un `group_id` que no fuera un UUID llegaba hasta Postgres y
 * volvía como un 500 `persist_failed`; un `topics` con cualquier cadena se
 * guardaba en `source_prompt`. Aquí se decide todo antes de tocar la base ni el
 * modelo, y un rechazo es un 400 con un motivo estable que el cliente puede
 * leer (`{ error: "invalid_group_id", reason: "not_uuid" }`).
 *
 * Las listas cerradas (`TOPIC_KEYS`, `SEASON_KEYS`, `GENDER_KEYS`) son copia de
 * las del cliente (`core/onboarding/options.ts`): una función de Deno no puede
 * importarlas, y `input.test.ts` comprueba que siguen iguales. La de idiomas
 * (`PLAN_LOCALES`) vive en `locale.ts`.
 */

import {
  isAbsent,
  isRecord,
  isUuid,
  parseAllowlist,
  parseBoundedText,
  parseOptionalEnum,
  parseOptionalUuid,
  parseUuidList,
  type Reason,
} from "../_shared/validate.ts";
import { checkDuration } from "./bounds.ts";
import {
  DEFAULT_PLAN_LOCALE,
  PLAN_LOCALES,
  type PlanLocale,
} from "./locale.ts";

export const SEASON_KEYS = [
  "grief",
  "anxiety",
  "work",
  "family",
  "health",
  "decision",
  "gratitude",
  "faith",
  "loneliness",
  "relationship",
  "breakup",
  "money",
  "children",
  "studies",
  "farFromHome",
  "lovedOneIll",
] as const;

export const TOPIC_KEYS = [
  "peace",
  "wisdom",
  "health",
  "family",
  "provision",
  "forgiveness",
  "purpose",
  "gratitude",
  "strength",
  "patience",
  "hope",
  "protection",
  "guidance",
  "comfort",
  "rest",
  "courage",
] as const;

export const GENDER_KEYS = ["feminine", "masculine", "neutral"] as const;

export const VISIBILITIES = ["private", "circles", "link", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Topes. Todos generosos para un uso real y estrechos para un abuso. */
export const LIMITS = {
  /** Un cuerpo legítimo cabe en unos cientos de bytes; esto es margen. */
  bodyChars: 16 * 1024,
  /** No hay tope de círculos por persona; ningún formulario marca tantos. */
  circleIds: 50,
  /** Las dieciséis claves, con margen para repetidos (que se quitan). */
  topics: TOPIC_KEYS.length * 2,
  /** Lo que se guarda y se pasa al modelo. */
  customTopic: 200,
  /** Por encima, no es alguien escribiendo: se rechaza en vez de recortar. */
  customTopicHard: 1000,
} as const;

export type NewPlanRequest = {
  kind: "new";
  /** La clave de idempotencia del cliente, si es un UUID; si no, `null`. */
  requestId: string | null;
  /** El idioma en que se escribe el plan; se guarda con él (`locale.ts`). */
  locale: PlanLocale;
  durationDays: number;
  visibility: Visibility;
  topics: string[];
  customTopic: string | null;
  groupId: string | null;
  circleIds: string[];
};

export type ContinuePlanRequest = {
  kind: "continue";
  planId: string;
  requestId: string | null;
  /**
   * El idioma que declara quien pide el tramo. No decide: el plan ya tiene el
   * suyo (`planLocaleFrom`) y es el que se usa; este solo se valida y se
   * registra.
   */
  locale: PlanLocale;
};

export type GenerateRequest = NewPlanRequest | ContinuePlanRequest;

/** El cuerpo de un 400: `error` es estable; `reason` dice por qué. */
export type InputRejection = {
  error: string;
  reason?: Reason | "invalid_json" | "too_large";
  min?: number;
  max?: number;
};

export type ParsedRequest =
  | { ok: true; value: GenerateRequest }
  | { ok: false; rejection: InputRejection };

const reject = (
  error: string,
  reason?: InputRejection["reason"],
): { ok: false; rejection: InputRejection } => ({
  ok: false,
  rejection: { error, reason },
});

/**
 * Valida un cuerpo ya parseado. Un campo ausente (`undefined` o `null`) es
 * «no lo mandó»; cualquier otro valor tiene que ser exactamente del tipo
 * pedido. Los campos que no conoce se ignoran (un cliente más nuevo puede
 * mandar más).
 */
export const parseGenerateBody = (body: unknown): ParsedRequest => {
  if (!isRecord(body)) return reject("invalid_body", "not_object");

  // La clave de idempotencia NO se rechaza si está mal formada: se sustituye
  // por una nueva (así un valor raro nunca choca con la de otra persona).
  const requestId = isUuid(body.request_id) ? body.request_id : null;

  // El idioma, en los dos caminos. Ausente es español: los clientes de antes
  // no lo mandaban y sus planes se escribían en español. Cualquier otro valor
  // que no esté en la lista es un 400, como la visibilidad: lo que llega al
  // prompt y a la Biblia es siempre uno de los conocidos.
  const locale = parseOptionalEnum(body.locale, PLAN_LOCALES);
  if (!locale.ok) return reject("invalid_locale", locale.reason);

  const planLocale = locale.value ?? DEFAULT_PLAN_LOCALE;

  // --- Continuación: el siguiente tramo de un plan que ya existe -----------
  if (!isAbsent(body.continue_plan_id)) {
    return isUuid(body.continue_plan_id)
      ? {
          ok: true,
          value: {
            kind: "continue",
            planId: body.continue_plan_id,
            requestId,
            locale: planLocale,
          },
        }
      : reject("invalid_continue_plan_id", "not_uuid");
  }

  // --- Plan nuevo -----------------------------------------------------------
  const duration = checkDuration(body.duration_days ?? 7);

  if (!duration.ok) {
    return {
      ok: false,
      rejection: {
        error: "invalid_duration",
        min: duration.min,
        max: duration.max,
      },
    };
  }

  const visibility = parseOptionalEnum(body.visibility, VISIBILITIES);
  if (!visibility.ok) return reject("invalid_visibility", visibility.reason);

  const topics = parseAllowlist(body.topics, TOPIC_KEYS, {
    max: LIMITS.topics,
  });
  if (!topics.ok) return reject("invalid_topics", topics.reason);

  const customTopic = parseBoundedText(body.custom_topic, {
    max: LIMITS.customTopic,
    hardMax: LIMITS.customTopicHard,
  });
  if (!customTopic.ok)
    return reject("invalid_custom_topic", customTopic.reason);

  const groupId = parseOptionalUuid(body.group_id);
  if (!groupId.ok) return reject("invalid_group_id", groupId.reason);

  const circleIds = parseUuidList(body.circle_ids, { max: LIMITS.circleIds });
  if (!circleIds.ok) return reject("invalid_circle_ids", circleIds.reason);

  // Ya lo decía el servidor antes: compartir con círculos sin elegir ninguno.
  if (visibility.value === "circles" && circleIds.value.length === 0) {
    return reject("no_circles_selected");
  }

  return {
    ok: true,
    value: {
      kind: "new",
      requestId,
      locale: planLocale,
      durationDays: duration.days,
      visibility: visibility.value ?? "private",
      topics: topics.value,
      customTopic: customTopic.value,
      groupId: groupId.value,
      circleIds: circleIds.value,
    },
  };
};

export type BodyRead =
  { ok: true; body: unknown } | { ok: false; rejection: InputRejection };

/**
 * Lee y parsea el cuerpo con tope de tamaño. Un JSON roto ya no se convierte
 * en `{}` (que creaba un plan de siete días con los valores por defecto y
 * gastaba cuota): es un 400.
 */
export const readJsonBody = async (req: Request): Promise<BodyRead> => {
  const declared = Number(req.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > LIMITS.bodyChars * 4) {
    // Cuatro bytes por carácter como máximo: pasar de ahí seguro que excede.
    return reject("payload_too_large", "too_large");
  }

  let text: string;

  try {
    text = await req.text();
  } catch {
    return reject("invalid_body", "invalid_json");
  }

  if (text.length > LIMITS.bodyChars) {
    return reject("payload_too_large", "too_large");
  }

  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return reject("invalid_json", "invalid_json");
  }
};
