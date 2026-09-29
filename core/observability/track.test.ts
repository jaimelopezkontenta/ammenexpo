import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  devConsoleReporter,
  observability,
  sanitizePayload,
  track,
  type ObservabilityPayload,
} from "./track";

describe("observability allowlist + schema", () => {
  beforeEach(() => {
    observability.reset();
  });

  it("drops an event that is not in the allowlist", () => {
    const reporter = vi.fn();
    observability.configure(reporter);

    // @ts-expect-error — exactamente el caso que la allowlist existe para
    // impedir: un nombre de evento que nadie declaró.
    track("user_typed_a_prayer", { anything: "goes" });

    expect(reporter).not.toHaveBeenCalled();
  });

  it("forwards an allowed event with a valid payload", () => {
    const reporter = vi.fn();
    observability.configure(reporter);

    track("redeem", { outcome: "ok" });

    expect(reporter).toHaveBeenCalledWith("redeem", { outcome: "ok" });
  });

  it("strips a field the event's schema never declared", () => {
    const leaking = {
      outcome: "ok",
      // Nada declara esto para `redeem`: un intento de colar algo por fuera
      // del schema, exactamente el vector que sanitizePayload cierra.
      prayer_text: "Señor, ayúdame con...",
    } as unknown as ObservabilityPayload;

    expect(sanitizePayload("redeem", leaking)).toEqual({ outcome: "ok" });
  });

  it("drops a field whose value does not match its declared shape", () => {
    const wrongShape = {
      // `outcome` es un enum cerrado; un valor fuera de la lista se descarta,
      // no se envía "tal cual" con la esperanza de que el proveedor lo ignore.
      outcome: "revoked-and-also-my-email-is-x@example.com",
    };

    expect(sanitizePayload("redeem", wrongShape)).toEqual({});
  });

  it("never lets free text through even under a plausible-looking key", () => {
    // El caso real que motiva el módulo: alguien pasa el cuerpo de una
    // intercesión pensando que "un poco de contexto" ayuda a depurar.
    const attempted = {
      outcome: "created",
      message: "Oré por ti, espero que encuentres paz",
    } as unknown as ObservabilityPayload;

    const clean = sanitizePayload("intercession", attempted);

    expect(clean).toEqual({ outcome: "created" });
    expect(clean).not.toHaveProperty("message");
  });

  it("accepts a duration and rejects a negative one", () => {
    expect(sanitizePayload("push_delivered", { latency_ms: 842 })).toEqual({
      latency_ms: 842,
    });

    expect(sanitizePayload("push_delivered", { latency_ms: -5 })).toEqual({});
  });

  it("kill switch stops delivery even for a perfectly valid event", () => {
    const reporter = vi.fn();
    observability.configure(reporter);
    observability.disable();

    track("open", { context: "cold_start" });

    expect(reporter).not.toHaveBeenCalled();
    expect(observability.isEnabled()).toBe(false);
  });

  it("re-enabling resumes delivery", () => {
    const reporter = vi.fn();
    observability.configure(reporter);
    observability.disable();
    observability.enable();

    track("open", { context: "cold_start" });

    expect(reporter).toHaveBeenCalledWith("open", { context: "cold_start" });
  });

  it("defaults to a no-op reporter until configured", () => {
    // `reset()` en beforeEach ya deja esto en su estado por defecto; la
    // aserción es que no lanza y no hay ningún efecto observable posible.
    expect(() => track("open", { context: "deep_link" })).not.toThrow();
  });

  it("accepts email lifecycle events without PII", () => {
    expect(
      sanitizePayload("email_unsubscribed", { surface: "one_click" }),
    ).toEqual({ surface: "one_click" });
    expect(sanitizePayload("email_sent", { template: "welcome" })).toEqual({
      template: "welcome",
    });
    expect(
      sanitizePayload("email_sent", {
        template: "welcome",
        email: "a@b.c",
      } as unknown as ObservabilityPayload),
    ).toEqual({ template: "welcome" });
  });

  it("the dev console reporter only ever sees the already-sanitized payload", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    observability.configure(devConsoleReporter);

    track("intercession", {
      outcome: "created",
      // Un campo que el schema de `intercession` no declara: la sanitización
      // ya pasó por `track()` antes de que el reporter lo vea, así que ni el
      // reporter de desarrollo puede recibirlo.
      message: "algo que nunca debería salir de aquí",
    } as unknown as ObservabilityPayload);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("[observability]", "intercession", {
      outcome: "created",
    });

    spy.mockRestore();
  });
});
