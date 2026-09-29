/**
 * RDY-09 — observabilidad mínima: allowlist, esquema por evento y kill
 * switch, sin proveedor.
 *
 * No hay proveedor de analítica/errores conectado en este repositorio ni en
 * este entorno — el plan es explícito en que eso no se marca PASS sin uno
 * real. Lo que sí se puede construir y probar sin depender de nadie externo
 * es la mitad que decide QUÉ puede salir de la app si algún día hay un
 * proveedor detrás: un evento que no está en la lista, o un campo que no es
 * un id opaco/enum/número/duración, no se envía. Nunca.
 *
 * Regla del plan (§2 decisión 15 y paquete de evidencia): "telemetría
 * registra IDs técnicos, estados y duración, nunca contenido sensible".
 * Este módulo es esa regla, escrita como código y no como intención.
 */

/**
 * Los únicos eventos que este módulo admite. Añadir uno nuevo es una decisión
 * explícita en este archivo, no un string suelto en el sitio de la llamada —
 * así un typo no crea silenciosamente un evento nuevo sin schema.
 */
export const ALLOWED_EVENTS = [
  "preview",
  "signup",
  "redeem",
  "intercession",
  "push_registered",
  "push_delivered",
  "push_failed",
  "open",
  "email_enqueued",
  "email_sent",
  "email_opened",
  "email_clicked",
  "email_unsubscribed",
] as const;

export type ObservabilityEvent = (typeof ALLOWED_EVENTS)[number];

/** Un uuid, o cualquier otro id opaco que no sea texto libre reconocible. */
const OPAQUE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Los tipos de valor permitidos en un payload. Nada de "string" a secas: un
 * string sin acotar es exactamente por donde se cuela una oración, un correo
 * o un nombre.
 */
type FieldSpec =
  | { kind: "opaque_id" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "duration_ms" };

type EventSchema = Record<string, FieldSpec>;

/**
 * Un campo por evento, y nada implícito. Si un evento necesita un campo que
 * no está aquí, se añade aquí primero — la validación no tiene un modo
 * "permitir lo que no reconozco".
 */
const SCHEMAS: Record<ObservabilityEvent, EventSchema> = {
  preview: {
    surface: { kind: "enum", values: ["share_link", "public_plan"] },
  },
  signup: {
    source: {
      kind: "enum",
      values: ["organic", "share_link", "invite", "unknown"],
    },
  },
  redeem: {
    // Coincide con los `reason` reales de `redeem_share_token()`
    // (`supabase/migrations/20260810100100_no_more_friends.sql`), más
    // `error` (fallo de red/transporte) y `unknown` — el cajón fijo al que
    // `core/plans/redeemOutcome.ts#resolveRedeemOutcome` manda cualquier
    // motivo que el servidor devuelva y este cliente no reconozca todavía.
    // Sin `unknown` aquí, ese motivo nuevo se perdía en silencio en vez de
    // contarse como al menos "algo que no encajaba" — el punto de la
    // corrección de este ciclo.
    outcome: {
      kind: "enum",
      values: ["ok", "invalid_or_expired", "plan_missing", "error", "unknown"],
    },
  },
  intercession: {
    outcome: {
      kind: "enum",
      values: ["created", "already_prayed", "error"],
    },
  },
  push_registered: {
    platform: { kind: "enum", values: ["ios", "android", "web"] },
  },
  push_delivered: {
    latency_ms: { kind: "duration_ms" },
  },
  push_failed: {
    reason: {
      kind: "enum",
      values: ["token_invalid", "provider_error", "blocked", "no_token"],
    },
  },
  open: {
    context: {
      kind: "enum",
      values: ["deep_link", "notification", "cold_start"],
    },
  },
  email_enqueued: {
    template: { kind: "opaque_id" },
  },
  email_sent: {
    template: { kind: "opaque_id" },
  },
  email_opened: {
    template: { kind: "opaque_id" },
  },
  email_clicked: {
    template: { kind: "opaque_id" },
  },
  email_unsubscribed: {
    surface: { kind: "enum", values: ["one_click", "prefs"] },
  },
};

export type ObservabilityPayload = Record<string, string | number | boolean>;

