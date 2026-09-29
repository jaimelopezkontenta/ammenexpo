import { describe, expect, it } from "vitest";

import { isExpectedError, toErrorReport } from "@/core/observability/track";

import { NotSignedInError, requireUserId } from "./requireUserId";

describe("requireUserId", () => {
  it("hands back the id when there is one", () => {
    expect(requireUserId("user-a")).toBe("user-a");
  });

  it.each([undefined, null, ""])(
    "throws a named error instead of sending %j to Supabase",
    (missing) => {
      expect(() => requireUserId(missing)).toThrow(NotSignedInError);
    },
  );
});

describe("NotSignedInError", () => {
  it("is an Error with its own name, so screens and reports can tell it apart", () => {
    const error = new NotSignedInError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NotSignedInError");
  });

  it("is expected: the query client does not report it as a failure", () => {
    expect(isExpectedError(new NotSignedInError())).toBe(true);
  });

  it("carries nothing personal if it is ever reported", () => {
    expect(
      toErrorReport(new NotSignedInError(), { source: "mutation" }),
    ).toEqual({ source: "mutation", name: "NotSignedInError" });
  });
});
