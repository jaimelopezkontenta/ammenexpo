import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import postcss from "postcss";
import tailwind from "tailwindcss";
import { describe, expect, it } from "vitest";

/**
 * Los overrides de `Txt` que no se aplican nunca, ejecutable (pareja de
 * `txt-adoption.test.ts`).
 *
 * El `className` de `Txt` va detrás de la variante en el string, pero eso no
 * decide nada: entre dos clases de la misma familia gana la que va después
 * en la hoja de Tailwind — en web por la cascada, en nativo porque
 * css-interop ordena las reglas por `appearanceOrder` — y dentro de una
 * familia Tailwind las emite en orden alfabético. Así, `text-xs` sí pisa el
 * `text-sm` de caption, pero `variant="editorial" className="text-base"`
 * pinta el `text-lg` de editorial: la clase está en el código y no en la
 * pantalla. Hubo siete así, más un `text-2xl` sobre `reading` y un
 * `text-[11.5px]` sobre `label` (Oleada 5); se quitaron sin cambiar un
 * píxel, porque ninguno había llegado a pintarse.
 *
 * Si este test te ha parado: el tamaño (o el interlineado, o la fuente) que
 * una variante no tiene se pide con otra variante (`captionSm`,
 * `labelStrong`…), no con una clase que pierde.
 */

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components", "core"];

/** La tabla de variantes, leída del fuente: Text.tsx importa react-native. */
const VARIANT: Record<string, string[]> = (() => {
  const source = readFileSync(join(ROOT, "components/ui/Text.tsx"), "utf8");
  const block = source.match(
    /const VARIANT: Record<TxtVariant, string> = \{([\s\S]*?)\n\};/,
  );
  if (!block) throw new Error("no encuentro la tabla VARIANT en Text.tsx");
  return Object.fromEntries(
    [...block[1].matchAll(/^\s+(\w+): "([^"]+)",$/gm)].map((m) => [
      m[1],
      m[2].split(" "),
    ]),
  );
})();

/** Las familias en las que dos clases se pisan (la misma propiedad CSS). */
const FAMILIES: RegExp[] = [
  /^text-(?:xs|sm|base|lg|xl|\d+xl|\[\d[^\]]*\])$/, // font-size
  /^leading-/, // line-height
  /^font-(?:sans|serif|editorial)/, // font-family (los pesos son otra)
  /^tracking-/, // letter-spacing
  /^(?:uppercase|lowercase|capitalize|normal-case)$/, // text-transform
];

const sameFamily = (a: string, b: string) =>
  FAMILIES.some((family) => family.test(a) && family.test(b));

/** Las cadenas literales de una expresión (ramas de un ternario, plantillas). */
const literals = (expr: string): string[] =>
  [...expr.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)].map((m) =>
    (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " "),
  );

/** Cada `<Txt …>` de apertura, con su línea. */
const openingTags = (source: string) => {
  const tags: { tag: string; line: number }[] = [];
  let start = 0;
  while ((start = source.indexOf("<Txt", start)) !== -1) {
    let end = start + 4;
    let depth = 0;
    let quote: string | null = null;
    for (; end < source.length; end++) {
      const c = source[end];
      if (quote) {
        if (c === quote && source[end - 1] !== "\\") quote = null;
      } else if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && source[end - 1] !== "=") break;
    }
    tags.push({
      tag: source.slice(start, end + 1),
      line: source.slice(0, start).split("\n").length,
    });
    start = end;
  }
  return tags;
};

/** El valor de un atributo: literal o expresión entre llaves (sin anidar). */
const attribute = (tag: string, name: string): string | null => {
  const literal = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  if (literal) return `"${literal[1]}"`;
  const at = tag.search(new RegExp(`\\s${name}=\\{`));
  if (at === -1) return null;
  let depth = 0;
  for (let i = tag.indexOf("{", at); i < tag.length; i++) {
    if (tag[i] === "{") depth++;
    else if (tag[i] === "}" && --depth === 0)
      return tag.slice(tag.indexOf("{", at), i + 1);
  }
  return null;
};

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });

const findings: string[] = [];
for (const dir of SCAN_DIRS) {
  for (const file of tsxFiles(join(ROOT, dir))) {
    const where = relative(ROOT, file).replaceAll("\\", "/");
    for (const { tag, line } of openingTags(readFileSync(file, "utf8"))) {
      const className = attribute(tag, "className");
      if (!className) continue;
      const variantAttr = attribute(tag, "variant");
      // Sin variante es `body`; con una expresión, cada variante posible.
      const variants = variantAttr
        ? literals(variantAttr).filter((v) => v in VARIANT)
        : ["body"];
      const classes = literals(className)
        .flatMap((chunk) => chunk.split(/\s+/))
        .filter((c) => c && !c.includes(":"));
      for (const variant of variants) {
        for (const own of VARIANT[variant]) {
          for (const override of classes) {
            if (!sameFamily(own, override)) continue;
            if (override === own) {
              findings.push(`${where}:${line} ${variant}: «${override}» sobra`);
            } else if (override < own) {
              findings.push(
                `${where}:${line} ${variant}: «${override}» no puede con «${own}»`,
              );
            }
          }
        }
      }
    }
  }
}

describe("overrides de Txt", () => {
  it("la tabla de variantes se lee", () => {
    expect(Object.keys(VARIANT).length).toBeGreaterThan(10);
    expect(VARIANT.editorial).toEqual(["font-editorial", "text-lg"]);
  });

  it("ningún className de Txt pierde (o repite) contra su variante", () => {
    expect(findings).toEqual([]);
  });

  // La premisa de todo lo anterior, medida contra el Tailwind de verdad con
  // la config del proyecto: dentro de una familia, el orden de la hoja es el
  // alfabético del nombre de la clase, no el del valor ni el del string.
  it("Tailwind emite cada familia en orden alfabético", async () => {
    const candidates = [
      "text-lg",
      "text-base",
      "text-[11.5px]",
      "text-2xl",
      "text-sm",
      "text-xs",
      "leading-reading",
      "leading-7",
      "leading-9",
      "gap-4",
      "gap-5",
      "gap-10",
      "py-10",
      "py-8",
    ];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require("../tailwind.config.js");
    const result = await postcss([
      tailwind({
        ...config,
        content: [{ raw: candidates.join(" "), extension: "html" }],
      }),
    ]).process("@tailwind utilities;", { from: undefined });
    const order: string[] = [];
    result.root.walkRules((rule) => {
      order.push(rule.selector.slice(1).replaceAll("\\", ""));
    });
    const family = (prefix: string) =>
      order.filter((c) => c.startsWith(prefix));
    for (const prefix of ["text-", "leading-", "gap-", "py-"]) {
      expect(family(prefix)).toEqual([...family(prefix)].sort());
    }
    expect(family("text-")).toEqual([
      "text-2xl",
      "text-[11.5px]",
      "text-base",
      "text-lg",
      "text-sm",
      "text-xs",
    ]);
  });
});
