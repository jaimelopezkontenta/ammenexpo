import { describe, expect, it, vi } from "vitest";

import { waitlistInputError } from "./waitlist";

// El módulo importa el cliente de Supabase aunque `waitlistInputError` no lo
// use; Vitest eleva `vi.mock` por encima de los imports, así que el mock se
// registra antes de evaluar `./waitlist` y evita resolver el alias `@/`.
// Mismo patrón que `core/plans/offline.test.ts`.
vi.mock("../../utils/supabase", () => ({
  supabase: {},
}));

describe("waitlistInputError", () => {
  it("accepts a name and an email that carries an @", () => {
    expect(waitlistInputError("Ana", "ana@ammen.app")).toBe(null);
  });

  it("trims the name before judging it empty", () => {
    expect(waitlistInputError("   ", "ana@ammen.app")).toBe("name");
    expect(waitlistInputError("  Ana  ", "ana@ammen.app")).toBe(null);
  });

  it("rejects an empty name", () => {
    expect(waitlistInputError("", "ana@ammen.app")).toBe("name");
  });

  it("rejects an email without an @", () => {
    expect(waitlistInputError("Ana", "ana")).toBe("email");
    expect(waitlistInputError("Ana", "ana ammen.app")).toBe("email");
    expect(waitlistInputError("Ana", "")).toBe("email");
  });

  // El orden importa: el nombre se revisa antes, así que un formulario con
  // ambos vacíos señala el nombre primero y se corrige en orden.
  it("reports the name before the email when both are wrong", () => {
    expect(waitlistInputError("", "")).toBe("name");
  });
});
