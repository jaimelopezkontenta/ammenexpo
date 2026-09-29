/**
 * Shell HTML Amanecer para todos los correos.
 *
 * No hay blur, vidrio ni NativeWind: traducción honesta a tablas. Marca fija
 * (papel crema, plum de la paleta clara) — el anochecer no aplica, igual que
 * Orb y VerseCard. Un cliente en dark mode no debe voltear el versículo.
 */

export const AMANECER = {
  sky: "#C7D6F2",
  skyDarker: "#B8C8E6",
  cream: "#FFF1DD",
  creamBg: "#FFF6EA",
  surface: "#FFFFFF",
  ember: "#F2A578",
  emberInk: "#B24A22",
  plum: "#413653",
  mistInk: "#6F6879",
  cardBorder: "rgba(255,255,255,0.60)",
  cardShadow: "0 10px 30px rgba(65,54,83,.12)",
} as const;

export type EmailLayout = "habit" | "person" | "account";

export type EmailShellInput = {
  preheader: string;
  overline?: string;
  locale: "es" | "en";
  heading: string;
  bodyHtml: string;
  verseRef?: string;
  verseText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerPrefsUrl?: string;
  /** Transaccional puro: sin enlace de cadencia. */
  transactional?: boolean;
  layout: EmailLayout;
};

const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const verseFontSize = (text: string): string =>
  text.length > 180 ? "22px" : "26px";

const ctaBlock = (label: string, url: string): string => `
  <tr>
    <td style="padding:28px 0 8px;">
      <a href="${esc(url)}" style="display:block;background:${AMANECER.ember};color:${AMANECER.plum};text-decoration:none;font-family:'General Sans',ui-sans-serif,system-ui,sans-serif;font-size:17px;font-weight:600;line-height:1.2;padding:14px 20px;border-radius:15px;text-align:center;">
        ${esc(label)}
      </a>
    </td>
  </tr>`;

const verseBlock = (ref: string, text: string): string => `
  <tr>
    <td style="padding:20px 0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${AMANECER.cream};border-radius:16px;">
        <tr>
          <td style="padding:22px 24px;">
            <p style="margin:0 0 12px;font-family:Georgia,'Cormorant Garamond',serif;font-style:italic;font-size:15px;line-height:1.4;color:${AMANECER.emberInk};">
              ${esc(ref)}
            </p>
            <p style="margin:0;font-family:Georgia,Lora,serif;font-size:${verseFontSize(text)};line-height:1.45;color:${AMANECER.plum};">
              ${esc(text)}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

const footerCopy = (
  locale: "es" | "en",
  prefsUrl?: string,
  transactional?: boolean,
) => {
  const brand = `<span style="font-family:Georgia,'Cormorant Garamond',serif;font-style:italic;">ammen</span>`;
  const contact = `hola@ammen.app`;
  const change =
    locale === "en"
      ? "Change how often we write to you"
      : "Cambiar cada cuánto te escribimos";

  const prefs =
    !transactional && prefsUrl
      ? `<br /><a href="${esc(prefsUrl)}" style="color:${AMANECER.emberInk};text-decoration:underline;">${esc(change)}</a>`
      : "";

  return `${brand} · ${esc(contact)}${prefs}`;
};

/**
 * Una anatomía para todas las plantillas: preheader, cielo, tarjeta, cabecera,
 * cuerpo, versículo opcional, un CTA, pie. Las piezas no se reordenan.
 */
export const renderShell = (input: EmailShellInput): string => {
  const overline = input.overline
    ? `<span style="font-family:'General Sans',ui-sans-serif,system-ui,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${AMANECER.mistInk};">${esc(input.overline)}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>ammen</title>
  <style>
    @font-face {
      font-family: 'Cormorant Garamond';
      font-style: italic;
      font-weight: 500;
      src: url('https://ammen.app/fonts/CormorantGaramond-Italic.woff2') format('woff2');
    }
    @font-face {
      font-family: 'General Sans';
      font-style: normal;
      font-weight: 500;
      src: url('https://ammen.app/fonts/GeneralSans-Medium.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Lora';
      font-style: normal;
      font-weight: 400;
      src: url('https://ammen.app/fonts/Lora-Regular.woff2') format('woff2');
    }
    @media (prefers-color-scheme: dark) {
      .ammen-sky { background-color: ${AMANECER.skyDarker} !important; }
    }
  </style>
</head>
<body class="ammen-sky" style="margin:0;padding:0;background:${AMANECER.sky};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${esc(input.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ammen-sky" style="background:${AMANECER.sky};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${AMANECER.surface};border:1px solid ${AMANECER.cardBorder};border-radius:20px;box-shadow:${AMANECER.cardShadow};">
          <tr>
            <td style="padding:36px 32px 40px;background:${AMANECER.creamBg};border-radius:20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family:Georgia,'Cormorant Garamond',serif;font-style:italic;font-size:26px;color:${AMANECER.plum};">
                          ammen
                        </td>
                        <td align="right">${overline}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <h1 style="margin:0 0 16px;font-family:'General Sans',ui-sans-serif,system-ui,sans-serif;font-size:${input.layout === "account" ? "26px" : "22px"};font-weight:600;line-height:1.25;color:${AMANECER.plum};">
                      ${esc(input.heading)}
                    </h1>
                    <div style="font-family:'General Sans',ui-sans-serif,system-ui,sans-serif;font-size:18px;line-height:1.5;color:${AMANECER.plum};">
                      ${input.bodyHtml}
                    </div>
                  </td>
                </tr>
                ${
                  input.verseRef && input.verseText
                    ? verseBlock(input.verseRef, input.verseText)
                    : ""
                }
                ${
                  input.ctaLabel && input.ctaUrl
                    ? ctaBlock(input.ctaLabel, input.ctaUrl)
                    : ""
                }
                <tr>
                  <td style="padding-top:36px;font-family:'General Sans',ui-sans-serif,system-ui,sans-serif;font-size:13px;line-height:1.5;color:${AMANECER.mistInk};">
                    ${footerCopy(input.locale, input.footerPrefsUrl, input.transactional)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const renderPlainText = (input: {
  heading: string;
  body: string;
  verseRef?: string;
  verseText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerPrefsUrl?: string;
  transactional?: boolean;
  locale: "es" | "en";
}): string => {
  const lines = [input.heading, "", input.body];
  if (input.verseRef && input.verseText) {
    lines.push("", input.verseRef, input.verseText);
  }
  if (input.ctaLabel && input.ctaUrl) {
    lines.push("", `${input.ctaLabel}: ${input.ctaUrl}`);
  }
  lines.push("", "ammen · hola@ammen.app");
  if (!input.transactional && input.footerPrefsUrl) {
    lines.push(
      input.locale === "en"
        ? `Change how often we write to you: ${input.footerPrefsUrl}`
        : `Cambiar cada cuánto te escribimos: ${input.footerPrefsUrl}`,
    );
  }
  return lines.join("\n");
};
