import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SUITES,
  aliasCommand,
  checkPackageScripts,
  checkSuiteFiles,
  failureLines,
  formatDuration,
  parseArgs,
  selectSuites,
} from "./dbTest.mjs";

const root = path.resolve(__dirname, "..");
const packageScripts = (): Record<string, string> =>
  JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts;

describe("parseArgs", () => {
  it("runs everything by default, with a reset per suite", () => {
    expect(parseArgs([])).toEqual({
      only: null,
      noReset: false,
      list: false,
      help: false,
      errors: [],
    });
  });

  it("takes --only as a comma list, in the order given and without repeats", () => {
    expect(parseArgs(["--only", "email,rls,email"]).only).toEqual([
      "email",
      "rls",
    ]);
    expect(parseArgs(["--only=scheduler"]).only).toEqual(["scheduler"]);
    expect(parseArgs(["--only", "rls", "--only", "flows"]).only).toEqual([
      "rls",
      "flows",
    ]);
  });

  it("names the suite that does not exist instead of running nothing", () => {
    const { errors } = parseArgs(["--only", "rsl"]);
    expect(errors).toEqual([expect.stringContaining("«rsl»")]);
  });

  it("refuses --only without a list and unknown flags", () => {
    expect(parseArgs(["--only"]).errors).toHaveLength(1);
    expect(parseArgs(["--only", "--no-reset"]).errors).toHaveLength(1);
    expect(parseArgs(["--fast"]).errors).toEqual([
      expect.stringContaining("--fast"),
    ]);
  });

  it("understands --no-reset, --list and --help", () => {
    expect(parseArgs(["--only", "email", "--no-reset"])).toMatchObject({
      only: ["email"],
      noReset: true,
    });
    expect(parseArgs(["--list"]).list).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });
});

describe("selectSuites", () => {
  it("leaves the optional harnesses out of the default run", () => {
    const selected = selectSuites(SUITES, null).map((suite) => suite.name);

    expect(selected).toEqual([
      "rls",
      "flows",
      "streak",
      "timezone",
      "bible",
      "circles",
      "plans",
      "storage",
      "social",
      "flags",
      "push",
      "generation",
      "email",
      "rescued",
      "scheduler",
    ]);
  });

  it("runs exactly what --only asks for, optional ones included", () => {
    const selected = selectSuites(SUITES, ["generation-races", "rls"]).map(
      (suite) => suite.name,
    );

    expect(selected).toEqual(["generation-races", "rls"]);
  });
});

describe("the suite list", () => {
  it("points every suite at a file that exists in the repo", () => {
    expect(
      checkSuiteFiles(SUITES, (file) => existsSync(path.join(root, file))),
    ).toEqual([]);
  });

  it("covers every test file in supabase/tests", () => {
    const listed = new Set(SUITES.map((suite) => path.basename(suite.file)));
    const onDisk = readdirSync(path.join(root, "supabase", "tests")).filter(
      (file) => /\.(sql|sh)$/u.test(file),
    );

    expect(onDisk.filter((file) => !listed.has(file))).toEqual([]);
  });

  it("catches a missing file, a duplicate and a kind that does not match", () => {
    const errors = checkSuiteFiles(
      [
        { name: "a", file: "supabase/tests/a.sql", kind: "sql" },
        { name: "a", file: "supabase/tests/a.sql", kind: "sql" },
        { name: "b", file: "supabase/tests/b.sh", kind: "sql" },
      ],
      (file) => file.endsWith("a.sql"),
    );

    expect(errors).toEqual([
      expect.stringContaining("dos veces"),
      expect.stringContaining("tipo sql"),
      expect.stringContaining("no existe"),
    ]);
  });
});

describe("package.json scripts", () => {
  it("has one db:test:<suite> alias per suite and nothing orphaned", () => {
    expect(checkPackageScripts(packageScripts())).toEqual([]);
  });

  it("flags an alias with no suite behind it", () => {
    const scripts = {
      ...packageScripts(),
      "db:test:friends": aliasCommand("friends"),
    };

    expect(checkPackageScripts(scripts)).toEqual([
      expect.stringContaining("«db:test:friends» no corresponde"),
    ]);
  });

  it("flags a suite that lost its alias and one that went back to the shell chain", () => {
    const { "db:test:email": _removed, ...rest } = packageScripts();
    const scripts = {
      ...rest,
      "db:test:rls":
        "node scripts/supabaseDbReset.mjs && docker exec -i supabase_db_ammen psql -f - < supabase/tests/rls.sql",
    };

    expect(checkPackageScripts(scripts)).toEqual([
      expect.stringContaining("«db:test:rls» debería ser"),
      expect.stringContaining("«db:test:rls» llama a supabase/tests"),
      expect.stringContaining("«email» no tiene alias"),
    ]);
  });

  it("keeps db:test behind the database lock", () => {
    const scripts = {
      ...packageScripts(),
      "db:test": "node scripts/dbTest.mjs",
    };

    expect(checkPackageScripts(scripts)).toEqual([
      expect.stringContaining("with-db-lock"),
    ]);
  });
});

describe("output helpers", () => {
  it("formats durations for the summary", () => {
    expect(formatDuration(3_140)).toBe("3.1s");
    expect(formatDuration(83_400)).toBe("1m23s");
    expect(formatDuration(600_000)).toBe("10m00s");
  });

  it("keeps the lines that explain a failure and drops the PASS noise", () => {
    const output = [
      "psql:<stdin>:40: NOTICE:  PASS  new accounts default to daily cadence",
      "psql:<stdin>:52: ERROR:  FAIL  one-click sets cadence to off",
      "CONTEXT:  PL/pgSQL function pg_temp_3.assert(boolean,text) line 6 at RAISE",
    ].join("\n");

    expect(failureLines(output)).toEqual([
      "psql:<stdin>:52: ERROR:  FAIL  one-click sets cadence to off",
    ]);
  });
});
