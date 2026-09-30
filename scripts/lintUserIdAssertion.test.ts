import path from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * La regla que prohíbe `userId!` (eslint.config.js), probada contra la config
 * real: un bloque `files` que redeclara `no-restricted-syntax` la reemplaza
 * entera, así que una excepción mal montada podía apagar el resto del contrato
 * (router.back, las claves de `qk`) en esos ficheros sin que nadie lo viera.
 */

const root = path.resolve(__dirname, "..");
const eslint = new ESLint({ cwd: root });

const USER_ID = "export const f = (userId: string | undefined) => userId!;\n";

const messages = async (code: string, file: string) => {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(root, file),
  });
  return result.messages
    .filter((m) => m.ruleId === "no-restricted-syntax")
    .map((m) => m.message);
};

describe("no userId! (requireUserId)", () => {
  it.each(["core/circles/probe.ts", "app/probe.tsx", "components/probe.tsx"])(
    "fails in %s",
    async (file) => {
      const found = await messages(USER_ID, file);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain("requireUserId");
    },
    30_000,
  );

  it("leaves a non-null assertion on any other name alone", async () => {
    const found = await messages(
      "export const f = (circleId: string | undefined) => circleId!;\n",
      "core/circles/probe.ts",
    );
    expect(found).toEqual([]);
  }, 30_000);

  it("is off in tests, like the rest of the contract", async () => {
    expect(await messages(USER_ID, "core/circles/probe.test.ts")).toEqual([]);
  }, 30_000);
});
