import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderCopy, type EmailTemplateId } from "./copy.ts";
import { renderEmail } from "./render.ts";
import { renderShell } from "./shell.ts";

const ALL_TEMPLATES: EmailTemplateId[] = [
  "welcome",
  "waitlist",
  "habit",
  "recovery",
  "invite_app",
  "invite_circle",
  "invite_plan",
  "invite_used",
  "digest_social",
  "drip_d1",
  "drip_d2",
  "drip_d3",
  "drip_d7",
  "winback_d3",
  "winback_d7",
  "winback_d14",
  "winback_d30",
];

describe("email copy", () => {
  it("welcome uses tú and never the prayer body", () => {
    const copy = renderCopy("welcome", "es", {
      first_name: "Zoe",
      circle_name: "Oración de martes",
      inviter_name: "Jaime",
    });

    expect(copy.subject).toBe("Tu plan ya está listo");
    expect(copy.body).toContain("Zoe");
    expect(copy.body).toContain("Jaime te espera en Oración de martes");
    expect(copy.body).not.toMatch(/oración privada|prayer_body|cadence|nudge/i);
    expect(copy.transactional).toBe(true);
  });

  it("habit uses the verse panel and a streak subject without guilt", () => {
    const copy = renderCopy("habit", "es", {
      verse_ref: "Salmos 23:1",
      verse_text: "Jehová es mi pastor; nada me faltará.",
      plan_day: 3,
      streak_at_risk: true,
    });

    expect(copy.subject).toBe("Tu día de hoy está listo");
    expect(copy.subject).not.toMatch(/perder|racha|extrañ/i);
    expect(copy.verseRef).toBe("Salmos 23:1");
    expect(copy.body).toBe("Día 3 de tu plan.");
  });

  it("digest never includes prayer text even if a name is present", () => {
    const copy = renderCopy("digest_social", "es", {
      names: ["María"],
      count: 1,
    });

    expect(copy.subject).toBe("María oró por ti");
    expect(copy.body).not.toMatch(/Señor|ayúdame|prayer/i);
  });

  it("win-back D14 does not count absent days", () => {
    const copy = renderCopy("winback_d14", "en", {});
    expect(copy.subject).toBe("Change the time?");
    expect(copy.body).not.toMatch(/12 days|te extrañamos|hace \d+/i);
  });

  it("every template renders in es and en without prayer-body leaks", () => {
    for (const template of ALL_TEMPLATES) {
      for (const locale of ["es", "en"] as const) {
        const copy = renderCopy(template, locale, {
          first_name: "Zoe",
          inviter_name: "Jaime",
          circle_name: "Martes",
          plan_title: "Paz",
          verse_ref: "Salmos 23:1",
          verse_text: "Jehová es mi pastor; nada me faltará.",
          names: ["María"],
          count: 1,
          redeemer_name: "Beto",
          token: "abc",
        });
        expect(copy.subject.length).toBeGreaterThan(0);
        expect(copy.body).not.toMatch(
          /prayer_body|daily_action|interpretation/,
        );
      }
    }
  });
});

describe("email shell", () => {
  it("is one CTA, cream verse panel, and does not flip in dark mode", () => {
    const html = renderShell({
      preheader: "Salmos 23:1",
      overline: "Versículo del día",
      locale: "es",
      heading: "Tu versículo de hoy",
      bodyHtml: "",
      verseRef: "Salmos 23:1",
      verseText: "Jehová es mi pastor; nada me faltará.",
      ctaLabel: "Orar",
      ctaUrl: "https://ammen.app/",
      footerPrefsUrl: "https://ammen.app/correo?t=abc",
      layout: "habit",
    });

    expect(html).toContain('role="presentation"');
    expect(html).toContain("#FFF1DD");
    expect(html).toContain("#F2A578");
    expect(html).toContain("ammen");
    expect(html).toContain("Cambiar cada cuánto te escribimos");
    expect(html).not.toContain("Unsubscribe");
    expect(html).toContain("color-scheme");
    expect(html.match(/<a href=/g)?.length).toBeGreaterThanOrEqual(1);
    // Un CTA sólido, no un link azul como acción principal.
    expect(html).toContain("border-radius:15px");
  });
});

describe("renderEmail", () => {
  it("writes a plain-text twin that still carries the verse", () => {
    const mail = renderEmail({
      template: "habit",
      locale: "es",
      payload: {
        verse_ref: "Salmos 23:1",
        verse_text: "Jehová es mi pastor; nada me faltará.",
      },
      prefsToken: "token",
      appOrigin: "https://ammen.app",
    });

    expect(mail.subject).toBe("Tu versículo de hoy");
    expect(mail.text).toContain("Salmos 23:1");
    expect(mail.text).toContain("Jehová es mi pastor");
    expect(mail.text).toContain("/correo?t=token");
    expect(mail.html).not.toMatch(/prayer_body|daily_action/);
  });

  it("writes HTML previews for the four pilot templates", () => {
    const dir = join(process.cwd(), "email-preview");
    mkdirSync(dir, { recursive: true });

    const pilots = [
      [
        "welcome",
        {
          first_name: "Zoe",
          circle_name: "Oración de martes",
          inviter_name: "Jaime",
        },
      ],
      ["recovery", { recovery_url: "https://ammen.app/nueva-contrasena" }],
      ["waitlist", { first_name: "Zoe" }],
      [
        "habit",
        {
          verse_ref: "Salmos 23:1",
          verse_text: "Jehová es mi pastor; nada me faltará.",
          plan_day: 1,
        },
      ],
    ] as const;

    for (const [template, payload] of pilots) {
      const mail = renderEmail({
        template,
        locale: "es",
        payload,
        prefsToken: "preview",
        appOrigin: "https://ammen.app",
      });
      writeFileSync(join(dir, `${template}.html`), mail.html, "utf8");
      expect(mail.html).toContain("ammen");
    }
  });
});
