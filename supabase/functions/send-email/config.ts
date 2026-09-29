export type SenderConfig =
  | {
      enabled: true;
      supabaseUrl: string;
      serviceRoleKey: string;
      resendApiKey: string;
      appOrigin: string;
      allowlist: string[] | null;
    }
  | { enabled: false; reason: "kill_switch" | "not_configured" };

/**
 * Fail-closed: sin URL, sin service role o sin clave de Resend no se envía.
 * `EMAIL_SENDER_ENABLED=false` apaga en caliente. Allowlist no vacía = staging.
 */
export const resolveEmailSenderConfig = (
  env: Record<string, string | undefined>,
): SenderConfig => {
  if (env.EMAIL_SENDER_ENABLED === "false") {
    return { enabled: false, reason: "kill_switch" };
  }

  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const resendApiKey = env.RESEND_API_KEY?.trim();
  const appOrigin = (
    env.EMAIL_APP_ORIGIN ||
    env.SITE_URL ||
    "https://ammen.app"
  ).replace(/\/$/u, "");

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return { enabled: false, reason: "not_configured" };
  }

  const rawAllow = env.EMAIL_ALLOWLIST?.trim();
  const allowlist = rawAllow
    ? rawAllow
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    : null;

  return {
    enabled: true,
    supabaseUrl,
    serviceRoleKey,
    resendApiKey,
    appOrigin,
    allowlist,
  };
};

export type InvokerAuth = "ok" | "not_required" | "unauthorized";

export const timingSafeEqualString = (left: string, right: string): boolean => {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < len; i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return mismatch === 0;
};

export const authorizeInvoker = (
  header: string | null | undefined,
  secret: string | undefined,
): InvokerAuth => {
  const expected = secret?.trim() ?? "";

  if (!expected) {
    return "not_required";
  }

  if (!timingSafeEqualString(header ?? "", expected)) {
    return "unauthorized";
  }

  return "ok";
};

export const isAllowlisted = (
  email: string,
  allowlist: string[] | null,
): boolean => {
  if (!allowlist || allowlist.length === 0) return true;
  return allowlist.includes(email.trim().toLowerCase());
};
