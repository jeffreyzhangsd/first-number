import { describe, it, expect } from "vitest";
import { validateNumber } from "@/lib/validate";

describe("validateNumber", () => {
  const valid = ["1", "42", "999", "1".repeat(1000)];
  const invalid: Array<[string, "invalid_format" | "too_long"]> = [
    ["", "invalid_format"],
    ["0", "invalid_format"],
    ["-5", "invalid_format"],
    ["1.5", "invalid_format"],
    ["01", "invalid_format"],
    ["abc", "invalid_format"],
    ["1 2", "invalid_format"],
    [" 1", "invalid_format"],
    ["1 ", "invalid_format"],
    ["1".repeat(1001), "too_long"],
  ];

  for (const s of valid) {
    it(`accepts ${JSON.stringify(s.length > 20 ? s.slice(0, 10) + "…" : s)}`, () => {
      expect(validateNumber(s)).toEqual({ ok: true });
    });
  }

  for (const [s, reason] of invalid) {
    it(`rejects ${JSON.stringify(s.length > 20 ? s.slice(0, 10) + "…" : s)} as ${reason}`, () => {
      expect(validateNumber(s)).toEqual({ ok: false, reason });
    });
  }

  it("rejects non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(validateNumber(42)).toEqual({ ok: false, reason: "invalid_format" });
    // @ts-expect-error
    expect(validateNumber(null)).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    // @ts-expect-error
    expect(validateNumber(undefined)).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });
});
