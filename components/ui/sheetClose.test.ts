import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closesOnDismiss, createSheetCloseController } from "./sheetClose";

// El módulo también exporta el gancho, que importa React Native y el
// movimiento (Reanimated): aquí solo se prueba el controlador puro.
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/theme/motion", () => ({ DURATION: { exit: 180 } }));

describe("sheet onClosed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const make = (os: string) => {
    const onClosed = vi.fn();
    const controller = createSheetCloseController({
      os,
      delayMs: 180,
      onClosed,
    });
    return { onClosed, controller };
  };

  it("only iOS has a Modal onDismiss to wait for", () => {
    expect(closesOnDismiss("ios")).toBe(true);
    expect(closesOnDismiss("android")).toBe(false);
    expect(closesOnDismiss("web")).toBe(false);
  });

  it("fires on Android once the exit animation is over — onDismiss never comes there", () => {
    const { onClosed, controller } = make("android");

    controller.setVisible(true);
    controller.setVisible(false);
    expect(onClosed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(180);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("waits for onDismiss on iOS instead of guessing", () => {
    const { onClosed, controller } = make("ios");

    controller.setVisible(true);
    controller.setVisible(false);
    vi.advanceTimersByTime(1000);
    expect(onClosed).not.toHaveBeenCalled();

    controller.dismissed();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("calls onClosed once per close even if the web Modal also dismisses", () => {
    const { onClosed, controller } = make("web");

    controller.setVisible(true);
    controller.setVisible(false);
    controller.dismissed();
    vi.advanceTimersByTime(180);
    controller.dismissed();

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("a sheet mounted closed has not closed", () => {
    const { onClosed, controller } = make("web");

    controller.setVisible(false);
    vi.advanceTimersByTime(1000);
    controller.dismissed();

    expect(onClosed).not.toHaveBeenCalled();
  });

  it("forgets a pending close on unmount", () => {
    const { onClosed, controller } = make("android");

    controller.setVisible(true);
    controller.setVisible(false);
    controller.dispose();
    vi.advanceTimersByTime(1000);

    expect(onClosed).not.toHaveBeenCalled();
  });

  it("calls the handler the parent passed last, not the first one", () => {
    const { onClosed, controller } = make("android");
    const latest = vi.fn();

    controller.setVisible(true);
    controller.setOnClosed(latest);
    controller.setVisible(false);
    vi.advanceTimersByTime(180);

    expect(onClosed).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it("closes again after reopening", () => {
    const { onClosed, controller } = make("android");

    controller.setVisible(true);
    controller.setVisible(false);
    vi.advanceTimersByTime(180);
    controller.setVisible(true);
    controller.setVisible(false);
    vi.advanceTimersByTime(180);

    expect(onClosed).toHaveBeenCalledTimes(2);
  });
});
