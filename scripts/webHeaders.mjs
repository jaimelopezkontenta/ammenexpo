import { readFileSync } from "node:fs";

/**
 * Las cabeceras de `firebase.json` leídas como las aplica Firebase Hosting,
 * para que el servidor estático del e2e (`scripts/e2eWebServer.mjs`) sirva el
 * export con LAS MISMAS — CSP incluida — y no con una copia a mano que se
 * desincronice el día que alguien toque una y no la otra.
 *
 * Lógica pura salvo `loadHostingHeaderRules`, que solo lee el fichero.
 */

/**
 * firebase-tools carga `firebase.json` con `cjson`, que admite comentarios `//`
 * y `/* *\/` fuera de las cadenas. Aquí igual, y con el mismo cuidado: el
 * `https://` de una CSP va dentro de una cadena y no es un comentario.
 */
export const stripJsonComments = (text) => {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      // Se conserva el salto de línea: los errores de JSON.parse siguen
      // señalando la línea buena.
      i = end === -1 ? text.length : end - 1;
    } else if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1)
        throw new Error("firebase.json: comentario /* sin cerrar");
      i = end + 1;
    } else {
      out += ch;
    }
  }

  return out;
};

export const parseFirebaseJson = (text) => JSON.parse(stripJsonComments(text));

/**
 * Solo `*`, `**` y `?`. Firebase acepta más (extglob `@(a|b)`, llaves…), pero
 * un glob que este módulo no entiende casaría con nada en silencio y el e2e
 * serviría sin cabeceras que producción sí pone: mejor romper aquí.
 */
const UNSUPPORTED_GLOB = /[{}()[\]!+@]/u;

export const assertSupportedGlob = (glob) => {
  if (UNSUPPORTED_GLOB.test(glob)) {
    throw new Error(
      `firebase.json: glob «${glob}» no soportado por scripts/webHeaders.mjs (solo *, ** y ?). Amplía el módulo antes de usarlo.`,
    );
  }
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const segmentMatches = (pattern, segment) => {
  // Como minimatch por defecto (`dot: false`), que es lo que usa el Hosting
  // local de firebase-tools (superstatic): un comodín no casa con un segmento
  // que empieza por punto.
  if (segment.startsWith(".") && !pattern.startsWith(".")) return false;
  const source = [...pattern]
    .map((ch) =>
      ch === "*" ? "[^/]*" : ch === "?" ? "[^/]" : escapeRegExp(ch),
    )
    .join("");
  return new RegExp(`^${source}$`, "u").test(segment);
};

const segmentsMatch = (pattern, path) => {
  if (pattern.length === 0) return path.length === 0;
  const [head, ...rest] = pattern;

  if (head === "**") {
    if (segmentsMatch(rest, path)) return true;
    return (
      path.length > 0 &&
      !path[0].startsWith(".") &&
      segmentsMatch(pattern, path.slice(1))
    );
  }

  return (
    path.length > 0 &&
    segmentMatches(head, path[0]) &&
    segmentsMatch(rest, path.slice(1))
  );
};

// superstatic pone la barra inicial a los dos lados antes de comparar.
const withLeadingSlash = (value) =>
  value.startsWith("/") ? value : `/${value}`;

export const matchesSource = (source, pathname) => {
  assertSupportedGlob(source);
  return segmentsMatch(
    withLeadingSlash(source).split("/"),
    withLeadingSlash(pathname).split("/"),
  );
};

export const hostingHeaderRules = (config) => {
  const hosting = config?.hosting;
  if (!hosting || Array.isArray(hosting)) {
    throw new Error("firebase.json: se esperaba un único bloque `hosting`");
  }

  return (hosting.headers ?? []).map((rule, index) => {
    if (typeof rule.source !== "string") {
      throw new Error(
        `firebase.json: la regla de cabeceras ${index} no tiene \`source\` (glob); \`regex\` no está soportado aquí`,
      );
    }
    assertSupportedGlob(rule.source);

    const headers = (rule.headers ?? []).map((header) => {
      if (
        typeof header?.key !== "string" ||
        typeof header?.value !== "string"
      ) {
        throw new Error(
          `firebase.json: cabecera sin \`key\`/\`value\` de texto en «${rule.source}»`,
        );
      }
      return { key: header.key, value: header.value };
    });

    return { source: rule.source, headers };
  });
};

/**
 * Todas las reglas que casan, en orden, y la última gana para cada cabecera:
 * es lo que hace superstatic (`res.setHeader` regla a regla). Por eso el
 * `Cache-Control: immutable` de `/_expo/static/**` pisa el `no-store` de `**`
 * sin que la CSP ni el resto de `**` se pierdan.
 */
export const headersForPath = (rules, pathname) => {
  const merged = new Map();
  for (const rule of rules) {
    if (!matchesSource(rule.source, pathname)) continue;
    for (const { key, value } of rule.headers) {
      merged.set(key.toLowerCase(), [key, value]);
    }
  }
  return Object.fromEntries(merged.values());
};

export const headerValue = (headers, name) => {
  const wanted = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === wanted);
  return key === undefined ? undefined : headers[key];
};

