import { describe, it, expect, beforeEach, afterEach } from "vitest";

const KEYS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
] as const;

describe("loadConfig", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) original[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("returns config when all envs present", async () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "tok";
    process.env.TURNSTILE_SITE_KEY = "site";
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const { loadConfig } = await import("@/lib/config");
    expect(loadConfig()).toEqual({
      kvUrl: "https://example.upstash.io",
      kvToken: "tok",
      turnstileSiteKey: "site",
      turnstileSecretKey: "secret",
    });
  });

  it("throws when any env is missing", async () => {
    for (const k of KEYS) delete process.env[k];
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    // others missing
    const { loadConfig } = await import("@/lib/config");
    expect(() => loadConfig()).toThrow(/KV_REST_API_TOKEN/);
  });

  it("throws when env is empty string", async () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "";
    process.env.TURNSTILE_SITE_KEY = "site";
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const { loadConfig } = await import("@/lib/config");
    expect(() => loadConfig()).toThrow(/KV_REST_API_TOKEN/);
  });
});
