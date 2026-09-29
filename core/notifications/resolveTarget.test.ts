import { describe, expect, it } from "vitest";

import {
  destinationForTap,
  isLocalReminderIdentifier,
  navigationTargetFor,
  outboxIdFromPayload,
  responseIdentifier,
  type NotificationPayload,
  type ResolvedNotification,
} from "./resolveTarget";

/**
 * RDY-11 corrección — el tap de una notificación nunca navega a partir del
 * payload por sí solo. Estas dos funciones son la mitad de esa regla que se
 * puede probar sin un dispositivo real: qué se lee del payload (nada más
 * que un id opaco) y qué se decide con la respuesta del servidor (nunca con
 * lo que el payload afirmaba).
 */
describe("outboxIdFromPayload", () => {
  it("reads the outbox id from a well-formed intercession payload", () => {
    const payload: NotificationPayload = {
      type: "intercession",
      outboxId: "11111111-1111-1111-1111-111111111111",
    };

    expect(outboxIdFromPayload(payload)).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("is null for any other notification type", () => {
    const payload = {
      type: "some_future_event",
      outboxId: "11111111-1111-1111-1111-111111111111",
    };

    expect(outboxIdFromPayload(payload)).toBeNull();
  });

  // Oleada 6: solo existe el tipo `intercession`. Un payload que traiga una
  // ruta o un tipo que el servidor no emite no abre nada, ni aunque se
  // parezca a una pantalla real de la app.
  it("never navigates from a route or an unknown type carried in the payload", () => {
    const smuggled = [
      { type: "reminder", outboxId: "11111111-1111-1111-1111-111111111111" },
      { type: "plan", outboxId: "11111111-1111-1111-1111-111111111111" },
      { type: "comment", outboxId: "11111111-1111-1111-1111-111111111111" },
      {
        type: "Intercession",
        outboxId: "11111111-1111-1111-1111-111111111111",
      },
      { url: "/plan/aaaa0000-0000-0000-0000-000000000001", outboxId: "x" },
    ];

    for (const payload of smuggled) {
      expect(outboxIdFromPayload(payload as NotificationPayload)).toBeNull();
    }
    // Y sin autorización del servidor, un tap remoto no tiene destino.
    expect(destinationForTap("notif-123", null)).toBeNull();
  });

  it("is null when there is no payload at all", () => {
    expect(outboxIdFromPayload(null)).toBeNull();
    expect(outboxIdFromPayload(undefined)).toBeNull();
  });

  it("is null for a malformed or tampered outboxId", () => {
    expect(
      outboxIdFromPayload({ type: "intercession", outboxId: 12345 }),
    ).toBeNull();
    expect(
      outboxIdFromPayload({ type: "intercession", outboxId: "" }),
    ).toBeNull();
    expect(outboxIdFromPayload({ type: "intercession" })).toBeNull();
  });

  // El caso real que esto cierra: un payload nunca lleva un `planId`, así que
  // aunque alguien lo inyectara, no hay ningún camino de código que lo lea.
  it("never reads a planId even if one were smuggled into the payload", () => {
    const tampered = {
      type: "intercession",
      outboxId: "11111111-1111-1111-1111-111111111111",
      planId: "aaaa0000-0000-0000-0000-000000000001",
    } as NotificationPayload & { planId: string };

    const result = outboxIdFromPayload(tampered);

    expect(result).toBe("11111111-1111-1111-1111-111111111111");
    // outboxIdFromPayload's return type is just a string — there is no
    // planId anywhere downstream of this function to accidentally trust.
  });
});

describe("navigationTargetFor", () => {
  it("navigates to /avisos when the server authorizes it", () => {
    const resolved: ResolvedNotification = {
      authorized: true,
      intercessor_name: "Beto",
    };

    expect(navigationTargetFor(resolved)).toBe("/avisos");
  });

  it("navigates nowhere when the server refuses — wrong owner, stale, or blocked since", () => {
    const resolved: ResolvedNotification = {
      authorized: false,
      intercessor_name: null,
    };

    expect(navigationTargetFor(resolved)).toBeNull();
  });

  it("navigates nowhere when there was no server answer at all", () => {
    expect(navigationTargetFor(null)).toBeNull();
  });
});

describe("isLocalReminderIdentifier", () => {
  it("is true only for the daily reminder prefix", () => {
    expect(isLocalReminderIdentifier("ammen-reminder-8")).toBe(true);
    expect(isLocalReminderIdentifier("ammen-reminder-21")).toBe(true);
  });

  it("is false for push identifiers and anything else", () => {
    expect(isLocalReminderIdentifier("notif-123")).toBe(false);
    expect(isLocalReminderIdentifier("ammen-reminder")).toBe(false);
    expect(isLocalReminderIdentifier("")).toBe(false);
  });
});

describe("destinationForTap", () => {
  it("sends a local reminder to Hoy, never to /avisos", () => {
    expect(destinationForTap("ammen-reminder-8", null)).toBe("/");
    // Aunque el payload mintiera una intercesión autorizada, el identifier
    // local manda: un recordatorio diario no puede abrir Avisos.
    expect(
      destinationForTap("ammen-reminder-8", {
        authorized: true,
        intercessor_name: "Beto",
      }),
    ).toBe("/");
  });

  it("sends an authorized intercession to /avisos", () => {
    expect(
      destinationForTap("notif-123", {
        authorized: true,
        intercessor_name: "Beto",
      }),
    ).toBe("/avisos");
  });

  it("navigates nowhere when an intercession is not authorized", () => {
    expect(destinationForTap("notif-123", null)).toBeNull();
    expect(
      destinationForTap(null, { authorized: false, intercessor_name: null }),
    ).toBeNull();
  });
});

describe("responseIdentifier", () => {
  it("reads the notification's own request identifier", () => {
    const response = {
      notification: { request: { identifier: "notif-123" } },
    };

    expect(responseIdentifier(response)).toBe("notif-123");
  });

  it("is null when there is no response, no notification, or no identifier", () => {
    expect(responseIdentifier(null)).toBeNull();
    expect(responseIdentifier({})).toBeNull();
    expect(responseIdentifier({ notification: {} })).toBeNull();
    expect(responseIdentifier({ notification: { request: {} } })).toBeNull();
  });

  it("is null for a malformed, non-string identifier", () => {
    expect(
      responseIdentifier({
        notification: { request: { identifier: 12345 } },
      }),
    ).toBeNull();
  });
});
