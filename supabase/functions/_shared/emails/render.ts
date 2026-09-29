import {
  ctaPathFor,
  renderCopy,
  type EmailLocale,
  type EmailPayload,
  type EmailTemplateId,
} from "./copy.ts";
import { escapeHtml } from "../html.ts";
import { renderPlainText, renderShell } from "./shell.ts";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  transactional: boolean;
  template: EmailTemplateId;
  locale: EmailLocale;
};

const APP_ORIGIN = (envOrigin?: string) =>
  envOrigin?.replace(/\/$/u, "") || "https://ammen.app";

const absolute = (origin: string, path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
};

export const renderEmail = (input: {
  template: EmailTemplateId;
  locale: EmailLocale;
  payload: EmailPayload;
  prefsToken?: string | null;
  appOrigin?: string;
}): RenderedEmail => {
  const copy = renderCopy(input.template, input.locale, input.payload);
  const origin = APP_ORIGIN(input.appOrigin);
  const ctaPath = ctaPathFor(input.template, input.payload);
  const ctaUrl = copy.ctaLabel ? absolute(origin, ctaPath) : undefined;
  const prefsUrl =
    !copy.transactional && input.prefsToken
      ? `${origin}/correo?t=${encodeURIComponent(input.prefsToken)}`
      : undefined;

  const bodyHtml = copy.body
    ? copy.body
        .split("\n")
        .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`)
        .join("")
    : "";

  const html = renderShell({
    preheader: copy.preheader,
    overline: copy.overline,
    locale: input.locale,
    heading: copy.heading,
    bodyHtml,
    verseRef: copy.verseRef,
    verseText: copy.verseText,
    ctaLabel: copy.ctaLabel,
    ctaUrl,
    footerPrefsUrl: prefsUrl,
    transactional: copy.transactional,
    layout: copy.layout,
  });

  const text = renderPlainText({
    heading: copy.heading,
    body: copy.body,
    verseRef: copy.verseRef,
    verseText: copy.verseText,
    ctaLabel: copy.ctaLabel,
    ctaUrl,
    footerPrefsUrl: prefsUrl,
    transactional: copy.transactional,
    locale: input.locale,
  });

  return {
    subject: copy.subject,
    html,
    text,
    transactional: copy.transactional,
    template: input.template,
    locale: input.locale,
  };
};
