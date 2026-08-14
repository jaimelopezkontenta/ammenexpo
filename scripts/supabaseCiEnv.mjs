#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_LOCAL_VALUES = ["API_URL", "ANON_KEY"];

const decodeEnvValue = (rawValue) => {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith('"')) return JSON.parse(trimmed);
  return trimmed;
};

export const parseSupabaseStatusEnv = (output) => {
  const values = new Map();

  for (const line of output.split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line);
    if (!match) continue;
    values.set(match[1], decodeEnvValue(match[2]));
  }

  for (const name of REQUIRED_LOCAL_VALUES) {
    if (!values.get(name)) {
      throw new Error(`supabase status no devolvió ${name}`);
    }
  }

  return {
    EXPO_PUBLIC_SUPABASE_URL: values.get("API_URL"),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: values.get("ANON_KEY"),
  };
};

export const githubEnvironmentBlock = (environment) =>
  Object.entries(environment)
    .map(([name, value]) => {
      if (typeof value !== "string" || value.includes("\0")) {
        throw new Error(`valor local inválido para ${name}`);
      }
      const delimiter = `SUPABASE_LOCAL_${randomUUID()}`;
      return `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
    })
    .join("");

const readLocalSupabaseEnvironment = () => {
  const command =
    process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase status -o env"]
      : ["supabase", "status", "-o", "env"];
  const result = spawnSync(
    command,
    args,
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      `No se pudo leer el entorno de Supabase local: ${result.error?.message ?? result.stderr}`,
    );
  }

  return parseSupabaseStatusEnv(result.stdout);
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const environment = readLocalSupabaseEnvironment();
    if (process.argv.includes("--check")) {
      console.log(
        `Supabase local disponible; variables seleccionadas: ${Object.keys(environment).join(", ")}`,
      );
    } else {
      const githubEnvPath = process.env.GITHUB_ENV;
      if (!githubEnvPath) throw new Error("GITHUB_ENV no está definido");
      appendFileSync(
        githubEnvPath,
        githubEnvironmentBlock(environment),
        "utf8",
      );
      console.log(
        `Entorno local exportado: ${Object.keys(environment).join(", ")}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
