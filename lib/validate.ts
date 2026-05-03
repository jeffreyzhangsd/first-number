export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: "invalid_format" | "too_long" };

const FORMAT = /^[1-9]\d*$/;
const MAX_LEN = 1000;

export function validateNumber(input: unknown): ValidateResult {
  if (typeof input !== "string") return { ok: false, reason: "invalid_format" };
  if (input.length > MAX_LEN) return { ok: false, reason: "too_long" };
  if (!FORMAT.test(input)) return { ok: false, reason: "invalid_format" };
  return { ok: true };
}