const isValidField = (spec: FieldSpec, value: unknown): boolean => {
  switch (spec.kind) {
    case "opaque_id":
      return typeof value === "string" && OPAQUE_ID_RE.test(value);
    case "enum":
      return typeof value === "string" && spec.values.includes(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "duration_ms":
      return typeof value === "number" && Number.isFinite(value) && value >= 0;
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
};

/**
 * El corazón de la regla: solo pasan los campos declarados en el schema del
 * evento, y solo si su valor tiene la forma exacta que el schema pide.
 * Cualquier otra clave —`body`, `message`, `email`, `prayer`, lo que sea— se
 * queda fuera en silencio. No hay una lista de "palabras prohibidas" que
 * mantener: la allowlist decide por inclusión, no por exclusión.
 */
export const sanitizePayload = (
  event: ObservabilityEvent,
  payload: ObservabilityPayload,
): ObservabilityPayload => {
  const schema = SCHEMAS[event];
  const clean: ObservabilityPayload = {};

  for (const [key, spec] of Object.entries(schema)) {
    const value = payload[key];
    if (value !== undefined && isValidField(spec, value)) {
      clean[key] = value;
    }
  }

  return clean;
};

export type ObservabilityReporter = (
  event: ObservabilityEvent,
  payload: ObservabilityPayload,
) => void;

/**
 * Sin proveedor: el reporter por defecto no manda nada a ninguna parte.
 * Existe para que `track()` tenga a quién llamar sin que este archivo decida
 * qué SDK usar — esa es una decisión de producto/proveedor que el plan exige
 * no fingir con evidencia local.
 */
export const noopReporter: ObservabilityReporter = () => {};

/**
 * El único reporter que este repositorio conecta de verdad, y solo en
 * desarrollo: escribe en la consola del propio dispositivo/navegador de
 * quien está probando la app, nunca sale de ahí. Sirve para comprobar, con
 * los ojos, que los puntos de integración del funnel (`preview`, `signup`,
 * `redeem`, `intercession`, `open`) disparan de verdad durante el uso real
 * — no es, y no pretende ser, un proveedor de producción. Point de
 * conexión para cuando exista uno: sustituir esta línea en `configure()`,
 * nunca los sitios de llamada de `track()`.
 */
export const devConsoleReporter: ObservabilityReporter = (event, payload) => {
  console.debug("[observability]", event, payload);
};

/**
 * Un error, reducido a lo que no puede llevar nada de la persona: su clase,
 * un código y de dónde vino. El mensaje no sale nunca de aquí — un error de
 * PostgREST puede citar el texto de una oración, y eso es categoría especial
 * (Art. 9 RGPD) viaje a donde viaje.
 */
export type ErrorReport = {
  source: "query" | "mutation" | "render";
  /** La raíz de la query key (`"todayDay"`), nunca ids ni parámetros. */
  key?: string;
  name: string;
  code?: string;
  status?: number;
};

export type ErrorReporter = (report: ErrorReport) => void;

export const noopErrorReporter: ErrorReporter = () => {};

/** En desarrollo, a la consola de quien prueba; nunca sale de su máquina. */
export const devConsoleErrorReporter: ErrorReporter = (report) => {
  console.warn("[observability:error]", report);
};

const SAFE_CODE = /^[A-Za-z0-9_.-]{1,32}$/;

/** Solo nombre, código y status: lo demás se queda fuera por construcción. */
export const toErrorReport = (
  error: unknown,
  context: Pick<ErrorReport, "source" | "key">,
): ErrorReport => {
  const raw = (error && typeof error === "object" ? error : {}) as {
    name?: unknown;
    code?: unknown;
    status?: unknown;
  };
  const key =
    typeof context.key === "string" && SAFE_CODE.test(context.key)
      ? context.key
      : undefined;

  return {
    source: context.source,
    ...(key ? { key } : {}),
    name:
      typeof raw.name === "string" && SAFE_CODE.test(raw.name)
        ? raw.name
        : "Error",
    ...(typeof raw.code === "string" && SAFE_CODE.test(raw.code)
      ? { code: raw.code }
      : {}),
    ...(typeof raw.status === "number" ? { status: raw.status } : {}),
  };
};

let activeReporter: ObservabilityReporter = noopReporter;
let activeErrorReporter: ErrorReporter = noopErrorReporter;
let killSwitch = false;

/**
 * El kill switch. Un incidente de privacidad detectado en producción no
 * puede esperar a un deploy: `disable()` apaga el envío en caliente y
 * `track()` deja de intentar nada, allowlist incluida.
 */
export const observability = {
  configure(reporter: ObservabilityReporter) {
    activeReporter = reporter;
  },
  configureErrors(reporter: ErrorReporter) {
    activeErrorReporter = reporter;
  },
  reset() {
    activeReporter = noopReporter;
    activeErrorReporter = noopErrorReporter;
    killSwitch = false;
  },
  disable() {
    killSwitch = true;
  },
  enable() {
    killSwitch = false;
  },
  isEnabled() {
    return !killSwitch;
  },
};

/**
 * El único punto de entrada del módulo. Todo lo demás es privado a propósito:
 * nada en el resto de la app debería poder saltarse el schema llamando al
 * reporter directamente.
 */
export const track = (
  event: ObservabilityEvent,
  payload: ObservabilityPayload = {},
): void => {
  if (killSwitch) return;
  if (!ALLOWED_EVENTS.includes(event)) return;

  activeReporter(event, sanitizePayload(event, payload));
};

/**
 * Errores que son una respuesta y no un fallo: la app los espera, los
 * explica en pantalla y no hay nada que arreglar. «Ya oraste por este día»,
 * «llegaste al límite de planes», «ya se está escribiendo», «la foto pesa
 * demasiado». Reportarlos llenaba el canal de errores de ruido y tapaba los
 * de verdad.
 *
 * Por nombre, porque las clases viven en sus dominios (`AlreadyPrayed` en
 * intercessions, las de planes en plans, `AvatarTooLarge` en profile) y este
 * módulo no debe importarlas. Una clase nueva puede marcarse sola con
 * `expected = true` en vez de entrar en la lista.
 *
 * `GenerationUnavailable` y `RequestIdConflict` **no** están: el proveedor
 * caído y un id de petición repetido sí son algo que mirar.
 */
const EXPECTED_ERROR_NAMES: ReadonlySet<string> = new Set([
  "AlreadyPrayed",
  "PlanLimitReached",
  "GenerationInFlight",
  "AvatarTooLarge",
]);

export const isExpectedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const { expected, name } = error as { expected?: unknown; name?: unknown };
  return (
    expected === true ||
    (typeof name === "string" && EXPECTED_ERROR_NAMES.has(name))
  );
};

/**
 * El otro punto de entrada: un error que la app no supo evitar (una query o
 * una mutación que falla, un render que revienta). Pasa por `toErrorReport`,
 * así que ningún reporter recibe el mensaje ni el objeto original. Respeta el
 * mismo kill switch que `track()`.
 */
export const captureError = (
  error: unknown,
  context: Pick<ErrorReport, "source" | "key">,
): void => {
  if (killSwitch) return;

  activeErrorReporter(toErrorReport(error, context));
};
