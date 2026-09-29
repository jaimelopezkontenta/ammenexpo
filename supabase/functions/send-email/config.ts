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

export {
  authorizeInvoker,
  type InvokerAuth,
  isLocalSupabaseUrl,
  timingSafeEqualString,
} from "../_shared/invoker.ts";

export const isAllowlisted = (
  email: string,
  allowlist: string[] | null,
): boolean => {
  if (!allowlist || allowlist.length === 0) return true;
  return allowlist.includes(email.trim().toLowerCase());
};
