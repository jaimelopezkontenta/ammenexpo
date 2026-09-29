import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  buildShareUrl,
  canCopyText,
  copyPathFor,
  copyText,
  shareOrCopy,
} from "./share";

const platformMock = vi.hoisted(() => ({
  os: "web",
}));

const clipboardMock = vi.hoisted(() => ({
  setStringAsync: vi.fn<(text: string) => Promise<boolean>>(),
}));

vi.mock("expo-clipboard", () => clipboardMock);

let originalAppUrl: string | undefined;

function setNavigator(nav: unknown | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    value: nav,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  // Guard EXPO_PUBLIC_APP_URL once per test suite.
  originalAppUrl = process.env.EXPO_PUBLIC_APP_URL;
  setNavigator(undefined);
  platformMock.os = "web";
});

afterEach(() => {
  // Restore EXPO_PUBLIC_APP_URL even if an expect fails.
  if (originalAppUrl === undefined) {
    delete process.env.EXPO_PUBLIC_APP_URL;
  } else {
    process.env.EXPO_PUBLIC_APP_URL = originalAppUrl;
  }
});

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformMock.os;
    },
  },
  Share: { share: vi.fn() },
}));

describe("shareOrCopy (web)", () => {
  it("devuelve 'failed' cuando no hay navigator.clipboard.writeText", async () => {
    const result = await shareOrCopy("Hola", "https://ejemplo.com/link");

    expect(result).toBe("failed");
  });

  it("devuelve 'copied' y llama writeText con la url cuando clipboard existe", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({
      clipboard: { writeText },
    });

    const result = await shareOrCopy("Hola", "https://ejemplo.com/link");

    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://ejemplo.com/link");
  });
});

describe("buildShareUrl", () => {
  it("quita la barra final de appUrl antes de construir el enlace", () => {
    process.env.EXPO_PUBLIC_APP_URL = "https://ammen.app/";

    expect(buildShareUrl("p/123")).toBe("https://ammen.app/p/123");
  });

  it("añade '/' al path si no lo tiene", () => {
    process.env.EXPO_PUBLIC_APP_URL = "https://ammen.app";

    expect(buildShareUrl("p/123")).toBe("https://ammen.app/p/123");
    expect(buildShareUrl("/p/123")).toBe("https://ammen.app/p/123");
  });

  it("incluye el parámetro 'de' cuando se pasa source", () => {
    process.env.EXPO_PUBLIC_APP_URL = "https://ammen.app";

    expect(buildShareUrl("p/123", "plan")).toBe(
      "https://ammen.app/p/123?de=plan",
    );
  });
});

describe("copyText", () => {
  it("copies on web when the clipboard exists", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } });

    expect(canCopyText()).toBe(true);
    expect(await copyText("https://ejemplo.com/p/abc")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://ejemplo.com/p/abc");
  });

  it("says no when it cannot copy, instead of pretending", async () => {
    expect(canCopyText()).toBe(false);
    expect(await copyText("x")).toBe(false);
  });

  it("copies on native with expo-clipboard, never the browser clipboard", async () => {
    platformMock.os = "ios";
    const writeText = vi.fn();
    setNavigator({ clipboard: { writeText } });
    clipboardMock.setStringAsync.mockResolvedValueOnce(true);

    expect(canCopyText()).toBe(true);
    expect(await copyText("https://ejemplo.com/p/abc")).toBe(true);
    expect(clipboardMock.setStringAsync).toHaveBeenCalledWith(
      "https://ejemplo.com/p/abc",
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it("reports a native copy that failed as not copied", async () => {
    platformMock.os = "android";
    clipboardMock.setStringAsync.mockRejectedValueOnce(new Error("denied"));

    expect(await copyText("x")).toBe(false);
  });
});

describe("copyPathFor", () => {
  const withClipboard = { clipboard: { writeText: async () => {} } };

  it("uses the browser clipboard on web only when it exists", () => {
    expect(copyPathFor("web", withClipboard)).toBe("web");
    expect(copyPathFor("web", {})).toBeNull();
    expect(copyPathFor("web", undefined)).toBeNull();
  });

  it("always uses the native clipboard on a phone", () => {
    expect(copyPathFor("ios", undefined)).toBe("native");
    expect(copyPathFor("android", withClipboard)).toBe("native");
  });
});
