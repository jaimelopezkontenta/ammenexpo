#!/usr/bin/env node
/**
 * Copia secretos de Edge Functions: Google Cloud Secret Manager → Supabase.
 *
 * GCP es la fuente de verdad. Este script no crea cuentas de Resend, no
 * toca DNS y no imprime valores. Staging vive en el proyecto Firebase/GCP
 * `ammen-staging` y en el ref de Supabase `syprzdjznuppckenuaua`. Producción
 * aún no está mapeada: hay que pasar `--gcp-project` y `--project-ref`.
 *
 * El proyecto por defecto de `gcloud` en esta máquina puede ser otro
 * (`trabaja-la`). Nunca se usa: cada llamada lleva `--project` explícito.
 *
 * Uso:
 *   npm run secrets:pull
 *   npm run secrets:push -- --env-file supabase/functions/.env.staging.local
 *   node scripts/secretsSync.mjs list --env staging
 *   node scripts/secretsSync.mjs pull --only RESEND_API_KEY,EMAIL_ALLOWLIST
 *
 * El mapeo GCP → Supabase es identidad: el nombre del secreto en Secret
 * Manager es el mismo que la variable de la Edge Function.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const GCLOUD = process.platform === "win32" ? "gcloud.cmd" : "gcloud";

/** Secretos de Edge en remoto. UNSLOTH_* es solo local y no entra. */
export const EDGE_SECRETS = Object.freeze([
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "EMAIL_ALLOWLIST",
  "EMAIL_SENDER_ENABLED",
  "EMAIL_APP_ORIGIN",
  "AMMEN_EMAIL_INVOKE_SECRET",
  "ANTHROPIC_API_KEY",
  "PUSH_SENDER_ENABLED",
  "AMMEN_PUSH_INVOKE_SECRET",
]);

export const LOCAL_ONLY_KEYS = Object.freeze([
  "UNSLOTH_URL",
  "UNSLOTH_MODEL",
  "UNSLOTH_API_KEY",
]);

export const ENVIRONMENTS = Object.freeze({
  staging: Object.freeze({
    gcpProject: "ammen-staging",
    supabaseProjectRef: "syprzdjznuppckenuaua",
  }),
});

export const gcpSecretName = (supabaseKey) => supabaseKey;
export const supabaseEnvName = (gcpName) => gcpName;

export const parseArgs = (argv) => {
  const args = {
    command: "pull",
    env: undefined,
    gcpProject: undefined,
    projectRef: undefined,
    envFile: undefined,
    only: undefined,
    dryRun: false,
    help: false,
  };

  let index = 0;
  if (argv[0] && !argv[0].startsWith("-")) {
    const command = argv[0];
    if (
      command !== "pull" &&
      command !== "push" &&
      command !== "seed" &&
      command !== "list"
    ) {
      throw new Error(
        `comando desconocido "${command}" (usa pull, push, seed o list)`,
      );
    }
    args.command = command === "seed" ? "push" : command;
    index = 1;
  }

  while (index < argv.length) {
    const token = argv[index];
    const next = argv[index + 1];
    const [flag, inline] = token.includes("=")
      ? [
          token.slice(0, token.indexOf("=")),
          token.slice(token.indexOf("=") + 1),
        ]
      : [token, undefined];

    const takeValue = () => {
      if (inline !== undefined) return inline;
      if (!next || next.startsWith("-")) {
        throw new Error(`${flag} exige un valor`);
      }
      index += 1;
      return next;
    };

    switch (flag) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--env":
        args.env = takeValue();
        break;
      case "--project":
      case "--gcp-project":
        args.gcpProject = takeValue();
        break;
      case "--project-ref":
        args.projectRef = takeValue();
        break;
      case "--env-file":
        args.envFile = takeValue();
        break;
      case "--only":
        args.only = takeValue();
        break;
      default:
        throw new Error(`flag desconocido "${token}"`);
    }
    index += 1;
  }

  return args;
};

export const parseEnvFile = (contents) => {
  const values = new Map();

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;
    const equals = withoutExport.indexOf("=");
    if (equals <= 0) continue;
    const key = withoutExport.slice(0, equals).trim();
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key)) continue;
    let raw = withoutExport.slice(equals + 1).trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      raw = raw.slice(1, -1);
    }
    values.set(key, raw.replace(/\\n/gu, "\n").replace(/\\"/gu, '"'));
  }

  return values;
};

