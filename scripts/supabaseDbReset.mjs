#!/usr/bin/env node
import { spawnSync } from "node:child_process";

/**
 * `supabase db reset` aplica esquema y seed y luego reinicia contenedores.
 * Ese último paso a veces 502s en Storage/imgproxy (DEF-04) aunque la base
 * ya quedó sembrada. `db:test` trata el código de salida del CLI como fatal;
 * este wrapper sigue si el seed de esta corrida terminó y el fallo es ese
 * chequeo de gateway — no si el reset ni siquiera llegó a sembrar.
 */

const SEED_EMAIL = "prueba@ammen.local";
const DB_CONTAINER = "supabase_db_ammen";
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

const isCosmeticGatewayFailure = (text) =>
  /Error status 502|LegacyStorageGatewayStatusError|invalid response was received from the upstream server/i.test(
    text,
  );

const seededThenRestarted = (text) =>
  /Seeding data from supabase[/\\]seed\.sql/i.test(text) &&
  /Restarting containers/i.test(text);

const seedUserCount = () => {
  const probe = spawnSync(
    "docker",
    [
      "exec",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-t",
      "-A",
      "-c",
      `select count(*) from auth.users where email = '${SEED_EMAIL}'`,
    ],
    { encoding: "utf8" },
  );
  if (probe.status !== 0) return -1;
  return Number.parseInt((probe.stdout ?? "").trim(), 10);
};

const result = spawnSync(NPX, ["supabase", "db", "reset"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  // Windows: npx.cmd es un batch; Node moderno exige shell (EINVAL si no).
  shell: process.platform === "win32",
});

process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.status === 0) {
  process.exit(0);
}

const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const seedCount = seedUserCount();

if (
  seededThenRestarted(combined) &&
  isCosmeticGatewayFailure(combined) &&
  seedCount === 1
) {
  console.warn(
    "[db-reset] 502 al reiniciar contenedores después del seed; el esquema está.",
  );
  process.exit(0);
}

process.exit(result.status === null ? 1 : result.status);
