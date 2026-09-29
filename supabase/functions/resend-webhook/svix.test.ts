import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyResendSignature } from "./svix.ts";

/**
 * La firma se contrasta con un cálculo INDEPENDIENTE (`node:crypto`, no la
 * WebCrypto que usa `svix.ts`) y con el vector que publica la documentación de
 * Svix, que no depende de nada de este repositorio.
 */

// El vector de la documentación de Svix.
const DOC = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: "1614265330",
  body: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};

// Uno propio, con un evento de Resend, calculado con node:crypto.
const KEY = Buffer.from("0123456789abcdef0123456789abcdef");
const OWN = {
  secret: `whsec_${KEY.toString("base64")}`,
  id: "msg_2Lo8b3kR9PqXyZ",
  timestamp: "1790000000",
  body: JSON.stringify({
    type: "email.bounced",
    data: { email_id: "re_abc123", to: ["persona@example.com"] },
  }),
  signature: "v1,MoLvPKq046YkNcdTB5SnimcyvSl6xRGrG+qRPm97AF0=",
};

const sign = (
  key: Buffer,
  id: string,
  timestamp: string,
  body: string,
): string =>
  `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;

const verify = (
  overrides: Partial<Parameters<typeof verifyResendSignature>[0]> = {},
) =>
  verifyResendSignature({
    secret: OWN.secret,
    svixId: OWN.id,
    svixTimestamp: OWN.timestamp,
    svixSignature: OWN.signature,
    body: OWN.body,
    ...overrides,
  });

/** «Ahora» es `seconds` después (o antes, si es negativo) del timestamp de OWN. */
const nowIs = (offsetSeconds: number) => {
  vi.setSystemTime(new Date((Number(OWN.timestamp) + offsetSeconds) * 1000));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  nowIs(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("los vectores", () => {
  it("el de la documentación de Svix", async () => {
    vi.setSystemTime(new Date(Number(DOC.timestamp) * 1000));

    expect(
      await verifyResendSignature({
        secret: DOC.secret,
        svixId: DOC.id,
        svixTimestamp: DOC.timestamp,
        svixSignature: DOC.signature,
        body: DOC.body,
      }),
    ).toBe(true);
  });

  it("el propio se corresponde con un cálculo independiente", () => {
    expect(sign(KEY, OWN.id, OWN.timestamp, OWN.body)).toBe(OWN.signature);
  });

  it("el propio, con un evento de Resend, verifica", async () => {
    expect(await verify()).toBe(true);
  });

  it("acepta un secreto sin el prefijo whsec_", async () => {
    expect(await verify({ secret: KEY.toString("base64") })).toBe(true);
  });
});

describe("lo que rompe la firma", () => {
  it("un cuerpo distinto, aunque sea en un carácter", async () => {
    expect(await verify({ body: `${OWN.body} ` })).toBe(false);
    expect(await verify({ body: OWN.body.replace("bounced", "bouncee") })).toBe(
      false,
    );
  });

  it("otro svix-id", async () => {
    expect(await verify({ svixId: "msg_otro" })).toBe(false);
  });

  it("un timestamp distinto del firmado", async () => {
    expect(await verify({ svixTimestamp: "1790000001" })).toBe(false);
  });

  it("otro secreto", async () => {
    const other = Buffer.from("fedcba9876543210fedcba9876543210");

    expect(await verify({ secret: `whsec_${other.toString("base64")}` })).toBe(
      false,
    );
  });

  it("una firma sin el prefijo v1, o con otra versión", async () => {
    const bare = OWN.signature.slice(3);

    expect(await verify({ svixSignature: bare })).toBe(false);
    expect(await verify({ svixSignature: `v2,${bare}` })).toBe(false);
    expect(await verify({ svixSignature: `V1,${bare}` })).toBe(false);
  });

  it("una firma truncada o con relleno extra", async () => {
    expect(await verify({ svixSignature: OWN.signature.slice(0, -2) })).toBe(
      false,
    );
    expect(await verify({ svixSignature: `${OWN.signature}AA` })).toBe(false);
  });

  it("una firma vacía", async () => {
    expect(await verify({ svixSignature: "" })).toBe(false);
    expect(await verify({ svixSignature: "   " })).toBe(false);
  });
});

describe("varias firmas en el header (rotación de claves)", () => {
  const bad = sign(
    Buffer.from("otra clave otra clave otra clave"),
    OWN.id,
    OWN.timestamp,
    OWN.body,
  );

  it("basta con que UNA coincida, esté donde esté", async () => {
    expect(await verify({ svixSignature: `${bad} ${OWN.signature}` })).toBe(
      true,
    );
    expect(await verify({ svixSignature: `${OWN.signature} ${bad}` })).toBe(
      true,
    );
    expect(
      await verify({ svixSignature: `${bad} ${OWN.signature} ${bad}` }),
    ).toBe(true);
  });

  it("si ninguna coincide, no vale", async () => {
    expect(await verify({ svixSignature: `${bad} ${bad}` })).toBe(false);
  });

  it("tolera espacios de más entre firmas", async () => {
    expect(await verify({ svixSignature: `${bad}   ${OWN.signature}` })).toBe(
      true,
    );
    expect(await verify({ svixSignature: ` ${OWN.signature} ` })).toBe(true);
  });

  it("una versión distinta al lado de la buena no la estropea, ni la sustituye", async () => {
    const good = OWN.signature.slice(3);

    expect(await verify({ svixSignature: `v2,${good} ${OWN.signature}` })).toBe(
      true,
    );
    expect(await verify({ svixSignature: `v2,${good}` })).toBe(false);
  });
});

describe("la ventana de cinco minutos contra el replay", () => {
  it("dentro de la ventana, en los dos sentidos", async () => {
    for (const offset of [-300, -60, 0, 60, 300]) {
      nowIs(offset);
      expect(await verify(), `offset ${offset}`).toBe(true);
    }
  });

  it("un segundo pasada la ventana, no", async () => {
    nowIs(301);
    expect(await verify()).toBe(false);

    nowIs(-301);
    expect(await verify()).toBe(false);
  });

  it("un mensaje de hace una hora, aunque esté bien firmado", async () => {
    nowIs(3600);
    expect(await verify()).toBe(false);
  });

  it("una firma válida no se puede reutilizar mucho después", async () => {
    expect(await verify()).toBe(true);
    nowIs(24 * 3600);
    expect(await verify()).toBe(false);
  });
});

describe("timestamp inválido", () => {
  it.each([
    ["vacío", ""],
    ["no numérico", "abc"],
    ["NaN", "NaN"],
    ["infinito", "Infinity"],
    ["menos infinito", "-Infinity"],
    ["texto con número", "1790000000abc"],
  ])("%s", async (_name, timestamp) => {
    // Firmado a conciencia con ese mismo timestamp: solo la validación puede
    // rechazarlo, no un desajuste de la firma.
    const signature = sign(KEY, OWN.id, timestamp, OWN.body);

    expect(
      await verify({ svixTimestamp: timestamp, svixSignature: signature }),
    ).toBe(false);
  });

  it("un timestamp en milisegundos (el error clásico) queda fuera de la ventana", async () => {
    const ms = `${OWN.timestamp}000`;
    const signature = sign(KEY, OWN.id, ms, OWN.body);

    expect(await verify({ svixTimestamp: ms, svixSignature: signature })).toBe(
      false,
    );
  });

  it("negativo o cero, fuera de la ventana", async () => {
    for (const timestamp of ["0", "-1790000000"]) {
      const signature = sign(KEY, OWN.id, timestamp, OWN.body);

      expect(
        await verify({ svixTimestamp: timestamp, svixSignature: signature }),
        timestamp,
      ).toBe(false);
    }
  });
});

describe("un secreto mal puesto no lanza: rechaza", () => {
  it.each([
    ["no es base64", "whsec_!!!no-es-base64!!!"],
    ["solo el prefijo", "whsec_"],
    ["vacío", ""],
  ])("%s", async (_name, secret) => {
    await expect(verify({ secret })).resolves.toBe(false);
  });
});

describe("cuerpos raros", () => {
  it("un cuerpo vacío o con Unicode se firma y verifica igual que cualquiera", async () => {
    for (const body of ["", "{}", '{"nota":"Señor, sostén a mi madre 🙏"}']) {
      const signature = sign(KEY, OWN.id, OWN.timestamp, body);

      expect(await verify({ body, svixSignature: signature }), body).toBe(true);
    }
  });
});

describe("la comparación es en tiempo constante", () => {
  /**
   * No se mide el tiempo (sería inestable): se comprueba que la comparación
   * lee TODOS los bytes de las dos cadenas aunque el primero ya difiera, que es
   * lo que distingue un `===` de una comparación en tiempo constante.
   */
  it("recorre la misma cantidad de bytes falle donde falle", async () => {
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
      const bytes = real.call(this, input);

      // Solo las cadenas de la comparación (firmas de ~47 caracteres): el
      // mensaje firmado, mucho más largo, va a WebCrypto, que no admite un
      // Proxy como BufferSource.
      return (
        (input ?? "").length < 60 ? counting(bytes) : bytes
      ) as ReturnType<TextEncoder["encode"]>;
    });

    const readsFor = async (signature: string) => {
      reads = 0;
      await verify({ svixSignature: signature });
      return reads;
    };

    const good = OWN.signature;
    const wrongFirst = `X${good.slice(1)}`;
    const wrongLast = `${good.slice(0, -1)}X`;

    // Se cuentan solo las lecturas de la comparación final: la del cuerpo
    // firmado es igual en los tres casos y se cancela al comparar.
    const [okReads, firstReads, lastReads] = [
      await readsFor(good),
      await readsFor(wrongFirst),
      await readsFor(wrongLast),
    ];

    expect(firstReads).toBe(okReads);
    expect(lastReads).toBe(okReads);
    expect(okReads).toBeGreaterThan(good.length);

    vi.restoreAllMocks();
  });
});