export const serializeEnvFile = (values) => {
  const lines = [];
  for (const key of [...values.keys()].sort()) {
    const value = values.get(key) ?? "";
    const escaped = value
      .replace(/\\/gu, "\\\\")
      .replace(/"/gu, '\\"')
      .replace(/\n/gu, "\\n");
    lines.push(`${key}="${escaped}"`);
  }
  return `${lines.join("\n")}\n`;
};

export const selectSecrets = (only) => {
  if (!only || !only.trim()) return [...EDGE_SECRETS];

  const requested = only
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (requested.length === 0) {
    throw new Error("--only quedó vacío");
  }

  const unknown = [];
  const localOnly = [];
  for (const key of requested) {
    if (LOCAL_ONLY_KEYS.includes(key)) localOnly.push(key);
    else if (!EDGE_SECRETS.includes(key)) unknown.push(key);
  }

  if (localOnly.length > 0) {
    throw new Error(
      `${localOnly.join(", ")} es solo local (LM Studio) y no se sincroniza`,
    );
  }
  if (unknown.length > 0) {
    throw new Error(
      `claves fuera del catálogo: ${unknown.join(", ")}. ` +
        `Catálogo: ${EDGE_SECRETS.join(", ")}`,
    );
  }

  return requested;
};

export const valuesForCatalog = (parsed, keys) => {
  const missing = [];
  const skipped = [];
  const selected = new Map();

  for (const [key] of parsed) {
    if (LOCAL_ONLY_KEYS.includes(key) || !EDGE_SECRETS.includes(key)) {
      skipped.push(key);
    }
  }

  for (const key of keys) {
    const value = parsed.get(key);
    if (typeof value !== "string" || value.trim() === "") {
      missing.push(key);
      continue;
    }
    selected.set(key, value.trim());
  }

  if (missing.length > 0) {
    throw new Error(
      `faltan claves (o están vacías) en el fichero local: ${missing.join(", ")}`,
    );
  }

  return { selected, skipped };
};

export const redactSecrets = (text, values) => {
  let out = text;
  for (const value of values) {
    if (typeof value !== "string" || value.length < 4) continue;
    out = out.split(value).join("***");
  }
  return out;
};

export const readLinkedProjectRef = (root = process.cwd()) => {
  const file = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(file)) return null;
  const value = readFileSync(file, "utf8").trim();
  return value || null;
};

/**
 * Resuelve GCP project y Supabase project-ref.
 * `linkedRef` es lo que devuelve `readLinkedProjectRef` (string o null).
 * `env` es inyectable; por defecto `process.env`.
 *
 * @param {{ env?: string, gcpProject?: string, projectRef?: string }} args
 * @param {{ linkedRef?: string | null, env?: NodeJS.ProcessEnv }} [options]
 */
export const resolveTargets = (
  args,
  { linkedRef = null, env = process.env } = {},
) => {
  const environment = args.env ?? env.AMMEN_ENV ?? "staging";
  const known = ENVIRONMENTS[environment];

  if (args.env && !known && !(args.gcpProject && args.projectRef)) {
    throw new Error(
      `no hay mapeo para --env ${environment}. Pasa --gcp-project y ` +
        `--project-ref (hoy solo está definido staging).`,
    );
  }

  const gcpProject =
    args.gcpProject || env.AMMEN_GCP_PROJECT || known?.gcpProject || "";
  const supabaseProjectRef =
    args.projectRef ||
    env.AMMEN_SUPABASE_PROJECT_REF ||
    known?.supabaseProjectRef ||
    linkedRef ||
    "";

  if (!gcpProject) {
    throw new Error(
      "falta el proyecto GCP. Usa --gcp-project / --project, AMMEN_GCP_PROJECT " +
        "o --env staging.",
    );
  }
  if (!supabaseProjectRef) {
    throw new Error(
      "falta el project-ref de Supabase. Usa --project-ref, " +
        "AMMEN_SUPABASE_PROJECT_REF, `npx supabase link`, o --env staging.",
    );
  }

  return { environment, gcpProject, supabaseProjectRef };
};

const helpText = () => `secretsSync — GCP Secret Manager → supabase secrets set

GCP es la fuente de verdad. Los valores nunca se imprimen.

Comandos:
  pull   (default)  lee Secret Manager y los pone en el proyecto Supabase
  push   | seed     escribe un .env local (gitignored) en GCP y luego pull
  list              nombres del catálogo y cuáles existen en GCP

Flags:
  --env staging
  --project / --gcp-project ID     (nunca se usa el default de gcloud)
  --project-ref REF
  --env-file PATH                  (solo push/seed)
  --only KEY,KEY
  --dry-run

Mapeo: el nombre en GCP es idéntico al de la Edge Function.
Catálogo: ${EDGE_SECRETS.join(", ")}
No se sincroniza: ${LOCAL_ONLY_KEYS.join(", ")}

Ver docs/runbooks/secrets-sync.md
`;

const fail = (message) => {
  console.error(`secretsSync: ${message}`);
  process.exitCode = 1;
};

