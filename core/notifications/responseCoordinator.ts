import {
  destinationForTap,
  isLocalReminderIdentifier,
  navigationTargetFor,
  outboxIdFromPayload,
  responseIdentifier,
  type NotificationNavigationTarget,
  type NotificationPayload,
  type ResolvedNotification,
} from "./resolveTarget";

export type NotificationResponseLike = {
  notification?: {
    request?: {
      identifier?: unknown;
      content?: {
        data?: NotificationPayload | null;
      };
    };
  };
};

export type PushSessionState = {
  resolved: boolean;
  userId: string | null;
};

export type PushResolutionResult =
  | { status: "resolved"; notification: ResolvedNotification }
  | { status: "retryable_error"; error: unknown };

type ResponseSource = "listener" | "cold-start";

type PendingKind = "intercession" | "local-reminder";

type PendingResponse = {
  outboxId: string;
  kind: PendingKind;
  identifiers: Set<string>;
  hasColdStartCopy: boolean;
  attempts: number;
  retryScheduled: boolean;
  attemptReady: boolean;
};

type CancelRetry = () => void;

type CoordinatorDependencies = {
  resolve: (outboxId: string) => Promise<PushResolutionResult>;
  navigate: (target: NotificationNavigationTarget) => void | Promise<void>;
  clearLastResponse: () => void | Promise<void>;
  reportError?: (error: unknown) => void;
  retryDelaysMs?: readonly number[];
  scheduleRetry?: (callback: () => void, delayMs: number) => CancelRetry;
};

const defaultScheduleRetry = (
  callback: () => void,
  delayMs: number,
): CancelRetry => {
  const timeout = setTimeout(callback, delayMs);
  return () => clearTimeout(timeout);
};

const payloadFor = (
  response: NotificationResponseLike,
): NotificationPayload | null | undefined =>
  response.notification?.request?.content?.data;

/** Clave del mapa de pending cuando no hay outbox: el identifier ya es estable. */
const localReminderPendingKey = (identifier: string): string =>
  `local:${identifier}`;

/**
 * Coordina las dos fuentes de taps sin depender de React Native. Una
 * intercesión entra primero en memoria y solo se resuelve cuando Supabase
 * Auth ya restauró una sesión. Un recordatorio local no espera: no hay RPC
 * que hacer. El outbox (o `local:<identifier>`) es el alias de dedupe
 * estable cuando Expo no proporciona `identifier`.
 */
