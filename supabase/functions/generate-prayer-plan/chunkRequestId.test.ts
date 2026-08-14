import { describe, expect, it } from "vitest";

import { deriveChunkRequestId } from "./chunkRequestId";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("deriveChunkRequestId", () => {
  it("returns a version-5 UUID", async () => {
    const derived = await deriveChunkRequestId(
      "11110000-0000-0000-0000-000000000011",
    );

    expect(derived).toMatch(UUID_RE);
  });

  it("is deterministic: the same reservation yields the same chunk id", async () => {
    const reservation = "11110000-0000-0000-0000-000000000011";

    expect(await deriveChunkRequestId(reservation)).toBe(
      await deriveChunkRequestId(reservation),
    );
  });

  it("is never the same as the reservation id, so the two never collide on the UNIQUE key", async () => {
    const reservation = "11110000-0000-0000-0000-000000000011";

    expect(await deriveChunkRequestId(reservation)).not.toBe(reservation);
  });

  it("gives different chunk ids to different reservations", async () => {
    const a = await deriveChunkRequestId(
      "11110000-0000-0000-0000-000000000011",
    );
    const b = await deriveChunkRequestId(
      "11110000-0000-0000-0000-000000000012",
    );

    expect(a).not.toBe(b);
  });
});
