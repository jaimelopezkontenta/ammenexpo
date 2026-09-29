import { describe, expect, it } from "vitest";

import { toFlagState } from "./flagState";

describe("toFlagState", () => {
  it("un true del servidor es encendido, y un false es apagado", () => {
    expect(toFlagState(true)).toBe("on");
    expect(toFlagState(false)).toBe("off");
  });

  // El caso que importa: mientras carga (`undefined`) o si la lectura falla
  // (no hay dato), no se sabe. Tratarlo como apagado enseñaría «abre pronto» a
  // quien solo tiene la red caída.
  it("sin dato (cargando o lectura fallida) es desconocido, no apagado", () => {
    expect(toFlagState(undefined)).toBe("unknown");
    expect(toFlagState(null)).toBe("unknown");
  });

  it("una respuesta que no es un booleano tampoco se toma por apagado", () => {
    expect(toFlagState("false")).toBe("unknown");
    expect(toFlagState(0)).toBe("unknown");
    expect(toFlagState({})).toBe("unknown");
  });
});
