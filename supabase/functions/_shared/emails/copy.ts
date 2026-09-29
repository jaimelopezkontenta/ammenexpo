/**
 * Voz de Ammen en el correo: tú, concreto, sin culpa, sin emoji, sin jerga.
 * El género sale de onboarding_answers.gender (sola / solo / a solas).
 */

export type EmailLocale = "es" | "en";
export type EmailGender = "feminine" | "masculine" | "neutral" | string | null;

export type EmailTemplateId =
  | "welcome"
  | "waitlist"
  | "habit"
  | "recovery"
  | "invite_app"
  | "invite_circle"
  | "invite_plan"
  | "invite_used"
  | "digest_social"
  | "drip_d1"
  | "drip_d2"
  | "drip_d3"
  | "drip_d7"
  | "winback_d3"
  | "winback_d7"
  | "winback_d14"
  | "winback_d30";

export type EmailPayload = {
  first_name?: string | null;
  gender?: EmailGender;
  inviter_name?: string | null;
  circle_name?: string | null;
  plan_title?: string | null;
  plan_day?: number | null;
  verse_ref?: string | null;
  verse_text?: string | null;
  streak_at_risk?: boolean | null;
  names?: string[] | null;
  count?: number | null;
  joins?: number | null;
  redeemer_name?: string | null;
  context?: string | null;
  token?: string | null;
  recovery_url?: string | null;
};

const vocative = (name?: string | null): string => {
  const trimmed = name?.trim();
  return trimmed ? `${trimmed}, ` : "";
};

const alone = (locale: EmailLocale, gender: EmailGender): string => {
  if (locale === "en") return "alone";
  if (gender === "feminine") return "sola";
  if (gender === "masculine") return "solo";
  return "a solas";
};

export type RenderedCopy = {
  subject: string;
  preheader: string;
  overline?: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  verseRef?: string;
  verseText?: string;
  transactional: boolean;
  layout: "habit" | "person" | "account";
};

