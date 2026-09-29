import { describe, expect, it } from "vitest";

import { greetingKey } from "./greeting";

describe("greetingKey", () => {
  it("distingue madrugada, mañana, tarde y noche", () => {
    expect(greetingKey(3)).toBe("common.greetingNight");
    expect(greetingKey(8)).toBe("common.greetingMorning");
    expect(greetingKey(15)).toBe("common.greetingAfternoon");
    expect(greetingKey(19)).toBe("common.greetingEvening");
    expect(greetingKey(22)).toBe("common.greetingNight");
  });
});
