import { describe, expect, it, vi } from "vitest";

import {
  exportDeliveryFor,
  exportFilename,
  type NativeExportDeps,
  shareExportNatively,
} from "./exportFile";

describe("exportFilename", () => {
  it("is ammen-mis-datos-AAAA-MM-DD.json with zero-padded local date", () => {
    expect(exportFilename(new Date(2026, 8, 5, 0, 30))).toBe(
      "ammen-mis-datos-2026-09-05.json",
    );
    expect(exportFilename(new Date(2026, 11, 31, 23, 59))).toBe(
      "ammen-mis-datos-2026-12-31.json",
    );
  });
});

describe("exportDeliveryFor", () => {
  it("downloads on web and shares a file on a phone", () => {
    expect(exportDeliveryFor("web", true)).toBe("download");
    expect(exportDeliveryFor("ios", false)).toBe("share-file");
    expect(exportDeliveryFor("android", false)).toBe("share-file");
  });
});

const createDeps = (overrides: Partial<NativeExportDeps> = {}) => {
  const remove = vi.fn();
  const deps = {
    prepareFile: vi.fn(() => ({ uri: "file:///cache/x.json", remove })),
    canShareFiles: vi.fn(async () => true),
    shareFile: vi.fn(async () => {}),
    shareMessage: vi.fn(async () => {}),
    onError: vi.fn(),
    ...overrides,
  } satisfies NativeExportDeps;

  return { deps, remove };
};

const BIG_JSON = JSON.stringify({ posts: "x".repeat(1_200_000) });

describe("shareExportNatively", () => {
  it("shares a >1 MB export as a file, never as message text", async () => {
    const { deps } = createDeps();

    await shareExportNatively(
      BIG_JSON,
      "ammen-mis-datos-2026-09-29.json",
      deps,
      {
        removeAfterShare: true,
      },
    );

    expect(deps.prepareFile).toHaveBeenCalledWith(
      "ammen-mis-datos-2026-09-29.json",
      BIG_JSON,
    );
    expect(deps.shareFile).toHaveBeenCalledWith(
      "file:///cache/x.json",
      "ammen-mis-datos-2026-09-29.json",
    );
    expect(deps.shareMessage).not.toHaveBeenCalled();
  });

  it("deletes the temporary file after sharing when the platform allows it", async () => {
    const { deps, remove } = createDeps();

    await shareExportNatively("{}", "f.json", deps, { removeAfterShare: true });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("keeps the file for late readers when told to (Android)", async () => {
    const { deps, remove } = createDeps();

    await shareExportNatively("{}", "f.json", deps, {
      removeAfterShare: false,
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it("falls back to sharing text when files cannot be shared", async () => {
    const { deps } = createDeps({ canShareFiles: vi.fn(async () => false) });

    await shareExportNatively("{}", "f.json", deps, { removeAfterShare: true });

    expect(deps.prepareFile).not.toHaveBeenCalled();
    expect(deps.shareMessage).toHaveBeenCalledWith("f.json", "{}");
  });

  it("falls back to text, and cleans up, when writing or sharing the file fails", async () => {
    const writing = createDeps({
      prepareFile: vi.fn(() => {
        throw new Error("disk full");
      }),
    });

    await shareExportNatively("{}", "f.json", writing.deps, {
      removeAfterShare: false,
    });
    expect(writing.deps.shareMessage).toHaveBeenCalledTimes(1);

    const sharing = createDeps({
      shareFile: vi.fn(async () => {
        throw new Error("no activity");
      }),
    });

    await shareExportNatively("{}", "f.json", sharing.deps, {
      removeAfterShare: false,
    });
    expect(sharing.remove).toHaveBeenCalledTimes(1);
    expect(sharing.deps.shareMessage).toHaveBeenCalledTimes(1);
    expect(sharing.deps.onError).toHaveBeenCalled();
  });

  it("surfaces the error when not even the text fallback works", async () => {
    const { deps } = createDeps({
      canShareFiles: vi.fn(async () => false),
      shareMessage: vi.fn(async () => {
        throw new Error("too large");
      }),
    });

    await expect(
      shareExportNatively("{}", "f.json", deps, { removeAfterShare: true }),
    ).rejects.toThrow("too large");
  });
});
