import { describe, expect, it } from "vitest";

import { LEGAL_DOCUMENTS, legalDocument, TERMS_VERSION } from "./documents";

/**
 * `documents.ts` promete un test de paridad entre el español y el inglés, y no
 * existía. Un documento legal que dice cosas distintas según el idioma es peor
 * que uno sin traducir: la persona acepta unos términos que no son los que leyó.
 * No se compara el texto (son idiomas distintos), sí la ESTRUCTURA: mismos
 * párrafos, mismos apartados en negrita, mismas cifras y mismas direcciones.
 */
const keys = Object.keys(LEGAL_DOCUMENTS) as (keyof typeof LEGAL_DOCUMENTS)[];

const boldCount = (paragraph: string) =>
  (paragraph.match(/\*\*[^*]+\*\*/gu) ?? []).length;

const numbers = (paragraphs: string[]) =>
  paragraphs.join(" ").match(/\d+/gu)?.sort() ?? [];

const emails = (paragraphs: string[]) =>
  paragraphs
    .join(" ")
    .match(/[\w.+-]+@[\w-]+\.[\w.-]+/gu)
    ?.sort() ?? [];

describe.each(keys)("legal document %s", (key) => {
  const es = LEGAL_DOCUMENTS[key].es;
  const en = LEGAL_DOCUMENTS[key].en;

  it("exists in both languages and is not empty", () => {
    for (const doc of [es, en]) {
      expect(doc.title.trim()).not.toBe("");
      expect(doc.updated.trim()).not.toBe("");
      expect(doc.body.length).toBeGreaterThan(3);
      for (const paragraph of doc.body) expect(paragraph.trim()).not.toBe("");
    }
  });

  it("has the same number of paragraphs and the same bold sections in the same places", () => {
    expect(en.body).toHaveLength(es.body.length);
    expect(en.body.map(boldCount)).toEqual(es.body.map(boldCount));
  });

  it("states the same figures and contact addresses in both languages", () => {
    expect(numbers(en.body)).toEqual(numbers(es.body));
    expect(emails(en.body)).toEqual(emails(es.body));
  });
});

describe("legalDocument", () => {
  it("picks the language by prefix and falls back to Spanish", () => {
    expect(legalDocument("terms", "en-GB")).toBe(LEGAL_DOCUMENTS.terms.en);
    expect(legalDocument("terms", "es-MX")).toBe(LEGAL_DOCUMENTS.terms.es);
    expect(legalDocument("terms", "fr")).toBe(LEGAL_DOCUMENTS.terms.es);
  });

  it("the terms version is a date", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});
