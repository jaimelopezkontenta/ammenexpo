/**
 * Verifica la firma Svix de un webhook de Resend.
 * El secreto llega como `whsec_` + base64 de la clave HMAC.
 */

const encoder = new TextEncoder();

const timingSafeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  const len = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let i = 0; i < len; i += 1) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return mismatch === 0;
};

const fromBase64 = (value: string): Uint8Array => {
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

  let keyBytes: Uint8Array;
  try {
    keyBytes = fromBase64(raw);
  } catch {
    return false;
  }

  const timestamp = Number(input.svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  // 5 minutos de holgura contra replay.
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const signed = `${input.svixId}.${input.svixTimestamp}.${input.body}`;
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
  const expected = `v1,${toBase64(mac)}`;

  const candidates = input.svixSignature.split(" ").map((part) => part.trim());
  return candidates.some((candidate) =>
    timingSafeEqual(encoder.encode(candidate), encoder.encode(expected)),
  );
};
