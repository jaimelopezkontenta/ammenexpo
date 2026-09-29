import { describe, expect, it, vi } from "vitest";

import {
  raiseToasts,
  subscribeToastLift,
  TOAST_BOTTOM_OFFSET,
  TOAST_KEYBOARD_GAP,
  toastBottomOffset,
  toastLift,
} from "./toastPlacement";

describe("toastBottomOffset", () => {
  it("floats above the tab bar and the safe area", () => {
    expect(
      toastBottomOffset({ safeBottom: 34, keyboardHeight: 0, lift: 0 }),
    ).toBe(34 + TOAST_BOTTOM_OFFSET);
  });

  it("sits above the iOS keyboard instead of under it", () => {
    expect(
      toastBottomOffset({ safeBottom: 34, keyboardHeight: 336, lift: 0 }),
    ).toBe(336 + TOAST_KEYBOARD_GAP);
  });

  it("clears whatever the screen floats at the bottom", () => {
    // El «Ya oré hoy» gemelo de Hoy: 68 px sobre la barra.
    expect(
      toastBottomOffset({ safeBottom: 34, keyboardHeight: 0, lift: 68 }),
    ).toBe(34 + TOAST_BOTTOM_OFFSET + 68);
  });
});

describe("raiseToasts", () => {
  it("lifts while raised and drops back when released", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToastLift(listener);

    const release = raiseToasts(68);
    expect(toastLift()).toBe(68);

    release();
    release();
    expect(toastLift()).toBe(0);
    // Una notificación al subir y otra al bajar; soltar dos veces no cuenta.
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("keeps the highest of several raises", () => {
    const low = raiseToasts(40);
    const high = raiseToasts(90);
    expect(toastLift()).toBe(90);

    high();
    expect(toastLift()).toBe(40);
    low();
    expect(toastLift()).toBe(0);
  });
});