export const createPushResponseCoordinator = (
  dependencies: CoordinatorDependencies,
) => {
  const retryDelaysMs = dependencies.retryDelaysMs ?? [500, 2_000];
  const scheduleRetry = dependencies.scheduleRetry ?? defaultScheduleRetry;
  const pendingByOutbox = new Map<string, PendingResponse>();
  const pendingByIdentifier = new Map<string, string>();
  const terminalOutboxes = new Set<string>();
  const terminalIdentifiers = new Set<string>();
  const retryCancellations = new Map<string, CancelRetry>();

  let session: PushSessionState = { resolved: false, userId: null };
  let authenticatedUserId: string | null = null;
  let generation = 0;
  let drainPromise: Promise<void> | null = null;
  let redrainRequested = false;
  let disposed = false;

  const reportError = (error: unknown) => {
    dependencies.reportError?.(error);
  };

  const clearColdStartCopy = () => {
    void Promise.resolve(dependencies.clearLastResponse()).catch(reportError);
  };

  const cancelRetry = (outboxId: string) => {
    retryCancellations.get(outboxId)?.();
    retryCancellations.delete(outboxId);
  };

  const finish = (entry: PendingResponse) => {
    cancelRetry(entry.outboxId);
    pendingByOutbox.delete(entry.outboxId);
    terminalOutboxes.add(entry.outboxId);

    for (const identifier of entry.identifiers) {
      pendingByIdentifier.delete(identifier);
      terminalIdentifiers.add(identifier);
    }

    if (entry.hasColdStartCopy) clearColdStartCopy();
  };

  const discardPendingForAccountChange = () => {
    generation += 1;

    for (const entry of pendingByOutbox.values()) {
      // Un logout/cambio de cuenta es terminal para taps capturados bajo la
      // cuenta anterior. No pueden reaparecer al iniciar otra cuenta.
      finish(entry);
    }
  };

  const scheduleNextAttempt = (entry: PendingResponse) => {
    const retryIndex = entry.attempts - 1;
    const delay = retryDelaysMs[retryIndex];
    if (delay === undefined || disposed) return;

    entry.retryScheduled = true;
    const cancel = scheduleRetry(() => {
      retryCancellations.delete(entry.outboxId);
      entry.retryScheduled = false;
      entry.attemptReady = true;
      void drain();
    }, delay);
    retryCancellations.set(entry.outboxId, cancel);
  };

  const processEntry = async (entry: PendingResponse) => {
    // Un recordatorio local abre Hoy sin pedirle nada al servidor, así
    // que no espera a que Auth restaure la sesión. La intercesión sí:
    // resolve_push_notification exige un usuario.
    if (
      entry.kind !== "local-reminder" &&
      (!session.resolved || !session.userId)
    ) {
      return;
    }

    if (entry.retryScheduled || !entry.attemptReady) {
      return;
    }

    const userIdAtStart = session.userId;
    const generationAtStart = generation;
    entry.attemptReady = false;
    entry.attempts += 1;

    if (entry.kind === "local-reminder") {
      const identifier = [...entry.identifiers][0] ?? null;
      const target = destinationForTap(identifier, null);
      if (!target) {
        finish(entry);
        return;
      }

      try {
        await dependencies.navigate(target);
        if (
          disposed ||
          generation !== generationAtStart ||
          pendingByOutbox.get(entry.outboxId) !== entry
        ) {
          return;
        }
        finish(entry);
      } catch (error) {
        reportError(error);
        scheduleNextAttempt(entry);
      }
      return;
    }

    let result: PushResolutionResult;
    try {
      result = await dependencies.resolve(entry.outboxId);
    } catch (error) {
      result = { status: "retryable_error", error };
    }

    if (
      disposed ||
      generation !== generationAtStart ||
      session.userId !== userIdAtStart ||
      pendingByOutbox.get(entry.outboxId) !== entry
    ) {
      return;
    }

    if (result.status === "retryable_error") {
      reportError(result.error);
      scheduleNextAttempt(entry);
      return;
    }

    const target = navigationTargetFor(result.notification);
    if (!target) {
      // Un deny del servidor es definitivo: no navegar y limpiar el cold tap.
      finish(entry);
      return;
    }

    try {
      await dependencies.navigate(target);
      finish(entry);
    } catch (error) {
      // Solo navegación completada es éxito terminal. Si el router falla, la
      // respuesta sigue pendiente y usa el mismo presupuesto acotado de retry.
      reportError(error);
      scheduleNextAttempt(entry);
    }
  };

  async function drain(): Promise<void> {
    // Una llamada mientras ya se está drenando no puede limitarse a devolver
    // la promesa existente: un retry puede quedar listo después de que el
    // iterador ya pasó por su entrada. Esta señal obliga otra vuelta estable.
    redrainRequested = true;
    if (drainPromise) return drainPromise;

    drainPromise = (async () => {
      while (redrainRequested) {
        redrainRequested = false;
        // La sesión ya no corta el drain entero: un recordatorio local
        // tiene que poder abrir Hoy aunque Auth aún no haya resuelto.
        // La intercesión sigue esperando dentro de `processEntry`.
        if (disposed) return;

        for (const entry of pendingByOutbox.values()) {
          await processEntry(entry);
        }
      }
    })().finally(() => {
      drainPromise = null;
    });

    return drainPromise;
  }

  const capture = async (
    response: NotificationResponseLike | null | undefined,
    source: ResponseSource,
  ) => {
    if (!response || disposed) return;

    const identifier = responseIdentifier(response);
    // Un recordatorio diario no trae outboxId. Sin este atajo, capture
    // exigía uno y el tap se tragaba en silencio — o peor, si alguien
    // metía data de intercesión, acabaría en /avisos.
    const isLocalReminder =
      identifier !== null && isLocalReminderIdentifier(identifier);
    const outboxId = isLocalReminder
      ? localReminderPendingKey(identifier)
      : outboxIdFromPayload(payloadFor(response));

    if (!outboxId) {
      // No existe una RPC segura que se pueda hacer sin el id opaco. Para el
      // cold start esto es un deny definitivo del formato, así que se limpia.
      if (source === "cold-start") clearColdStartCopy();
      return;
    }

    if (
      terminalOutboxes.has(outboxId) ||
      (identifier !== null && terminalIdentifiers.has(identifier))
    ) {
      if (source === "cold-start") clearColdStartCopy();
      return;
    }

    const aliasedOutbox = identifier
      ? pendingByIdentifier.get(identifier)
      : undefined;
    const existing = pendingByOutbox.get(aliasedOutbox ?? outboxId);

    if (existing) {
      if (identifier) {
        existing.identifiers.add(identifier);
        pendingByIdentifier.set(identifier, existing.outboxId);
      }
      if (source === "cold-start") existing.hasColdStartCopy = true;

      // Después de agotar un ciclo de retries, un nuevo delivery explícito
      // permite otro ciclo acotado; nunca se consume definitivamente por error.
      const exhausted =
        !existing.retryScheduled && existing.attempts > retryDelaysMs.length;
      if (exhausted) {
        existing.attempts = 0;
        existing.attemptReady = true;
      }

      await drain();
      return;
    }

    const entry: PendingResponse = {
      outboxId,
      kind: isLocalReminder ? "local-reminder" : "intercession",
      identifiers: new Set(identifier ? [identifier] : []),
      hasColdStartCopy: source === "cold-start",
      attempts: 0,
      retryScheduled: false,
      attemptReady: true,
    };
    pendingByOutbox.set(outboxId, entry);
    if (identifier) pendingByIdentifier.set(identifier, outboxId);

    await drain();
  };

  const updateSession = async (next: PushSessionState) => {
    if (disposed) return;

    if (authenticatedUserId && next.userId !== authenticatedUserId) {
      discardPendingForAccountChange();
    }

    session = next;
    if (next.userId) authenticatedUserId = next.userId;
    if (next.resolved && !next.userId && authenticatedUserId) {
      authenticatedUserId = null;
    }

    await drain();
  };

  const dispose = () => {
    disposed = true;
    generation += 1;
    for (const cancel of retryCancellations.values()) cancel();
    retryCancellations.clear();
    redrainRequested = false;
    pendingByOutbox.clear();
    pendingByIdentifier.clear();
  };

  return {
    capture,
    updateSession,
    dispose,
    /** Estado observable solo para tests de la máquina pura. */
    pendingCount: () => pendingByOutbox.size,
  };
};

export type PushResponseCoordinator = ReturnType<
  typeof createPushResponseCoordinator
>;
