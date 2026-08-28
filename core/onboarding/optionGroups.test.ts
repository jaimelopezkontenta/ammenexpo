import { describe, expect, it } from "vitest";

import {
  SEASON_GROUPS,
  SEASON_KEYS,
  TOPIC_GROUPS,
  TOPIC_KEYS,
} from "./options";

/**
 * Los grupos del onboarding son una PARTICIÓN de sus listas: si alguien añade
 * una temporada o un tema y olvida darle familia, el chip desaparecería de la
 * pantalla en silencio — este test lo convierte en un rojo con nombre.
 */
describe("familias del onboarding", () => {
  it.each([
    ["temporadas", SEASON_GROUPS, SEASON_KEYS],
    ["temas", TOPIC_GROUPS, TOPIC_KEYS],
  ] as const)(
    "%s: partición exacta, sin huérfanos ni repetidos",
    (_name, groups, keys) => {
      const grouped = groups.flatMap((group) => group.keys);

      expect([...grouped].sort()).toEqual([...keys].sort());
      expect(new Set(grouped).size).toBe(grouped.length);
    },
  );
});
