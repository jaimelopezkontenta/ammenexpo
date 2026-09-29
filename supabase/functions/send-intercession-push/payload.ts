export type PushDestination = {
  outboxId: string;
  expoPushToken: string;
  intercessorName: string;
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: { type: "intercession"; outboxId: string };
  sound: "default";
};

/**
 * El texto de la notificación, y lo que deliberadamente no lleva.
 *
 * Nunca el mensaje de la intercesión, nunca el texto de una oración: el plan
 * es explícito en que la evidencia y los canales de entrega no llevan
 * contenido de oración/crisis. `data.outboxId` es el único identificador que
 * viaja — el deep link resuelve autorización contra el servidor al abrir
 * (`get_shared_plan_day`, B2), nunca confía en lo que trae el payload.
 *
 * Español fijo por ahora: `pending_push_outbox()` no devuelve el idioma del
 * destinatario todavía. Extenderlo con `profile_settings.locale` es trabajo
 * pendiente, no una promesa de que esto ya es bilingüe.
 */
export const buildPushMessage = (
  destination: PushDestination,
): ExpoPushMessage => ({
  to: destination.expoPushToken,
  title: "Alguien oró por ti",
  body: `${destination.intercessorName} oró por tu día de hoy.`,
  data: { type: "intercession", outboxId: destination.outboxId },
  sound: "default",
});

/** Expo acepta hasta 100 mensajes por lote; por debajo de eso, uno solo. */
export const BATCH_SIZE = 100;

export const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

export type ExpoPushTicket =
  | { status: "ok"; id: string }
  | {
      status: "error";
      message: string;
      details?: { error?: string };
    };

/**
 * Los únicos motivos de error de Expo que significan "este token ya no
 * existe en ningún dispositivo, para siempre" — nunca un límite de tasa, un
 * mensaje demasiado grande o un error genérico del proveedor, que son
 * exactamente lo que la próxima invocación debe volver a intentar.
 *
 * La corrección de este ciclo: antes, cualquier ticket que no fuera "ok" se
 * trataba como si estuviera aquí. Un `MessageRateExceeded` marcaba el
 * dispositivo entero como muerto por el simple hecho de haber llegado en un
 * momento de mucho tráfico.
 */
const PERMANENT_ERROR_CODES = new Set(["DeviceNotRegistered"]);

/**
 * Un ticket "ok" es un envío aceptado, no una entrega confirmada — eso es lo
 * que separa `sent` de `delivered`, y por qué el outbox tiene los dos
 * estados en vez de uno. `DeviceNotRegistered` es el único motivo de la API
 * de Expo que significa "este token ya no existe en ningún dispositivo":
 * los demás son reintentables, ese no.
 */
export const isDeviceNotRegistered = (ticket: ExpoPushTicket): boolean =>
  ticket.status === "error" &&
  Boolean(ticket.details?.error) &&
  PERMANENT_ERROR_CODES.has(ticket.details!.error!);

export type TicketOutcome = "sent" | "permanent_failure" | "retryable_failure";

/**
 * La clasificación completa de un ticket, en un solo sitio — para que
 * `index.ts` nunca tenga que decidir "failed a secas" en ninguna rama.
 *
 * Acepta `null` a propósito: es lo que `pairTicketsWithDestinations()`
 * pone cuando la respuesta de Expo no traía ticket para ese destino. Un
 * ticket ausente no es una entrega fallida "de verdad" —no sabemos qué
 * pasó—, así que es reintentable, nunca `permanent_failure`: no hay ningún
 * `DeviceNotRegistered` que justifique revocar el dispositivo por esto.
 */
export const classifyTicket = (
  ticket: ExpoPushTicket | null,
): TicketOutcome => {
  if (ticket === null) return "retryable_failure";
  if (ticket.status === "ok") return "sent";
  if (isDeviceNotRegistered(ticket)) return "permanent_failure";
  return "retryable_failure";
};

export const errorReasonFor = (ticket: ExpoPushTicket | null): string => {
  if (ticket === null) return "missing_ticket_in_response";
  if (ticket.status === "ok") return "";
  return ticket.details?.error ?? ticket.message;
};

/**
 * El motivo de un ticket, en versión registrable. `errorReasonFor()` cae en
 * `ticket.message` cuando Expo no manda código, y ese mensaje cita el token
 * del dispositivo (`"ExponentPushToken[…]" is not a registered…`): va a la
 * base, pero a un log no. Aquí solo sale el código cerrado de Expo
 * (`DeviceNotRegistered`, `MessageRateExceeded`…) o una etiqueta fija.
 */
