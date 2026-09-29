/**
 * Verifica la firma Svix de un webhook de Resend.
 * El secreto llega como `whsec_` + base64 de la clave HMAC.
 */

// La comparación en tiempo constante es la de `_shared/invoker.ts`: había una
// segunda copia idéntica aquí.
import { timingSafeEqualString } from "../_shared/invoker.ts";

const encoder = new TextEncoder();

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const toBase64 = (bytes: ArrayBuffer): string => {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin);
};

export const verifyResendSignature = async (input: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  body: string;
}): Promise<boolean> => {
  const raw = input.secret.startsWith("whsec_")
    ? input.secret.slice("whsec_".length)
    : input.secret;

  // Un secreto que no es base64, o que queda vacío (`whsec_` a secas), no
  // firma nada: se rechaza en vez de dejar que `importKey` lance.
  const keyBytes = (() => {
    try {
      return fromBase64(raw);
    } catch {
      return null;
    }
  })();

  if (!keyBytes || keyBytes.length === 0) return false;

  const timestamp = Number(input.svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  // 5 minutos de holgura contra replay.
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const signed = `${input.svixId}.${input.svixTimestamp}.${input.body}`;
  let expected: string;

  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(signed),
    );
    expected = `v1,${toBase64(mac)}`;
  } catch {
    return false;
  }

  // El header lleva una o varias firmas separadas por espacio (Svix rota la
  // clave firmando con las dos): basta con que una coincida.
  const candidates = input.svixSignature.split(" ").map((part) => part.trim());
  return candidates.some((candidate) =>
    timingSafeEqualString(candidate, expected),
  );
};