export const parseCsp = (policy) => {
  const directives = [];
  for (const part of policy.split(";")) {
    const tokens = part.trim().split(/\s+/u).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    if (directives.some((d) => d.name === name)) {
      // El navegador se queda con la primera y descarta la segunda sin avisar.
      throw new Error(`CSP: la directiva «${name}» está repetida`);
    }
    directives.push({ name, sources: tokens.slice(1) });
  }
  return directives;
};

export const serializeCsp = (directives) =>
  directives
    .map(({ name, sources }) => [name, ...sources].join(" "))
    .join("; ");

/**
 * Añade fuentes a unas directivas. Si una no existe, hoy manda `default-src`:
 * se crea copiándola para ampliar solo lo pedido. Sin `default-src` esa
 * directiva ya está abierta y no hay nada que ampliar.
 */
export const cspWithExtraSources = (policy, extra) => {
  const directives = parseCsp(policy);
  const fallback = directives.find((d) => d.name === "default-src");

  for (const [name, sources] of Object.entries(extra)) {
    let directive = directives.find((d) => d.name === name);
    if (!directive) {
      if (!fallback) continue;
      directive = { name, sources: [...fallback.sources] };
      directives.push(directive);
    }
    // `'none'` junto a otra fuente es inválido: se ignora con un aviso.
    if (directive.sources.includes("'none'")) directive.sources = [];
    for (const source of sources) {
      if (!directive.sources.includes(source)) directive.sources.push(source);
    }
  }

  return serializeCsp(directives);
};

export const cspWithReportUri = (policy, reportUri) =>
  serializeCsp([
    ...parseCsp(policy).filter((d) => d.name !== "report-uri"),
    { name: "report-uri", sources: [reportUri] },
  ]);

/**
 * El origen de Supabase que el build lleva dentro (`EXPO_PUBLIC_SUPABASE_URL`),
 * en http(s) para REST/Auth/Storage/Functions y en ws(s) para Realtime.
 */
export const supabaseCspSources = (supabaseUrl) => {
  const url = new URL(supabaseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `EXPO_PUBLIC_SUPABASE_URL tiene que ser http(s): «${supabaseUrl}»`,
    );
  }
  const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
  return {
    "connect-src": [url.origin, ws],
    // Los avatares públicos de Storage salen de ese mismo origen.
    "img-src": [url.origin],
  };
};

/**
 * Cabeceras para una ruta pedida, con la CSP de producción ampliada solo con
 * el Supabase local del e2e (y, si se pide, un `report-uri` para ver las
 * violaciones). Se casa contra la ruta PEDIDA, antes del fallback SPA, igual
 * que Firebase.
 */
export const createHeaderResolver = (
  rules,
  { supabaseUrl, reportUri } = {},
) => {
  const extra = supabaseUrl ? supabaseCspSources(supabaseUrl) : {};

  return (pathname) => {
    const headers = headersForPath(rules, pathname);
    const cspKey = Object.keys(headers).find(
      (k) => k.toLowerCase() === "content-security-policy",
    );
    if (cspKey) {
      let policy = cspWithExtraSources(headers[cspKey], extra);
      if (reportUri) policy = cspWithReportUri(policy, reportUri);
      headers[cspKey] = policy;
    }
    return headers;
  };
};

export const loadHostingHeaderRules = (firebaseJsonPath) =>
  hostingHeaderRules(parseFirebaseJson(readFileSync(firebaseJsonPath, "utf8")));
