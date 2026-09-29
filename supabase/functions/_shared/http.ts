/**
 * Lo que las seis funciones repetían: las cabeceras CORS y `json()`.
 *
 * Cada función conserva EXACTAMENTE sus cabeceras de antes (los tests de esta
 * carpeta fijan los tres perfiles): lo que se unifica es el código, no el
 * contrato. Ojo con la asimetría a propósito — `resend-webhook` no lleva CORS
 * (lo llama Svix, no un navegador) y las de correo/push admiten además el
 * header `x-ammen-invoker`.
 */

export type Cors = Readonly<Record<string, string>>;

const BASE_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
];

/** Perfil CORS: qué métodos y si el invocador interno puede mandar su header. */
export const buildCors = (input: {
  methods: string;
  invoker?: boolean;
}): Cors => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    ...BASE_HEADERS,
    ...(input.invoker ? ["x-ammen-invoker"] : []),
  ].join(", "),
  "Access-Control-Allow-Methods": input.methods,
});

/** Drenajes y colas (`send-email`, `enqueue-emails`, `send-intercession-push`). */
export const CORS_INVOKER: Cors = buildCors({
  methods: "POST, OPTIONS",
  invoker: true,
});

/** Funciones que llama la app con el JWT del usuario (`generate-prayer-plan`). */
export const CORS_USER: Cors = buildCors({ methods: "POST, OPTIONS" });

/** Baja one-click: GET redirige a la app, POST da de baja. */
export const CORS_UNSUBSCRIBE: Cors = buildCors({
  methods: "GET, POST, OPTIONS",
});

/** Sin CORS: el webhook de Resend lo llama un servidor, no un navegador. */
export const NO_CORS: Cors = {};

export const json = (
  body: unknown,
  status = 200,
  cors: Cors = NO_CORS,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** `json()` con el perfil CORS de la función ya fijado. */
export const jsonWith =
  (cors: Cors) =>
  (body: unknown, status = 200): Response =>
    json(body, status, cors);

/** Respuesta al preflight `OPTIONS`. */
export const preflight = (cors: Cors = NO_CORS): Response =>
  new Response("ok", { headers: cors });
