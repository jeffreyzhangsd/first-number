import { describe, it, expect, vi } from "vitest";
import { handleSubmit } from "@/lib/submit";
import { makeFakeRedis } from "./helpers/fakeRedis";

function deps(
  opts: {
    turnstilePass?: boolean;
    redisFail?: "hincrby" | "incr";
  } = {},
) {
  const redis = makeFakeRedis();
  if (opts.redisFail) redis.failNext(opts.redisFail);
  return {
    redis,
    verifyTurnstile: vi.fn().mockResolvedValue(opts.turnstilePass ?? true),
    secret: "sec",
  };
}

describe("handleSubmit", () => {
  it("returns first on a brand-new number", async () => {
    const d = deps();
    const res = await handleSubmit(
      { number: "42", turnstileToken: "t", ip: "1.2.3.4" },
      d,
    );
    expect(res).toEqual({
      status: 200,
      body: { result: "first", firstsCount: 1 },
    });
    expect(d.redis.state.hashes.get("attempts")?.get("42")).toBe(1);
    expect(d.redis.state.counters.get("stats:submissions")).toBe(1);
    expect(d.redis.state.counters.get("stats:firsts")).toBe(1);
  });

  it("returns taken on a repeat number", async () => {
    const d = deps();
    await handleSubmit({ number: "42", turnstileToken: "t", ip: "1.2.3.4" }, d);
    const res = await handleSubmit(
      { number: "42", turnstileToken: "t", ip: "1.2.3.4" },
      d,
    );
    expect(res).toEqual({
      status: 200,
      body: { result: "taken", attemptsBefore: 1 },
    });
    expect(d.redis.state.hashes.get("attempts")?.get("42")).toBe(2);
    expect(d.redis.state.counters.get("stats:submissions")).toBe(2);
    expect(d.redis.state.counters.get("stats:firsts")).toBe(1); // not incremented
  });

  it("returns 400 invalid_format on bad input", async () => {
    const d = deps();
    const res = await handleSubmit(
      { number: "abc", turnstileToken: "t", ip: "1.2.3.4" },
      d,
    );
    expect(res).toEqual({ status: 400, body: { error: "invalid_format" } });
    expect(d.redis.state.counters.size).toBe(0);
    expect(d.redis.state.hashes.size).toBe(0);
    expect(d.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("returns 400 too_long on oversized input", async () => {
    const d = deps();
    const res = await handleSubmit(
      { number: "1".repeat(1001), turnstileToken: "t", ip: "1.2.3.4" },
      d,
    );
    expect(res).toEqual({ status: 400, body: { error: "too_long" } });
  });

  it("returns 403 on turnstile failure, no redis writes", async () => {
    const d = deps({ turnstilePass: false });
    const res = await handleSubmit(
      { number: "42", turnstileToken: "t", ip: "1.2.3.4" },
      d,
    );
    expect(res).toEqual({ status: 403, body: { error: "bot_check_failed" } });
    expect(d.redis.state.counters.size).toBe(0);
    expect(d.redis.state.hashes.size).toBe(0);
  });

  it("returns 503 on redis failure", async () => {
    const d = deps({ redisFail: "hincrby" });
    const res = await handleSubmit(
      { number: "42", turnstileToken: "t", ip: "1.2.3.4" },
      d,
    );
    expect(res).toEqual({
      status: 503,
      body: { error: "storage_unavailable" },
    });
  });

  it("validates before turnstile (cheap check first)", async () => {
    const d = deps();
    await handleSubmit({ number: "0", turnstileToken: "t", ip: "1.2.3.4" }, d);
    expect(d.verifyTurnstile).not.toHaveBeenCalled();
  });
});
