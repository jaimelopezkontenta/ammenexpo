import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyProfileChanges,
  createDebouncedSaver,
  sameHours,
} from "./autosave";
import type { Profile } from "./queries";

const profile: Profile = {
  display_name: "Ana",
  avatar_url: null,
  is_staff: false,
  reminder_hours: [8, 21],
  timezone: "Europe/Madrid",
  locale: "es",
};

describe("sameHours", () => {
  it("compara por contenido, no por referencia ni por orden", () => {
    expect(sameHours([8, 21], [21, 8])).toBe(true);
    expect(sameHours([8], [8, 21])).toBe(false);
    expect(sameHours([], [])).toBe(true);
  });
});

describe("createDebouncedSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("tres toques seguidos son un solo guardado, con el último valor", () => {
    const save = vi.fn();
    const saver = createDebouncedSaver<number[]>(save, 700);

    saver.schedule([8]);
    vi.advanceTimersByTime(300);
    saver.schedule([8, 12]);
    vi.advanceTimersByTime(300);
    saver.schedule([8, 12, 21]);

    vi.advanceTimersByTime(699);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith([8, 12, 21]);
  });

  it("flush manda lo pendiente ya, una sola vez", () => {
    const save = vi.fn();
    const saver = createDebouncedSaver<number>(save, 700);

    saver.schedule(5);
    saver.flush();
    saver.flush();
    vi.advanceTimersByTime(2000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(5);
  });

  it("flush sin nada pendiente no guarda", () => {
    const save = vi.fn();
    createDebouncedSaver<number>(save, 700).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("setSave cambia quién guarda sin perder lo pendiente", () => {
    const first = vi.fn();
    const second = vi.fn();
    const saver = createDebouncedSaver<number>(first, 700);

    saver.schedule(7);
    saver.setSave(second);
    vi.advanceTimersByTime(700);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(7);
  });

  it("cancel descarta lo pendiente", () => {
    const save = vi.fn();
    const saver = createDebouncedSaver<number>(save, 700);

    saver.schedule(5);
    saver.cancel();
    vi.advanceTimersByTime(2000);

    expect(save).not.toHaveBeenCalled();
  });

  it("un valor falsy también se guarda (la lista vacía de horas)", () => {
    const save = vi.fn();
    const saver = createDebouncedSaver<number[]>(save, 100);

    saver.schedule([]);
    vi.advanceTimersByTime(100);

    expect(save).toHaveBeenCalledWith([]);
  });
});

describe("applyProfileChanges", () => {
  it("aplica solo lo que viene y no toca el resto", () => {
    expect(applyProfileChanges(profile, { displayName: "Bea" })).toEqual({
      ...profile,
      display_name: "Bea",
    });
    expect(applyProfileChanges(profile, { reminderHours: [9] })).toEqual({
      ...profile,
      reminder_hours: [9],
    });
  });

  it("recorta el nombre como lo hace la escritura en la base", () => {
    const long = ` ${"a".repeat(100)} `;
    expect(
      applyProfileChanges(profile, { displayName: long }).display_name,
    ).toBe("a".repeat(80));
  });

  it("sin cambios devuelve un perfil igual", () => {
    expect(applyProfileChanges(profile, {})).toEqual(profile);
  });
});
