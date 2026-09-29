import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authorizeInvoker,
  isLocalSupabaseUrl,
  timingSafeEqualString,
} from "./invoker.ts";

/**
 * `isLocalSupabaseUrl` es una HEURÍSTICA sobre el esquema de `SUPABASE_URL`, y
 * estos tests fijan lo que hace HOY con las URL raras — incluidos los casos en
 * que es discutible. Que un caso esté aquí con su resultado actual no significa
 * que ese resultado sea el deseable: los marcados «HOY» documentan un hueco.
 * Hay una revisión aparte de la heurística; cuando cambie, estos son los tests
 * que deben cambiar con ella.
 */
describe("isLocalSupabaseUrl", () => {
  it.each([
    "http://kong:8000",
    "http://127.0.0.1:54421",
    "http://localhost:54321",
    "http://host.docker.internal:54321",
    "http://[::1]:54321",
  ])("%s es local", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(true);
  });

  it.each([
    "https://syprzdjznuppckenuaua.supabase.co",
    "https://syprzdjznuppckenuaua.supabase.co/",
    "https://kong:8000",
    "https://localhost:54321",
  ])("%s es remoto", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });

  it("los espacios de los bordes no cambian el veredicto", () => {
    expect(isLocalSupabaseUrl("  http://kong:8000\n")).toBe(true);
    expect(isLocalSupabaseUrl("\t https://x.supabase.co ")).toBe(false);
  });

  it.each([undefined, "", "   ", "\n"])(
    "sin URL (%j) cuenta como remoto, el lado seguro",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(false);
    },
  );

  it.each([
    ["sin esquema", "kong:8000"],
    ["solo host", "localhost"],
    ["esquema relativo", "//kong:8000"],
    ["un solo slash", "http:/kong:8000"],
    ["otro esquema", "ws://kong:8000"],
    ["ftp", "ftp://kong"],
    ["esquema pegado", "httpx://kong"],
    ["prefijo antes del esquema", "xhttp://kong"],
    ["esquema con https dentro de la ruta", "ftp://x/http://kong"],
  ])("%s → remoto", (_name, url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });

  it("con un puerto, o con ruta, o con credenciales, sigue mirando solo el esquema", () => {
    expect(isLocalSupabaseUrl("http://kong:8000/functions/v1")).toBe(true);
    expect(isLocalSupabaseUrl("https://kong:8000/http://x")).toBe(false);
  });

  // ------------------------------------------------------------------------
  // HOY: los huecos de la heurística. Se documentan, no se defienden.
  // ------------------------------------------------------------------------

  it("HOY: el esquema en MAYÚSCULAS no se reconoce como http (y cae en el lado seguro)", () => {
    // Los esquemas de URL no distinguen mayúsculas; `startsWith` sí. Aquí es
    // inocuo (un local con «HTTP://» pediría secreto), pero delata que no se
    // está parseando la URL.
    expect(isLocalSupabaseUrl("HTTP://kong:8000")).toBe(false);
    expect(isLocalSupabaseUrl("Http://localhost:54321")).toBe(false);
  });

  it("HOY: CUALQUIER host por http se toma por local, también uno público", () => {
    // Es el hueco: una `SUPABASE_URL` http:// en un despliegue real (un
    // Supabase autoalojado detrás de un proxy TLS suele dársela así a las edge
    // functions: `http://kong:8000`) dejaría el invocador abierto sin secreto.
    expect(isLocalSupabaseUrl("http://example.com")).toBe(true);
    expect(isLocalSupabaseUrl("http://203.0.113.9:8000")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost.evil.example")).toBe(true);
    expect(isLocalSupabaseUrl("http://user:pass@evil.example")).toBe(true);
    expect(isLocalSupabaseUrl("http://")).toBe(true);
  });
});

