import { describe, expect, it } from "vitest";

import {
  buildCors,
  CORS_INVOKER,
  CORS_UNSUBSCRIBE,
  CORS_USER,
  json,
  jsonWith,
  NO_CORS,
  preflight,
} from "./http.ts";

/**
 * Estas cadenas son las que cada función tenía copiadas a mano. Se fijan tal
 * cual: si una cambia, cambia lo que ve el navegador y el preflight de la app.
 */
describe("perfiles CORS", () => {
  it("drenajes y colas: aceptan el header del invocador interno", () => {
    expect(CORS_INVOKER).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-ammen-invoker",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
  });

  it("funciones del usuario: sin el header del invocador", () => {
    expect(CORS_USER).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
  });

  it("baja de correo: admite GET además de POST", () => {
    expect(CORS_UNSUBSCRIBE).toEqual({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
  });

  it("el webhook no lleva CORS", () => {
    expect(NO_CORS).toEqual({});
  });

  it("buildCors compone los mismos perfiles", () => {
    expect(buildCors({ methods: "POST, OPTIONS", invoker: true })).toEqual(
      CORS_INVOKER,
    );
    expect(buildCors({ methods: "POST, OPTIONS" })).toEqual(CORS_USER);
  });
});

describe("json", () => {
  it("responde 200 con JSON y sin CORS por defecto", async () => {
    const response = json({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("respeta el status y añade el CORS que se le da", async () => {
    const response = json({ error: "unauthorized" }, 401, CORS_INVOKER);

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "x-ammen-invoker",
    );
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("el Content-Type nunca lo pisa el CORS", () => {
    const response = json({}, 200, { "Content-Type": "text/plain" });

    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("serializa null y arrays tal cual", async () => {
    expect(await json(null).json()).toBeNull();
    expect(await json([1, 2]).json()).toEqual([1, 2]);
  });
});

describe("jsonWith", () => {
  it("fija el perfil CORS y deja el status como opcional", async () => {
    const reply = jsonWith(CORS_USER);

    const ok = reply({ status: "complete" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );

    const bad = reply({ error: "not_found" }, 404);
    expect(bad.status).toBe(404);
    expect(await bad.json()).toEqual({ error: "not_found" });
  });
});

describe("preflight", () => {
  it("contesta ok con el CORS de la función", async () => {
    const response = preflight(CORS_INVOKER);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("sin perfil no añade cabeceras CORS (webhook)", async () => {
    const response = preflight();

    expect(await response.text()).toBe("ok");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
