export const EMAIL_CADENCES = ["daily", "weekdays", "weekly", "off"] as const;

export type EmailCadence = (typeof EMAIL_CADENCES)[number];

export type EmailPreferences = {
  cadence: EmailCadence;
  social: boolean;
  nudge: boolean;
};

export const isEmailCadence = (value: unknown): value is EmailCadence =>
  typeof value === "string" &&
  (EMAIL_CADENCES as readonly string[]).includes(value);