describe("authorizeInvoker", () => {
  const LOCAL = "http://kong:8000";
  const REMOTE = "https://syprzdjznuppckenuaua.supabase.co";

  describe("con secreto configurado, la URL no importa", () => {
    it.each([LOCAL, REMOTE, undefined, "", "HTTP://kong"])(
      "el header correcto pasa con la URL %j",
      (url) => {
        expect(authorizeInvoker("s3cret", "s3cret", url)).toBe("ok");
      },
    );

    it.each([LOCAL, REMOTE, undefined])(
      "un header ausente o distinto no pasa con la URL %j",
      (url) => {
        expect(authorizeInvoker(null, "s3cret", url)).toBe("unauthorized");
        expect(authorizeInvoker(undefined, "s3cret", url)).toBe("unauthorized");
        expect(authorizeInvoker("", "s3cret", url)).toBe("unauthorized");
        expect(authorizeInvoker("s3cre", "s3cret", url)).toBe("unauthorized");
        expect(authorizeInvoker("s3crett", "s3cret", url)).toBe("unauthorized");
        expect(authorizeInvoker("S3CRET", "s3cret", url)).toBe("unauthorized");
      },
    );
  });

  it("el secreto se recorta pero el header no: un salto de línea de más lo rechaza", () => {
    expect(authorizeInvoker("abc", "  abc\n", REMOTE)).toBe("ok");
    expect(authorizeInvoker("abc\n", "abc", REMOTE)).toBe("unauthorized");
    expect(authorizeInvoker(" abc", "abc", REMOTE)).toBe("unauthorized");
  });

  it("compara bytes UTF-8: un secreto con acentos o emojis", () => {
    expect(authorizeInvoker("contraseña🔑", "contraseña🔑", REMOTE)).toBe("ok");
    expect(authorizeInvoker("contrasena🔑", "contraseña🔑", REMOTE)).toBe(
      "unauthorized",
    );
  });

  describe("sin secreto (o en blanco)", () => {
    it.each([undefined, "", "   ", "\n\t"])(
      "en local se deja pasar sin header (secreto %j)",
      (secret) => {
        expect(authorizeInvoker(null, secret, LOCAL)).toBe("not_required");
        expect(authorizeInvoker("lo-que-sea", secret, LOCAL)).toBe(
          "not_required",
        );
      },
    );

    it.each([undefined, "", "   "])(
      "fuera de local es fail-closed aunque llegue un header (secreto %j)",
      (secret) => {
        expect(authorizeInvoker(null, secret, REMOTE)).toBe("unauthorized");
        expect(authorizeInvoker("lo-que-sea", secret, REMOTE)).toBe(
          "unauthorized",
        );
      },
    );

    it("un header vacío nunca coincide con un secreto vacío", () => {
      expect(authorizeInvoker("", "", REMOTE)).toBe("unauthorized");
      expect(authorizeInvoker("", "   ", REMOTE)).toBe("unauthorized");
    });
  });

  describe("con URLs raras y sin secreto", () => {
    it.each([
      ["sin esquema", "kong:8000"],
      ["https con puerto", "https://kong:8000"],
      ["esquema en mayúsculas", "HTTP://kong:8000"],
      ["vacía", ""],
      ["solo espacios", "   "],
      ["ws", "ws://kong:8000"],
    ])("%s → unauthorized (fail-closed)", (_name, url) => {
      expect(authorizeInvoker(null, undefined, url)).toBe("unauthorized");
    });

    it("con espacios alrededor de un http:// sigue siendo local", () => {
      expect(authorizeInvoker(null, undefined, "  http://kong:8000 ")).toBe(
        "not_required",
      );
    });

    it("HOY: un http:// de un host PÚBLICO se abre sin secreto", () => {
      // Consecuencia directa del hueco de `isLocalSupabaseUrl`: no es un
      // comportamiento a preservar, es lo que la heurística da hoy.
      expect(authorizeInvoker(null, undefined, "http://example.com")).toBe(
        "not_required",
      );
      expect(authorizeInvoker(null, undefined, "http://203.0.113.9:8000")).toBe(
        "not_required",
      );
    });
  });

  it("nunca devuelve ni registra el secreto", () => {
    const spies = (["log", "warn", "error", "info"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );

    const results = [
      authorizeInvoker("mal", "s3cret-muy-secreto", REMOTE),
      authorizeInvoker("s3cret-muy-secreto", "s3cret-muy-secreto", REMOTE),
    ];

    expect(JSON.stringify(results)).not.toContain("s3cret-muy-secreto");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe("timingSafeEqualString", () => {
  it("cadenas iguales, distintas, de distinta longitud y vacías", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
    expect(timingSafeEqualString("abcd", "abc")).toBe(false);
    expect(timingSafeEqualString("", "")).toBe(true);
    expect(timingSafeEqualString("", "a")).toBe(false);
  });

  it("un prefijo NUL no la engaña: la diferencia de longitud cuenta", () => {
    expect(timingSafeEqualString("abc", "abc\u0000")).toBe(false);
    expect(timingSafeEqualString("abc\u0000", "abc")).toBe(false);
  });

  it("compara por bytes UTF-8", () => {
    expect(timingSafeEqualString("ñ", "ñ")).toBe(true);
    expect(timingSafeEqualString("ñ", "n")).toBe(false);
    expect(timingSafeEqualString("é", "é")).toBe(false);
  });

  it("recorre todos los bytes falle donde falle", () => {
    const real = TextEncoder.prototype.encode;
    let reads = 0;

    const counting = (bytes: Uint8Array) =>
      new Proxy(bytes, {
        get(target, prop) {
          if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
          return Reflect.get(target, prop, target);
        },
      });

    vi.spyOn(TextEncoder.prototype, "encode").mockImplementation(function (
      this: TextEncoder,
      input?: string,
    ) {
      return counting(real.call(this, input)) as ReturnType<
        TextEncoder["encode"]
      >;
    });

    const readsFor = (left: string, right: string) => {
      reads = 0;
      timingSafeEqualString(left, right);
      return reads;
    };

    const secret = "a".repeat(64);

    const equal = readsFor(secret, secret);
    expect(readsFor(`X${secret.slice(1)}`, secret)).toBe(equal);
    expect(readsFor(`${secret.slice(0, -1)}X`, secret)).toBe(equal);
    // Y una diferencia de longitud tampoco acorta el recorrido.
    expect(readsFor("X", secret)).toBe(equal);
  });
});