const run = (command, args, { input, allowFailure = false } = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    const notFound =
      result.error.code === "ENOENT"
        ? command === GCLOUD
          ? "No está `gcloud` en el PATH. Instala Google Cloud SDK y corre `gcloud auth login`."
          : `No se encontró ${command}.`
        : result.error.message;
    throw new Error(notFound);
  }

  if (!allowFailure && result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    throw new Error(
      stderr || stdout || `${command} salió con ${result.status}`,
    );
  }

  return result;
};

const requireGcloudAuth = (gcpProject) => {
  const auth = run(GCLOUD, [
    "auth",
    "list",
    "--filter=status:ACTIVE",
    "--format=value(account)",
  ]);
  const account = (auth.stdout ?? "").trim().split(/\r?\n/u)[0];
  if (!account) {
    throw new Error(
      "no hay cuenta activa de gcloud. Corre `gcloud auth login`.",
    );
  }

  const project = run(
    GCLOUD,
    ["projects", "describe", gcpProject, "--format=value(projectId)"],
    { allowFailure: true },
  );
  if (project.status !== 0) {
    const detail = (project.stderr ?? project.stdout ?? "").trim();
    throw new Error(
      `no se pudo leer el proyecto GCP "${gcpProject}". ` +
        `¿ID mal escrito, sin permiso, o gcloud apuntando a otra cuenta? ` +
        `Nunca usamos el proyecto por defecto de gcloud. ${detail}`.trim(),
    );
  }
};

const listGcpSecretIds = (gcpProject) => {
  const result = run(
    GCLOUD,
    ["secrets", "list", `--project=${gcpProject}`, "--format=value(name)"],
    { allowFailure: true },
  );
  if (result.status !== 0) {
    const detail = (result.stderr ?? result.stdout ?? "").trim();
    if (/SERVICE_DISABLED|secretmanager/i.test(detail)) {
      throw new Error(
        `Secret Manager no está habilitado en ${gcpProject}. ` +
          `gcloud services enable secretmanager.googleapis.com --project=${gcpProject}`,
      );
    }
    throw new Error(
      `no se pudieron listar secretos en ${gcpProject}. ${detail}`.trim(),
    );
  }

  return new Set(
    (result.stdout ?? "")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => name.split("/").pop()),
  );
};

const accessGcpSecret = (gcpProject, name) => {
  const result = run(
    GCLOUD,
    [
      "secrets",
      "versions",
      "access",
      "latest",
      `--secret=${name}`,
      `--project=${gcpProject}`,
    ],
    { allowFailure: true },
  );
  if (result.status !== 0) {
    const detail = (result.stderr ?? "").trim();
    if (/NOT_FOUND|not found/i.test(detail)) {
      throw new Error(
        `el secreto ${name} no existe en ${gcpProject}. ` +
          `Créalo una vez (docs/runbooks/secrets-sync.md) y vuelve a correr pull.`,
      );
    }
    throw new Error(
      `no se pudo leer ${name} en ${gcpProject}. ${detail}`.trim(),
    );
  }
  return (result.stdout ?? "").replace(/^\uFEFF/u, "").trim();
};

const writeGcpSecret = (gcpProject, name, value, existing) => {
  const args = existing.has(name)
    ? [
        "secrets",
        "versions",
        "add",
        name,
        "--data-file=-",
        `--project=${gcpProject}`,
      ]
    : [
        "secrets",
        "create",
        name,
        "--replication-policy=automatic",
        "--data-file=-",
        `--project=${gcpProject}`,
      ];
  run(GCLOUD, args, { input: value });
};