export const renderCopy = (
  template: EmailTemplateId,
  locale: EmailLocale,
  payload: EmailPayload,
): RenderedCopy => {
  const es = locale !== "en";
  const name = vocative(payload.first_name);
  const who = payload.inviter_name?.trim() || (es ? "Alguien" : "Someone");
  const circle = payload.circle_name?.trim();
  const plan = payload.plan_title?.trim();

  switch (template) {
    case "welcome": {
      const extra = circle
        ? es
          ? ` ${who} te espera en ${circle}.`
          : ` ${who} is waiting in ${circle}.`
        : payload.inviter_name
          ? es
            ? ` ${who} ya está en ammen.`
            : ` ${who} is already on ammen.`
          : "";
      return {
        subject: es ? "Tu plan ya está listo" : "Your plan is ready",
        preheader: es
          ? "El primer día cabe en un momento."
          : "The first day fits in a moment.",
        overline: es ? "Tu cuenta" : "Your account",
        heading: es ? "Tu plan ya está listo" : "Your plan is ready",
        body: es
          ? `${name}ya puedes orar hoy. El plan sale de lo que nos contaste.${extra}`
          : `${name}you can pray today. The plan comes from what you told us.${extra}`,
        ctaLabel: es ? "Orar hoy" : "Pray today",
        transactional: true,
        layout: "account",
      };
    }
    case "waitlist":
      return {
        subject: es
          ? "Te avisamos cuando Plus esté listo"
          : "We'll tell you when Plus is ready",
        preheader: es
          ? "Apuntada. No te vamos a escribir de esto otra vez hasta entonces."
          : "You're on the list. We won't write about this again until then.",
        overline: es ? "Ammen Plus" : "Ammen Plus",
        heading: es
          ? "Te avisamos cuando Plus esté listo"
          : "We'll tell you when Plus is ready",
        body: es
          ? `${name}apuntada. No te vamos a escribir de esto otra vez hasta entonces.`
          : `${name}you're on the list. We won't write about this again until then.`,
        ctaLabel: es ? "Volver a Hoy" : "Back to Today",
        transactional: true,
        layout: "account",
      };
    case "recovery":
      return {
        subject: es ? "Elegir una contraseña nueva" : "Choose a new password",
        preheader: es
          ? "El enlace caduca. Si no lo pediste, ignóralo."
          : "The link expires. If you didn't ask for it, ignore this.",
        overline: es ? "Tu cuenta" : "Your account",
        heading: es ? "Elegir una contraseña nueva" : "Choose a new password",
        body: es
          ? "El enlace de abajo caduca. Si no pediste este cambio, puedes ignorar este correo."
          : "The link below expires. If you didn't ask for this change, you can ignore this email.",
        ctaLabel: es ? "Elegir una contraseña nueva" : "Choose a new password",
        transactional: true,
        layout: "account",
      };
    case "habit": {
      const streak = Boolean(payload.streak_at_risk);
      const dayLine =
        payload.plan_day != null
          ? es
            ? `Día ${payload.plan_day} de tu plan.`
            : `Day ${payload.plan_day} of your plan.`
          : "";
      return {
        subject: streak
          ? es
            ? "Tu día de hoy está listo"
            : "Today's day is ready"
          : es
            ? "Tu versículo de hoy"
            : "Today's verse",
        preheader: payload.verse_ref || (es ? "Orar" : "Pray"),
        overline: es ? "Versículo del día" : "Verse of the day",
        heading: streak
          ? es
            ? "Tu día de hoy está listo"
            : "Today's day is ready"
          : es
            ? "Tu versículo de hoy"
            : "Today's verse",
        body: dayLine,
        ctaLabel: es ? "Orar" : "Pray",
        verseRef: payload.verse_ref ?? undefined,
        verseText: payload.verse_text ?? undefined,
        transactional: false,
        layout: "habit",
      };
    }
    case "invite_app":
      return {
        subject: es
          ? `${who} te invita a orar en ammen`
          : `${who} invites you to pray on ammen`,
        preheader: es
          ? "Un sitio para orar cada día, y no hacerlo a solas."
          : "A place to pray every day, and not do it alone.",
        overline: es ? "Invitación" : "Invitation",
        heading: es
          ? `${who} te invita a orar en ammen`
          : `${who} invites you to pray on ammen`,
        body: es
          ? `Orar ${alone(locale, payload.gender)} pesa más. Un toque y estás dentro.`
          : `Prayer weighs more ${alone(locale, payload.gender)}. One tap and you're in.`,
        ctaLabel: es ? "Abrir" : "Open",
        transactional: false,
        layout: "person",
      };
    case "invite_circle":
      return {
        subject: es
          ? `${who} te invita a ${circle ?? "un círculo"}`
          : `${who} invites you to ${circle ?? "a circle"}`,
        preheader: es
          ? "Un círculo en ammen para orar juntas."
          : "A circle on ammen to pray together.",
        overline: es ? "Invitación" : "Invitation",
        heading: es
          ? `${who} te invita a ${circle ?? "un círculo"}`
          : `${who} invites you to ${circle ?? "a circle"}`,
        body: es
          ? "Un círculo en ammen para orar juntas."
          : "A circle on ammen to pray together.",
        ctaLabel: es ? "Ver la invitación" : "See the invitation",
        transactional: false,
        layout: "person",
      };
    case "invite_plan":
      return {
        subject: es
          ? `${who} compartió un plan contigo`
          : `${who} shared a plan with you`,
        preheader: plan || (es ? "Un plan para orar." : "A plan to pray."),
        overline: es ? "Invitación" : "Invitation",
        heading: es
          ? `${who} compartió un plan contigo`
          : `${who} shared a plan with you`,
        body: plan
          ? es
            ? `${plan}. Puedes orar por esa persona cada día.`
            : `${plan}. You can pray for them every day.`
          : es
            ? "Puedes orar por esa persona cada día."
            : "You can pray for them every day.",
        ctaLabel: es ? "Ver la invitación" : "See the invitation",
        transactional: false,
        layout: "person",
      };
    case "invite_used": {
      const redeemer =
        payload.redeemer_name?.trim() || (es ? "Alguien" : "Someone");
      return {
        subject: es
          ? `${redeemer} ya está en ammen`
          : `${redeemer} is on ammen now`,
        preheader: es ? "Tu invitación se usó." : "Your invitation was used.",
        overline: es ? "Tu cuenta" : "Your account",
        heading: es
          ? `${redeemer} ya está en ammen`
          : `${redeemer} is on ammen now`,
        body: es
          ? "Tu invitación se usó. Ya podéis orar en el mismo sitio."
          : "Your invitation was used. You can pray in the same place now.",
        ctaLabel: es ? "Abrir Hoy" : "Open Today",
        transactional: true,
        layout: "person",
      };
    }
    case "digest_social": {
      const names = (payload.names ?? []).filter(Boolean);
      const count = payload.count ?? names.length;
      const named =
        names.length === 1
          ? names[0]
          : names.length === 2
            ? `${names[0]}${es ? " y " : " and "}${names[1]}`
            : names.length > 2
              ? `${names[0]}${es ? " y " : " and "}${count - 1}${es ? " más" : " more"}`
              : null;
      return {
        subject:
          count === 1 && named
            ? es
              ? `${named} oró por ti`
              : `${named} prayed for you`
            : es
              ? "Hoy oraron por ti"
              : "People prayed for you today",
        preheader: named
          ? named
          : es
            ? "Hoy oraron por ti."
            : "People prayed for you today.",
        overline: es ? "Juntos" : "Together",
        heading:
          count === 1 && named
            ? es
              ? `${named} oró por ti`
              : `${named} prayed for you`
            : es
              ? "Hoy oraron por ti"
              : "People prayed for you today",
        body: es
          ? named
            ? `${named}. El texto de la oración se queda en la app.`
            : "El texto de la oración se queda en la app."
          : named
            ? `${named}. The prayer text stays in the app.`
            : "The prayer text stays in the app.",
        ctaLabel: es ? "Ver avisos" : "See notices",
        transactional: false,
        layout: "person",
      };
    }
    case "drip_d1":
      return {
        subject: es ? "Tu primer día está listo" : "Your first day is ready",
        preheader: es ? "Cabe en un momento." : "It fits in a moment.",
        overline: es ? "Tu plan" : "Your plan",
        heading: es ? "Tu primer día está listo" : "Your first day is ready",
        body: es
          ? `${name}el primer día cabe en un momento.`
          : `${name}the first day fits in a moment.`,
        ctaLabel: es ? "Orar hoy" : "Pray today",
        transactional: false,
        layout: "account",
      };
    case "drip_d2":
      return {
        subject: es
          ? "Te falta un minuto para tu plan"
          : "A minute left for your plan",
        preheader: es
          ? "Cuatro preguntas y el plan sale de lo que nos cuentes."
          : "Four questions, and the plan comes from what you tell us.",
        overline: es ? "Tu cuenta" : "Your account",
        heading: es
          ? "Te falta un minuto para tu plan"
          : "A minute left for your plan",
        body: es
          ? "Cuatro preguntas. El plan sale de lo que nos cuentes."
          : "Four questions. The plan comes from what you tell us.",
        ctaLabel: es ? "Seguir" : "Continue",
        transactional: true,
        layout: "account",
      };
    case "drip_d3":
      return {
        subject: es ? "Tu plan te espera" : "Your plan is waiting",
        preheader: es
          ? "El día de hoy está escrito."
          : "Today's day is already written.",
        overline: es ? "Tu plan" : "Your plan",
        heading: es ? "Tu plan te espera" : "Your plan is waiting",
        body: es
          ? `${name}el día de hoy está escrito.`
          : `${name}today's day is already written.`,
        ctaLabel: es ? "Orar hoy" : "Pray today",
        transactional: false,
        layout: "account",
      };
    case "drip_d7":
      return {
        subject: es ? "Ora con alguien" : "Pray with someone",
        preheader: es
          ? "Un círculo o una invitación. Orar a solas pesa más."
          : "A circle or an invitation. Prayer weighs more alone.",
        overline: es ? "Juntos" : "Together",
        heading: es ? "Ora con alguien" : "Pray with someone",
        body: es
          ? `${name}orar ${alone(locale, payload.gender)} pesa más. Invita a alguien o busca un círculo.`
          : `${name}prayer weighs more ${alone(locale, payload.gender)}. Invite someone or find a circle.`,
        ctaLabel: es ? "Invitar" : "Invite",
        transactional: false,
        layout: "person",
      };
    case "winback_d3":
      return {
        subject: es ? "Tu versículo de hoy" : "Today's verse",
        preheader: payload.verse_ref || (es ? "Orar hoy" : "Pray today"),
        overline: es ? "Versículo del día" : "Verse of the day",
        heading: es ? "Tu versículo de hoy" : "Today's verse",
        body: "",
        ctaLabel: es ? "Orar hoy" : "Pray today",
        verseRef: payload.verse_ref ?? undefined,
        verseText: payload.verse_text ?? undefined,
        transactional: false,
        layout: "habit",
      };
    case "winback_d7":
      return {
        subject: es ? "Ora con alguien" : "Pray with someone",
        preheader: es
          ? "Un círculo cambia el peso del día."
          : "A circle changes the weight of the day.",
        overline: es ? "Juntos" : "Together",
        heading: es ? "Ora con alguien" : "Pray with someone",
        body: es
          ? `${name}un círculo cambia el peso del día.`
          : `${name}a circle changes the weight of the day.`,
        ctaLabel: es ? "Buscar un círculo" : "Find a circle",
        transactional: false,
        layout: "person",
      };
    case "winback_d14":
      return {
        subject: es ? "¿Cambiamos la hora?" : "Change the time?",
        preheader: es
          ? "Si el aviso no cae bien, se cambia en un momento. O lo paramos."
          : "If the reminder lands badly, it changes in a moment. Or we stop it.",
        overline: es ? "Correo" : "Email",
        heading: es ? "¿Cambiamos la hora?" : "Change the time?",
        body: es
          ? "Si el aviso no cae bien, se cambia en un momento. O lo paramos."
          : "If the reminder lands badly, it changes in a moment. Or we stop it.",
        ctaLabel: es ? "Ajustar el correo" : "Adjust email",
        transactional: false,
        layout: "account",
      };
    case "winback_d30":
      return {
        subject: es
          ? "Paramos los recordatorios"
          : "We're stopping the reminders",
        preheader: es
          ? "Un toque y vuelven. La cuenta sigue siendo tuya."
          : "One tap and they come back. The account is still yours.",
        overline: es ? "Correo" : "Email",
        heading: es
          ? "Paramos los recordatorios"
          : "We're stopping the reminders",
        body: es
          ? "Un toque y vuelven. La cuenta sigue siendo tuya."
          : "One tap and they come back. The account is still yours.",
        ctaLabel: es ? "Seguir con el versículo" : "Keep the verse",
        transactional: false,
        layout: "account",
      };
    default: {
      const never: never = template;
      throw new Error(`unknown email template: ${never as string}`);
    }
  }
};

export const ctaPathFor = (
  template: EmailTemplateId,
  payload: EmailPayload,
): string => {
  switch (template) {
    case "invite_app":
      return payload.token ? `/i/${payload.token}` : "/";
    case "invite_circle":
      return payload.token ? `/c/${payload.token}` : "/circulos";
    case "invite_plan":
      return payload.token ? `/p/${payload.token}` : "/";
    case "digest_social":
      return "/avisos";
    case "drip_d2":
      return "/bienvenida";
    case "drip_d7":
    case "winback_d7":
      return "/invitar";
    case "winback_d14":
      return "/correo";
    case "winback_d30":
      return "/correo?reactivate=1";
    case "recovery":
      return payload.recovery_url || "/nueva-contrasena";
    default:
      return "/";
  }
};
