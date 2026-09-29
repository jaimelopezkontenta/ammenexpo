import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@^2.58.0";

import {
  authorizeInvoker,
  BATCH_SIZE,
  buildPushMessage,
  chunk,
  classifyTicket,
  errorReasonFor,
  pairTicketsWithDestinations,
  resolveSenderConfig,
  unmatchedTicketCount,
  type ExpoPushTicket,
  type PushDestination,
} from "./payload.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ammen-invoker",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

type ClaimedRow = {
  outbox_id: string;
  intercession_id: string;
  expo_push_token: string;
  owner_id: string;
  owner_name: string;
  intercessor_name: string;
  attempts: number;
};

const sendBatch = async (
  destinations: PushDestination[],
): Promise<ExpoPushTicket[]> => {
  const messages = destinations.map(buildPushMessage);

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    // Un fallo de transporte, no de un ticket concreto: cada destino de este
    // lote se trata como reintentable más abajo, nunca como "token muerto"
    // — eso solo lo dice Expo con un ticket real, y este lote no llegó a
    // producir ninguno.
    throw new Error(`Expo push API responded ${response.status}`);
  }

  const payload = (await response.json()) as { data: ExpoPushTicket[] };
  return payload.data;
};

const resolveOutbox = async (
  supabase: SupabaseClient,
  outboxId: string,
  status: "sent" | "permanent_failure" | "retryable_failure",
  receiptId: string | null,
  error: string | null,
) => {
  const { error: rpcError } = await supabase.rpc("mark_push_delivery", {
    p_outbox_id: outboxId,
    p_status: status,
    p_receipt_id: receiptId,
    p_error: error,
  });

  if (rpcError) {
    console.error("mark_push_delivery failed", outboxId, rpcError);
  }
};

/**
 * RDY-11 — el sender: outbox con lease (nunca duplicados entre invocaciones
 * solapadas), retry con backoff y tope real, y baja de tokens inválidos.
 *
 * **La corrección de este ciclo.** Antes, cualquier ticket que no fuera "ok"
 * —incluido un fallo de transporte del lote entero— se escribía como
 * `failed`, terminal, sin distinguir un `MessageRateExceeded` (que Expo
 * espera que se reintente) de un `DeviceNotRegistered` (que no). Ahora:
 * `classifyTicket()` decide, y solo `permanent_failure` revoca el
 * dispositivo. Un fallo de transporte marca cada destino del lote como
 * `retryable_failure` — sube `attempts`, programa el siguiente intento con
 * backoff — en vez de dejarlo tocado a medias.
 *
 * **Kill switch, sin redeploy.** `PUSH_SENDER_ENABLED=false` en los secrets
 * de la función (`supabase secrets set`) apaga el envío en caliente.
 *
 * **Fail-closed, esta ola.** Además del kill switch, si `SUPABASE_URL` o
 * `SUPABASE_SERVICE_ROLE_KEY` faltan o están vacías, la función se deshabilita
 * y responde un error seguro — sin crear cliente, sin arrendar el outbox y sin
 * tocar Expo. El cuerpo de esa respuesta es una etiqueta fija; nunca la URL ni
 * la clave, y los logs de esta función tampoco las imprimen.
 *
 * **Lo que esto NO acredita.** Prueba la forma del código — clasificación,
 * lease, backoff, kill switch, bloqueo. No prueba entrega real: eso exige un
 * token de un dispositivo físico y las cuentas de proveedor que este entorno
 * no tiene. Mock nunca cuenta como cierre de push — regla 7 del plan.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // Si el secret está definido, el header tiene que coincidir. Sin secret,
  // solo se deja pasar en local; fuera de local es fail-closed.
  // Nunca se loguea el secret ni el valor del header.
  if (
    authorizeInvoker(
      req.headers.get("x-ammen-invoker"),
      Deno.env.get("AMMEN_PUSH_INVOKE_SECRET") ?? undefined,
      Deno.env.get("SUPABASE_URL") ?? undefined,
    ) === "unauthorized"
  ) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const config = resolveSenderConfig({
    PUSH_SENDER_ENABLED: Deno.env.get("PUSH_SENDER_ENABLED") ?? undefined,
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? undefined,
    SUPABASE_SERVICE_ROLE_KEY:
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? undefined,
  });

  if (!config.enabled) {
    if (config.reason === "kill_switch") {
      return json({ ok: true, skipped: "kill_switch", sent: 0 });
    }

    // Fail-closed: sin configuración interna válida no se envía nada. `503`
    // porque es una condición de despliegue, no un fallo transitorio de un
    // envío concreto. Sin drenar el outbox: ni una fila se arrienda aquí.
    return json({ ok: false, error: "sender_not_configured" }, 503);
  }

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey);

  // `claim_push_outbox_batch` arrienda lo que devuelve (`leased_until`), así
  // que una segunda invocación que se solape en el tiempo no puede recibir
  // las mismas filas — es lo que cierra "evitar duplicados" a nivel de fila,
  // además de la unicidad (intercesión, dispositivo) que ya existía.
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_push_outbox_batch",
    { p_limit: 200, p_lease_seconds: 120 },
  );

  if (claimError) {
    console.error("claim_push_outbox_batch failed", claimError);
    return json({ ok: false, error: "claim_push_outbox_batch_failed" }, 500);
  }

  const rows = (claimed ?? []) as ClaimedRow[];

  if (rows.length === 0) {
    return json({ ok: true, sent: 0, retried: 0, failed: 0 });
  }

  let sent = 0;
  let retried = 0;
  let failed = 0;

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const destinations: PushDestination[] = batch.map((row) => ({
      outboxId: row.outbox_id,
      expoPushToken: row.expo_push_token,
      intercessorName: row.intercessor_name,
    }));

    try {
      const tickets = await sendBatch(destinations);

      const extra = unmatchedTicketCount(destinations, tickets);
      if (extra > 0) {
        // No debería pasar según la documentación de Expo, pero "no
        // debería" no es lo mismo que "no puede": se registra y se sigue,
        // en vez de dejar que un ticket sobrante desalinee el resto.
        console.error(
          `send-intercession-push: Expo returned ${extra} more ticket(s) than destinations sent`,
        );
      }

      await Promise.all(
        pairTicketsWithDestinations(destinations, tickets).map(
          async ({ destination, ticket }) => {
            const outcome = classifyTicket(ticket);

            if (outcome === "sent") {
              sent += 1;
              await resolveOutbox(
                supabase,
                destination.outboxId,
                "sent",
                ticket && ticket.status === "ok" ? ticket.id : null,
                null,
              );
              return;
            }

            if (outcome === "permanent_failure") {
              failed += 1;
            } else {
              retried += 1;
            }

            await resolveOutbox(
              supabase,
              destination.outboxId,
              outcome,
              null,
              errorReasonFor(ticket),
            );
          },
        ),
      );
    } catch (caught) {
      // Fallo de transporte del lote entero: cada destino de este lote se
      // marca `retryable_failure` — sube `attempts`, programa el siguiente
      // intento con backoff — en vez de quedarse tocado a medias por el
      // lease sin que nadie suba el contador ni reprograme nada.
      const reason =
        caught instanceof Error ? caught.message : "transport_error";
      console.error("send-intercession-push batch transport failure", caught);

      await Promise.all(
        batch.map(async (row) => {
          retried += 1;
          await resolveOutbox(
            supabase,
            row.outbox_id,
            "retryable_failure",
            null,
            reason,
          );
        }),
      );
    }
  }

  return json({ ok: true, sent, retried, failed });
});
