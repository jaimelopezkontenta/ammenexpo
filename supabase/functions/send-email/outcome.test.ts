import { describe, expect, it } from "vitest";

import { deliveryErrorCode } from "./outcome.ts";

describe("deliveryErrorCode", () => {
  it("conserva el status de Resend", () => {
    expect(deliveryErrorCode("resend_429")).toBe("resend_429");
    expect(deliveryErrorCode("resend_503")).toBe("resend_503");
    expect(deliveryErrorCode("resend_422")).toBe("resend_422");
  });

  it("descarta el trozo de respuesta que sigue a los dos puntos", () => {
    const code = deliveryErrorCode(
      'resend_400:{"message":"The to field must be a valid email: persona@example.com"}',
    );

    expect(code).toBe("resend_400");
    expect(code).not.toContain("persona");
  });

  it("reconoce la respuesta sin id", () => {
    expect(deliveryErrorCode("resend_missing_id")).toBe("resend_missing_id");
  });

  it("todo lo demás es un fallo de transporte, sin su mensaje", () => {
    expect(deliveryErrorCode("fetch failed")).toBe("transport_error");
    expect(deliveryErrorCode("connect ECONNREFUSED 1.2.3.4:443")).toBe(
      "transport_error",
    );
    expect(deliveryErrorCode("")).toBe("transport_error");
  });

  it("no se deja engañar por un prefijo falso", () => {
    expect(deliveryErrorCode("xresend_500")).toBe("transport_error");
    expect(deliveryErrorCode("resend_5000")).toBe("transport_error");
  });
});
