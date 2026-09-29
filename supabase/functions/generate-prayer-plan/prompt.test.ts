import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { SEASON_KEYS, TOPIC_KEYS } from "./input.ts";
import { buildRepairPrompt, buildUserPrompt, SYSTEM_PROMPT } from "./prompt.ts";
import { PLAN_JSON_SCHEMA } from "./schema.ts";

/**
 * El prompt español, fijado byte a byte.
 *
 * Es lo que lee el modelo en cada plan que ya existe, y el prefijo cacheado de
 * todas las peticiones: un cambio accidental (un espacio, una comilla tipográfica
 * por una recta al tocar el inglés) cambia la voz de la app y tira la caché. Se
 * fija por su huella: si este test falla y el cambio ES a propósito, se
 * actualiza la huella en el mismo commit que el prompt, diciendo por qué.
 */
const sha256 = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");

/** Un primer tramo con todas las etiquetas: ninguna puede cambiar sin avisar. */
const firstStretch = () =>
  buildUserPrompt({
    displayName: "Marta",
    durationDays: 14,
    seasons: [...SEASON_KEYS],
    topics: [...TOPIC_KEYS],
    gender: "feminine",
    customTopic: "mi madre está enferma",
    minutes: 15,
    fromDay: 1,
    toDay: 7,
    previousDays: [],
  });

/** Un tramo posterior, con los respaldos (sin trato, temas ni minutos). */
const laterStretch = () =>
  buildUserPrompt({
    displayName: "Luis",
    durationDays: 14,
    seasons: [],
    topics: [],
    gender: null,
    customTopic: null,
    minutes: null,
    fromDay: 8,
    toDay: 14,
    previousDays: [
      { day_number: 1, title: "La paz", scripture_ref: "Juan 14:27" },
      { day_number: 2, title: "Confiar", scripture_ref: null },
    ],
  });

const masculine = () =>
  buildUserPrompt({
    displayName: "Luis",
    durationDays: 7,
    seasons: ["work"],
    topics: ["wisdom"],
    gender: "masculine",
    fromDay: 1,
    toDay: 7,
    previousDays: [],
  });

const repair = () =>
  buildRepairPrompt([
    { day_number: 3, scripture_ref: "Inventado 1:1", title: "Tercer día" },
  ]);

describe("el prompt español no cambia", () => {
  it("el prompt del sistema", () => {
    expect(SYSTEM_PROMPT.length).toBe(6203);
    expect(sha256(SYSTEM_PROMPT)).toBe(
      "a8ad832d8f9ff5a11107f26851dbc1b734a31f57932b6ccc3872086a43e46741",
    );
  });

  it("el prompt del usuario: primer tramo, tramo posterior y trato masculino", () => {
    expect(sha256(firstStretch())).toBe(
      "77c4a4364ef7a52c8a215d88899752dab29680502dc4ab1b0657c02df63991a2",
    );
    expect(sha256(laterStretch())).toBe(
      "58b526a7a948b4d212337c29d79283df1c32bf6faf686e332799f655ed95ed20",
    );
    expect(sha256(masculine())).toBe(
      "dfb0b13a23f800b52b712a604d29aaa95e0ae74c0d05deb63d283a9531424b46",
    );
  });

  it("la pasada de reparación", () => {
    expect(sha256(repair())).toBe(
      "ecddc11d35a0804ab83b4c8e4e4521dd53d4c48f64c6f573adb7ca0abeb55d75",
    );
  });

  it("el esquema de salida (sus descripciones también las lee el modelo)", () => {
    expect(sha256(JSON.stringify(PLAN_JSON_SCHEMA))).toBe(
      "0740f8e456c8ebfbb7f6c413644bc096deef1a909d599fbcdb9f19f47e544af8",
    );
  });
});
