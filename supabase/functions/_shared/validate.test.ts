import { describe, expect, it } from "vitest";

import {
  cleanText,
  fail,
  isAbsent,
  isRecord,
  isUuid,
  ok,
  parseAllowlist,
  parseBoundedText,
  parseOptionalEnum,
  parseOptionalUuid,
  parseUuidList,
  truncateChars,
} from "./validate.ts";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb";

describe("isUuid", () => {
  it("acepta un UUID en minúscula y en mayúscula", () => {
    expect(isUuid(A)).toBe(true);
    expect(isUuid(A.toUpperCase())).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("rechaza lo que no es un UUID completo", () => {
    for (const bad of [
      "",
      "not-a-uuid",
      A.slice(1),
      `${A}0`,
      ` ${A}`,
      `${A}\n`,
      `{${A}}`,
      A.replaceAll("-", ""),
      "gggggggg-gggg-4ggg-8ggg-gggggggggggg",
      `${A}'; drop table prayer_plans; --`,
    ]) {
      expect(isUuid(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("rechaza cualquier cosa que no sea una cadena", () => {
    for (const bad of [null, undefined, 1, true, {}, [A], Symbol.iterator]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe("isAbsent / isRecord", () => {
  it("ausente es solo undefined y null", () => {
    expect(isAbsent(undefined)).toBe(true);
    expect(isAbsent(null)).toBe(true);
    expect(isAbsent("")).toBe(false);
    expect(isAbsent(0)).toBe(false);
    expect(isAbsent(false)).toBe(false);
  });

  it("un objeto es un registro; un array o null, no", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});

describe("parseOptionalUuid", () => {
  it("ausente es null", () => {
    expect(parseOptionalUuid(undefined)).toEqual(ok(null));
    expect(parseOptionalUuid(null)).toEqual(ok(null));
  });

  it("un UUID pasa; lo demás, not_uuid", () => {
    expect(parseOptionalUuid(A)).toEqual(ok(A));
    expect(parseOptionalUuid("abc")).toEqual(fail("not_uuid"));
    expect(parseOptionalUuid(7)).toEqual(fail("not_uuid"));
    expect(parseOptionalUuid("")).toEqual(fail("not_uuid"));
  });
});

describe("parseUuidList", () => {
  it("ausente es lista vacía", () => {
    expect(parseUuidList(undefined, { max: 5 })).toEqual(ok([]));
    expect(parseUuidList(null, { max: 5 })).toEqual(ok([]));
    expect(parseUuidList([], { max: 5 })).toEqual(ok([]));
  });

  it("conserva el orden y quita repetidos (sin distinguir mayúsculas)", () => {
    expect(parseUuidList([B, A, B, A.toUpperCase()], { max: 5 })).toEqual(
      ok([B, A]),
    );
  });

  it("un elemento malo rechaza la lista entera", () => {
    expect(parseUuidList([A, "nope"], { max: 5 })).toEqual(fail("not_uuid"));
    expect(parseUuidList([A, 3], { max: 5 })).toEqual(fail("not_uuid"));
    expect(parseUuidList([A, null], { max: 5 })).toEqual(fail("not_uuid"));
  });

  it("no acepta lo que no es un array", () => {
    expect(parseUuidList(A, { max: 5 })).toEqual(fail("not_array"));
    expect(parseUuidList({ 0: A }, { max: 5 })).toEqual(fail("not_array"));
  });

  it("el tope cuenta lo que llega, no lo que queda tras quitar repetidos", () => {
    expect(parseUuidList([A, A, A], { max: 2 })).toEqual(fail("too_many"));
    expect(parseUuidList([A, B], { max: 2 })).toEqual(ok([A, B]));
  });

  it("una lista enorme se rechaza sin mirar sus elementos", () => {
    const huge = new Array(100_000).fill("basura");
    expect(parseUuidList(huge, { max: 20 })).toEqual(fail("too_many"));
  });
});

describe("parseAllowlist", () => {
  const allowed = ["peace", "hope", "rest"] as const;

  it("ausente es lista vacía", () => {
    expect(parseAllowlist(undefined, allowed, { max: 3 })).toEqual(ok([]));
  });

  it("acepta claves permitidas, sin repetidos y en orden", () => {
    expect(
      parseAllowlist(["hope", "peace", "hope"], allowed, { max: 5 }),
    ).toEqual(ok(["hope", "peace"]));
  });

  it("una clave fuera de la lista rechaza la lista entera", () => {
    expect(parseAllowlist(["peace", "paz"], allowed, { max: 5 })).toEqual(
      fail("not_allowed"),
    );
  });

  it("no coacciona ni distingue mayúsculas", () => {
    expect(parseAllowlist(["Peace"], allowed, { max: 5 })).toEqual(
      fail("not_allowed"),
    );
    expect(parseAllowlist([1], allowed, { max: 5 })).toEqual(
      fail("not_string"),
    );
    expect(parseAllowlist([null], allowed, { max: 5 })).toEqual(
      fail("not_string"),
    );
  });

  it("una clave con forma de propiedad heredada no cuela", () => {
    expect(parseAllowlist(["__proto__"], allowed, { max: 5 })).toEqual(
      fail("not_allowed"),
    );
    expect(parseAllowlist(["constructor"], allowed, { max: 5 })).toEqual(
      fail("not_allowed"),
    );
  });

  it("respeta el tope de longitud de la lista", () => {
    expect(
      parseAllowlist(["peace", "hope", "rest", "peace"], allowed, { max: 3 }),
    ).toEqual(fail("too_many"));
  });

  it("un valor que no es array es not_array", () => {
    expect(parseAllowlist("peace", allowed, { max: 3 })).toEqual(
      fail("not_array"),
    );
    expect(
      parseAllowlist({ length: 1, 0: "peace" }, allowed, { max: 3 }),
    ).toEqual(fail("not_array"));
  });
});

describe("parseBoundedText", () => {
  const opts = { max: 10, hardMax: 30 };

  it("ausente o en blanco es null", () => {
    expect(parseBoundedText(undefined, opts)).toEqual(ok(null));
    expect(parseBoundedText(null, opts)).toEqual(ok(null));
    expect(parseBoundedText("   \n\t ", opts)).toEqual(ok(null));
  });

  it("recorta los espacios de los bordes", () => {
    expect(parseBoundedText("  hola  ", opts)).toEqual(ok("hola"));
  });

  it("pasado el tope blando se recorta, no se rechaza", () => {
    expect(parseBoundedText("abcdefghijklmnop", opts)).toEqual(
      ok("abcdefghij"),
    );
  });

  it("pasado el tope duro se rechaza", () => {
    expect(parseBoundedText("x".repeat(31), opts)).toEqual(fail("too_long"));
    expect(parseBoundedText("x".repeat(30), opts)).toEqual(ok("xxxxxxxxxx"));
  });

  it("el tope duro mira lo que llega, antes de recortar los espacios", () => {
    expect(parseBoundedText(`${" ".repeat(40)}hola`, opts)).toEqual(
      fail("too_long"),
    );
  });

  it("no acepta lo que no es una cadena", () => {
    for (const bad of [1, true, {}, ["a"]]) {
      expect(parseBoundedText(bad, opts)).toEqual(fail("not_string"));
    }
  });

  it("no parte un emoji al recortar", () => {
    const out = parseBoundedText("ab😀😀😀😀😀😀😀😀😀😀", {
      max: 3,
      hardMax: 100,
    });

    expect(out).toEqual(ok("ab😀"));
  });

  it("quita el NUL, que Postgres no admite en un jsonb", () => {
    expect(parseBoundedText("a\u0000b", opts)).toEqual(ok("ab"));
  });
});

describe("cleanText", () => {
  it("quita controles pero conserva tabulador y saltos de línea", () => {
    expect(cleanText("a\u0001b\tc\nd\re\u007ff\u001Fg")).toBe("ab\tc\nd\refg");
  });

  it("sustituye una mitad de par sustituto suelta", () => {
    expect(cleanText("a\uD83Db")).toBe("a�b");
    expect(cleanText("a\uDE00b")).toBe("a�b");
  });

  it("deja intacto un par sustituto completo", () => {
    expect(cleanText("😀")).toBe("😀");
  });

  it("el resultado se serializa sin escapes de sustituto sueltos", () => {
    expect(JSON.stringify(cleanText("x\uD83D"))).not.toMatch(/\\ud[89ab]/i);
  });
});

describe("truncateChars", () => {
  it("no toca lo que cabe", () => {
    expect(truncateChars("hola", 4)).toBe("hola");
    expect(truncateChars("", 0)).toBe("");
  });

  it("recorta por caracteres, no por unidades UTF-16", () => {
    expect(truncateChars("😀😀😀", 2)).toBe("😀😀");
  });
});

describe("parseOptionalEnum", () => {
  const allowed = ["private", "circles", "link", "public"] as const;

  it("ausente es null", () => {
    expect(parseOptionalEnum(undefined, allowed)).toEqual(ok(null));
    expect(parseOptionalEnum(null, allowed)).toEqual(ok(null));
  });

  it("un valor de la lista pasa; otro, not_allowed", () => {
    expect(parseOptionalEnum("link", allowed)).toEqual(ok("link"));
    expect(parseOptionalEnum("group", allowed)).toEqual(fail("not_allowed"));
    expect(parseOptionalEnum("LINK", allowed)).toEqual(fail("not_allowed"));
  });

  it("una no-cadena es not_string", () => {
    expect(parseOptionalEnum(1, allowed)).toEqual(fail("not_string"));
    expect(parseOptionalEnum(["link"], allowed)).toEqual(fail("not_string"));
  });
});
