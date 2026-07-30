export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => EMAIL_RE.test(value.trim());

/**
 * Maps Supabase auth errors onto our own translation keys. Matching on the
 * message string is unavoidable — GoTrue does not give stable codes for these —
 * so anything unrecognised falls back to the generic error rather than
 * guessing.
 */
export const authErrorKey = (message: string) => {
  const normalised = message.toLowerCase();

  if (normalised.includes("invalid login credentials")) {
    return "auth.invalidCredentials";
  }

  if (
    normalised.includes("already registered") ||
    normalised.includes("already been registered") ||
    normalised.includes("user already exists")
  ) {
    return "auth.emailTaken";
  }

  return "common.errorGeneric";
};
