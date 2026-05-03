import { validateNumber } from "@/lib/validate";
import type { RedisClient } from "@/lib/redis";

export type SubmitInput = {
  number: unknown;
  turnstileToken: unknown;
  ip: string;
};

export type SubmitResponse =
  | { status: 200; body: { result: "first"; firstsCount: number } }
  | { status: 200; body: { result: "taken"; attemptsBefore: number } }
  | {
      status: 400;
      body: { error: "bad_request" | "invalid_format" | "too_long" };
    }
  | { status: 403; body: { error: "bot_check_failed" } }
  | { status: 503; body: { error: "storage_unavailable" } }
  | { status: 500; body: { error: "server_error" } };

export type SubmitDeps = {
  redis: RedisClient;
  verifyTurnstile: (args: {
    token: string;
    ip: string;
    secret: string;
  }) => Promise<boolean>;
  secret: string;
};

export async function handleSubmit(
  input: SubmitInput,
  deps: SubmitDeps,
): Promise<SubmitResponse> {
  const v = validateNumber(input.number);
  if (!v.ok) return { status: 400, body: { error: v.reason } };

  const token =
    typeof input.turnstileToken === "string" ? input.turnstileToken : "";
  const ok = await deps.verifyTurnstile({
    token,
    ip: input.ip,
    secret: deps.secret,
  });
  if (!ok) return { status: 403, body: { error: "bot_check_failed" } };

  const number = input.number as string;
  try {
    const newCount = await deps.redis.hincrby("attempts", number, 1);
    await deps.redis.incr("stats:submissions");
    if (newCount === 1) {
      const firstsCount = await deps.redis.incr("stats:firsts");
      return { status: 200, body: { result: "first", firstsCount } };
    }
    return {
      status: 200,
      body: { result: "taken", attemptsBefore: newCount - 1 },
    };
  } catch {
    return { status: 503, body: { error: "storage_unavailable" } };
  }
}
