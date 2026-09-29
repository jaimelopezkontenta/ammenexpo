import { describe, expect, it, vi } from "vitest";

import type { FeedEntry, PersonSearchResult } from "@/core/social/feed";

import { communityRowKey, isPerson, toPrayerRequest } from "./rows";

// Solo funciones puras: ni la base ni la sesión hacen falta.
vi.mock("@/utils/supabase", () => ({ supabase: {} }));

const entry = (over: Partial<FeedEntry> = {}): FeedEntry => ({
  kind: "request",
  id: "p1",
  body: "Por mi madre",
  title: null,
  is_anonymous: false,
  author_id: "u1",
  author_name: "Ana",
  author_avatar_url: null,
  prayer_count: 2,
  comment_count: 1,
  answered_at: null,
  held_at: null,
  crisis_flagged_at: null,
  created_at: "2026-09-29T10:00:00+00:00",
  i_prayed: true,
  is_mine: false,
  ...over,
});

const person: PersonSearchResult = {
  id: "p1",
  display_name: "Ana",
  avatar_url: null,
  follower_count: 3,
  i_follow: false,
};

describe("isPerson", () => {
  it("distingue una persona de una fila del feed por el `kind`", () => {
    expect(isPerson(person)).toBe(true);
    expect(isPerson(entry())).toBe(false);
  });
});

describe("communityRowKey", () => {
  it("no confunde una persona con una fila del feed del mismo id", () => {
    expect(communityRowKey(person)).not.toBe(communityRowKey(entry()));
  });

  it("en el feed, la clave es la pareja clase-id (un id se repite entre clases)", () => {
    expect(communityRowKey(entry({ kind: "request" }))).toBe("request-p1");
    expect(communityRowKey(entry({ kind: "testimony" }))).toBe("testimony-p1");
  });
});

describe("toPrayerRequest", () => {
  it("lleva a la tarjeta del muro lo que la tarjeta pinta", () => {
    expect(toPrayerRequest(entry())).toEqual({
      id: "p1",
      body: "Por mi madre",
      is_anonymous: false,
      author_id: "u1",
      author_name: "Ana",
      author_avatar_url: null,
      prayer_count: 2,
      comment_count: 1,
      answered_at: null,
      held_at: null,
      crisis_flagged_at: null,
      created_at: "2026-09-29T10:00:00+00:00",
      i_prayed: true,
      is_mine: false,
    });
  });

  it("un cuerpo nulo llega como texto vacío, no como `null`", () => {
    expect(toPrayerRequest(entry({ body: null })).body).toBe("");
  });

  it("la anónima sigue sin autor: nada que correlacionar", () => {
    const anonymous = toPrayerRequest(
      entry({ is_anonymous: true, author_id: null, author_name: null }),
    );

    expect(anonymous.is_anonymous).toBe(true);
    expect(anonymous.author_id).toBeNull();
  });
});
