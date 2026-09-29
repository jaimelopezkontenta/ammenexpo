import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_FONT_SCALE, remFromPx, ROOT_FONT_PX } from "./typography";

/**
 * La letra grande del sistema, con tope (Oleada 5).
 *
 * Nada llevaba `maxFontSizeMultiplier`: con el texto más grande del teléfono
 * las pills y la barra se partían. El tope vive en `Txt` y en cada
 * `TextInput`; en web, donde el multiplicador no existe, la barra de
 * pestañas dejó de tener alto fijo y su etiqueta va en `rem`.
 */

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Cada `<Nombre …>` de apertura en JSX (no un genérico `<Nombre,`). */
const openingTags = (source: string, name: string) => {
  const tags: { tag: string; line: number }[] = [];
  for (const match of source.matchAll(new RegExp(`<${name}\\s`, "g"))) {
    const start = match.index;
    let end = start;
    let depth = 0;
    for (; end < source.length; end++) {
      const c = source[end];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && source[end - 1] !== "=") break;
    }
    tags.push({
      tag: source.slice(start, end + 1),
      line: source.slice(0, start).split("\n").length,
    });
  }
  return tags;
};

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });

describe("tope de la letra del sistema", () => {
  it("es razonable: crece, pero no tanto que los rótulos no quepan", () => {
    expect(MAX_FONT_SCALE).toBeGreaterThanOrEqual(1.3);
    expect(MAX_FONT_SCALE).toBeLessThanOrEqual(2);
  });

  it("Txt lo pone por defecto y deja pedir otro", () => {
    const source = read("components/ui/Text.tsx");
    expect(source).toMatch(/maxFontSizeMultiplier = MAX_FONT_SCALE/);
    expect(source).toMatch(/maxFontSizeMultiplier=\{maxFontSizeMultiplier\}/);
  });

  it("todo TextInput de la app lo lleva", () => {
    const missing: string[] = [];
    for (const dir of ["app", "components", "core"]) {
      for (const file of tsxFiles(join(ROOT, dir))) {
        const source = readFileSync(file, "utf8");
        for (const { tag, line } of openingTags(source, "TextInput")) {
          if (!tag.includes("maxFontSizeMultiplier")) {
            missing.push(
              `${relative(ROOT, file).replaceAll("\\", "/")}:${line}`,
            );
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("la barra de pestañas en web", () => {
  it("la etiqueta en rem mide 11,5 px con la letra por defecto", () => {
    expect(remFromPx(11.5)).toBe("0.71875rem");
    expect(parseFloat(remFromPx(11.5)) * ROOT_FONT_PX).toBe(11.5);
  });

  it("62 px es el mínimo, no un alto fijo", () => {
    const layout = read("app/(tabs)/_layout.tsx");
    expect(layout).toMatch(/TAB_BAR_WEB_MIN_HEIGHT = 62;/);
    expect(layout).toMatch(/minHeight: TAB_BAR_WEB_MIN_HEIGHT/);
    expect(layout).toMatch(/height: "auto"/);
    expect(layout).not.toMatch(/height: 62/);
    expect(layout).not.toMatch(/fontSize: 11\.5/);
  });
});
