import { execFileSync } from "node:child_process";

/**
 * RDY-08 — precondiciones por SQL controlado, nunca para reemplazar la
 * acción que el journey afirma probar (regla de RDY-07/RDY-08 del plan).
 *
 * Se usa `execFileSync` con `input`, no una tubería de shell: en este mismo
 * repositorio, pasar SQL con acentos a través de una tubería de PowerShell
 * mojibake el contenido (visto de primera mano al depurar
 * `supabase/tests/*.sql` en esta sesión) — `execFileSync` con `input` en un
 * Buffer utf8 evita ese problema por completo porque no hay shell de por
 * medio reinterpretando la codificación.
 */
export const runSql = (sql: string): string => {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_ammen",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    { input: Buffer.from(sql, "utf8"), encoding: "utf8" },
  );
};

/**
 * Igual que `runSql`, pero para leer un único valor escalar — un `count(*)`,
 * un booleano, un texto. Añade `-t -A` para que psql devuelva **solo** el
 * valor, sin la cabecera ni el marco de la tabla: el mismo par de flags que
 * `globalSetup.ts` usa para su healthcheck del seed. Sin ellos, `runSql`
 * devuelve una tabla formateada que habría que parsear, y parsear la salida
 * de psql es exactamente el tipo de fragilidad que no se le mete a un test
 * que verifica un contrato de datos.
 *
 * Devuelve el resultado recortado (sin el salto de línea final de psql); el
 * que llama lo convierte al tipo que espera, normalmente con `Number(...)`.
 */
export const runSqlScalar = (sql: string): string => {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_ammen",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    { input: Buffer.from(sql, "utf8"), encoding: "utf8" },
  ).trim();
};

export const SEED_A_ID = "5eed0000-0000-0000-0000-000000000001"; // prueba@ammen.local
export const SEED_B_ID = "5eed0000-0000-0000-0000-000000000002"; // zoe@ammen.local

export const SEED_A = { email: "prueba@ammen.local", password: "ammen1234" };
export const SEED_B = { email: "zoe@ammen.local", password: "ammen1234" };

/** Precondición de staff. El canal admin real no es lo que el E2E examina. */
export const setStaff = (userId: string, isStaff: boolean) => {
  runSql(`
    update public.profiles
       set is_staff = ${isStaff ? "true" : "false"}
     where id = '${userId}';
  `);
};

/** Estado de un hold por el target, no por el texto. */
export const holdStatusForTarget = (targetId: string): string =>
  runSqlScalar(`
    select status
    from public.content_holds
    where target_id = '${targetId}'
    order by created_at desc
    limit 1
  `);