export const logReasonFor = (ticket: ExpoPushTicket | null): string => {
  if (ticket === null) return "missing_ticket_in_response";
  if (ticket.status === "ok") return "";

  const code = ticket.details?.error;
  return typeof code === "string" && /^[A-Za-z]{1,64}$/.test(code)
    ? code
    : "expo_error";
};

// ---------------------------------------------------------------------------
// Emparejar destinos con tickets — nunca por índice a ciegas
// ---------------------------------------------------------------------------
//
// La corrección de este ciclo: `index.ts` hacía `tickets.map((ticket, i) =>
// batch[i])`, que presupone `tickets.length === destinations.length` y el
// mismo orden. La API de Expo documenta que responde en el mismo orden que
// se envía, pero un array más corto o más largo del que se pidió —una
// respuesta incompleta, un proxy que trunca, un cambio futuro de la API— no
// es una excepción exótica que no merezca código: con la forma anterior,
// una fila sin ticket correspondiente **nunca se resolvía** (se quedaba
// arrendada hasta que el lease expirase, sin subir `attempts` ni
// reprogramar), y si llegaban tickets de más, `batch[index]` daba
// `undefined` y el acceso a `row.outbox_id` lanzaba dentro del `Promise.all`
// — lo que el `catch` de fuera capturaba como si **todo** el lote hubiera
// fallado de transporte, marcando como reintentable hasta los envíos que sí
// habían salido bien como "ok".

export type PairedResult =
  | { destination: PushDestination; ticket: ExpoPushTicket }
  | { destination: PushDestination; ticket: null };

/**
 * Empareja por posición, pero nunca deja un destino sin resultado ni un
 * ticket sobrante sin explicar. `ticket: null` es el marcador explícito de
 * "la respuesta no traía nada para este destino" — nunca `undefined`, que es
 * exactamente lo que un acceso fuera de rango daría sin este paso.
 */
export const pairTicketsWithDestinations = (
  destinations: PushDestination[],
  tickets: ExpoPushTicket[],
): PairedResult[] => {
  return destinations.map((destination, index) => {
    const ticket = index < tickets.length ? tickets[index] : null;
    return { destination, ticket };
  });
};

/**
 * Cuántos tickets de la respuesta no se pudieron emparejar con ningún
 * destino — para que el sender pueda dejar constancia en el log sin que la
 * app entera dependa de que ese número sea siempre cero.
 */
export const unmatchedTicketCount = (
  destinations: PushDestination[],
  tickets: ExpoPushTicket[],
): number => Math.max(0, tickets.length - destinations.length);

// ---------------------------------------------------------------------------
// Configuración fail-closed del sender
// ---------------------------------------------------------------------------
//
// RDY-11, primera ola del plan operativo: con ninguna configuración interna
// válida el sender debe quedar deshabilitado y responder con un error seguro,
// sin arrendar ni una fila del outbox y sin hablar con Expo. El kill switch
// (`PUSH_SENDER_ENABLED=false`) conserva su semántica exacta —apagado en
// caliente sin redeploy—, y la ausencia o el vacío de `SUPABASE_URL` o
// `SUPABASE_SERVICE_ROLE_KEY` desactiva también, pero por configuración rota,
// con un motivo distinto para poder distinguir "apagado a propósito" de
// "apagado porque falta algo".

export type SenderConfig =
  | { enabled: true; supabaseUrl: string; serviceRoleKey: string }
  | { enabled: false; reason: "kill_switch" | "not_configured" };

/**
 * Resuelve si el sender puede enviar a partir de las variables de entorno
 * crudas. La forma `disabled` solo lleva una etiqueta fija: nunca devuelve ni
 * registra la URL ni la clave de servicio, que es justo lo que un error de
 * configuración no debe exponer.
 */
export const resolveSenderConfig = (
  env: Record<string, string | undefined>,
): SenderConfig => {
  if (env.PUSH_SENDER_ENABLED === "false") {
    return { enabled: false, reason: "kill_switch" };
  }

  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return { enabled: false, reason: "not_configured" };
  }

  return { enabled: true, supabaseUrl, serviceRoleKey };
};

// ---------------------------------------------------------------------------
// Guard del invocador local
// ---------------------------------------------------------------------------
//
// El header `x-ammen-invoker` contra `AMMEN_PUSH_INVOKE_SECRET`, en tiempo
// constante. Sin secreto, solo pasa en local: fuera de local es fail-closed
// (ver `_shared/invoker.ts`, compartido con los drenajes de correo).

export {
  authorizeInvoker,
  type InvokerAuth,
  isLocalSupabaseUrl,
  timingSafeEqualString,
} from "../_shared/invoker.ts";
