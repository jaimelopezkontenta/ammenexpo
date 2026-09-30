import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createActionMenuRunner } from "./actionMenuRunner";
import { createSheetCloseController } from "./sheetClose";

// `sheetClose.ts` también exporta el gancho, que importa React Native y el
// movimiento: aquí solo se usan los controladores puros.
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/theme/motion", () => ({ DURATION: { exit: 180 } }));

describe("ActionMenu runner", () => {
  it("runs a plain action in the same tap, after asking the menu to close", () => {
    const runner = createActionMenuRunner();
    const calls: string[] = [];

    runner.press({ onPress: () => calls.push("report") }, () =>
      calls.push("close"),
    );

    expect(calls).toEqual(["close", "report"]);
  });

  it("holds an afterClose action until the menu is gone", () => {
    const runner = createActionMenuRunner();
    const block = vi.fn();
    const close = vi.fn();

    runner.press({ onPress: block, afterClose: true }, close);
    expect(close).toHaveBeenCalledTimes(1);
    expect(block).not.toHaveBeenCalled();

    runner.closed();
    expect(block).toHaveBeenCalledTimes(1);
  });

  it("runs it once, not on every later close", () => {
    const runner = createActionMenuRunner();
    const block = vi.fn();

    runner.press({ onPress: block, afterClose: true }, () => {});
    runner.closed();
    runner.closed();

    expect(block).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a close that nobody asked an action for (scrim, X, back)", () => {
    const runner = createActionMenuRunner();
    expect(() => runner.closed()).not.toThrow();
  });

  it("forgets a held action when the menu opens again before its close landed", () => {
    const runner = createActionMenuRunner();
    const block = vi.fn();

    runner.press({ onPress: block, afterClose: true }, () => {});
    runner.opened();
    runner.closed();

    expect(block).not.toHaveBeenCalled();
  });
});

describe("ActionMenu runner + sheet onClosed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Lo que monta `ActionMenu`: el toque cierra (visible → false) y la acción
  // aplazada sale del `onClosed` de la hoja, no del toque.
  const mount = (os: string) => {
    const runner = createActionMenuRunner();
    const controller = createSheetCloseController({
      os,
      delayMs: 180,
      onClosed: runner.closed,
    });
    controller.setVisible(true);
    runner.opened();
    return { runner, controller };
  };

  it("on Android and web, opens the confirmation after the exit animation", () => {
    for (const os of ["android", "web"]) {
      const { runner, controller } = mount(os);
      const ask = vi.fn();

      runner.press({ onPress: ask, afterClose: true }, () =>
        controller.setVisible(false),
      );
      expect(ask).not.toHaveBeenCalled();

      vi.advanceTimersByTime(180);
      expect(ask).toHaveBeenCalledTimes(1);
    }
  });

  it("on iOS, waits for the Modal's onDismiss", () => {
    const { runner, controller } = mount("ios");
    const ask = vi.fn();

    runner.press({ onPress: ask, afterClose: true }, () =>
      controller.setVisible(false),
    );
    vi.advanceTimersByTime(1000);
    expect(ask).not.toHaveBeenCalled();

    controller.dismissed();
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