const applySupabaseSecrets = (projectRef, values, dryRun) => {
  const serialized = serializeEnvFile(values);
  if (dryRun) {
    console.log(
      `secretsSync: dry-run, no se llama a supabase secrets set ` +
        `(${[...values.keys()].join(", ")})`,
    );
    return;
  }

  const dir = mkdtempSync(path.join(tmpdir(), "ammen-secrets-"));
  const file = path.join(dir, "edge.env");
  try {
    writeFileSync(file, serialized, { encoding: "utf8", mode: 0o600 });
    run(NPX, [
      "supabase",
      "secrets",
      "set",
      "--env-file",
      file,
      "--project-ref",
      projectRef,
    ]);
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : String(caught);
    const redacted = redactSecrets(reason, values.values());
    if (/not linked|project ref|access token|Not logged in/i.test(reason)) {
      throw new Error(
        `Supabase no aceptó el project-ref ${projectRef}. ` +
          `¿\`npx supabase login\` hecho? ¿ref correcto? ${redacted}`,
      );
    }
    throw new Error(redacted);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const pullFromGcp = (gcpProject, keys) => {
  const existing = listGcpSecretIds(gcpProject);
  const missing = keys.filter((key) => !existing.has(gcpSecretName(key)));
  if (missing.length > 0) {
    throw new Error(
      `faltan en Secret Manager (${gcpProject}): ${missing.join(", ")}. ` +
        `Créalos o limita con --only. Nada se escribió en Supabase.`,
    );
  }

  const selected = new Map();
  for (const key of keys) {
    const value = accessGcpSecret(gcpProject, gcpSecretName(key));
    if (!value) {
      throw new Error(
        `${key} existe en ${gcpProject} pero la versión latest está vacía. ` +
          `Nada se escribió en Supabase.`,
      );
    }
    selected.set(key, value);
  }

  return selected;
};

const runList = (gcpProject, keys) => {
  const existing = listGcpSecretIds(gcpProject);
  console.log(
    `secretsSync: catálogo → GCP ${gcpProject} (nombres, sin valores)\n`,
  );
  for (const key of keys) {
    const gcpName = gcpSecretName(key);
    const mark = existing.has(gcpName) ? "presente" : "AUSENTE";
    console.log(`  ${gcpName}  →  ${supabaseEnvName(gcpName)}  (${mark})`);
  }
  const absent = keys.filter((key) => !existing.has(gcpSecretName(key)));
  if (absent.length > 0) {
    throw new Error(`aún no creados: ${absent.join(", ")}`);
  }
};

const defaultPushEnvFile = (environment) =>
  environment === "staging"
    ? path.join("supabase", "functions", ".env.staging.local")
    : null;

const runPush = (targets, args, keys) => {
  const envFile = args.envFile || defaultPushEnvFile(targets.environment);
  if (!envFile) {
    throw new Error(
      "push exige --env-file (un .env local gitignored). " +
        "No se inventa un fichero ni se leen secretos del repo.",
    );
  }
  if (!existsSync(envFile)) {
    throw new Error(
      `no existe ${envFile}. Cópialo a mano desde valores que ya tengas; ` +
        `nunca se commitea. Ver docs/runbooks/secrets-sync.md.`,
    );
  }

  const parsed = parseEnvFile(readFileSync(envFile, "utf8"));
  const { selected, skipped } = valuesForCatalog(parsed, keys);
  const localOnlySkipped = skipped.filter((key) =>
    LOCAL_ONLY_KEYS.includes(key),
  );
  if (localOnlySkipped.length > 0) {
    console.log(
      `secretsSync: omitidos (solo local): ${localOnlySkipped.join(", ")}`,
    );
  }

  if (args.dryRun) {
    console.log(
      `secretsSync: dry-run, no se escribe en GCP ni en Supabase ` +
        `(${[...selected.keys()].join(", ")})`,
    );
    return;
  }

  const existing = listGcpSecretIds(targets.gcpProject);
  for (const [key, value] of selected) {
    writeGcpSecret(targets.gcpProject, gcpSecretName(key), value, existing);
    existing.add(gcpSecretName(key));
  }
  console.log(
    `secretsSync: escritos en GCP ${targets.gcpProject}: ${[...selected.keys()].join(", ")}`,
  );

  applySupabaseSecrets(targets.supabaseProjectRef, selected, false);
  console.log(
    `secretsSync: aplicados en Supabase ${targets.supabaseProjectRef} ` +
      `(${[...selected.keys()].join(", ")})`,
  );
};

const runPull = (targets, args, keys) => {
  const selected = pullFromGcp(targets.gcpProject, keys);
  console.log(
    `secretsSync: leídos de GCP ${targets.gcpProject}: ${[...selected.keys()].join(", ")}`,
  );
  applySupabaseSecrets(targets.supabaseProjectRef, selected, args.dryRun);
  if (!args.dryRun) {
    console.log(
      `secretsSync: aplicados en Supabase ${targets.supabaseProjectRef} ` +
        `(${[...selected.keys()].join(", ")})`,
    );
  }
};

export const main = (argv = process.argv.slice(2)) => {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(helpText());
    return;
  }

  const keys = selectSecrets(args.only);
  const linkedRef = readLinkedProjectRef();
  const targets = resolveTargets(args, { linkedRef });

  console.log(
    `secretsSync: ${args.command}  GCP=${targets.gcpProject}  ` +
      `Supabase=${targets.supabaseProjectRef}` +
      (args.dryRun ? "  (dry-run)" : ""),
  );
  if (linkedRef && linkedRef !== targets.supabaseProjectRef) {
    console.log(
      `secretsSync: aviso: el link local es ${linkedRef}, distinto del ` +
        `destino. Se usa ${targets.supabaseProjectRef}.`,
    );
  }

  requireGcloudAuth(targets.gcpProject);

  if (args.command === "list") {
    runList(targets.gcpProject, keys);
    return;
  }
  if (args.command === "push") {
    runPush(targets, args, keys);
    return;
  }
  runPull(targets, args, keys);
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    main();
  } catch (caught) {
    fail(caught instanceof Error ? caught.message : String(caught));
  }
}
