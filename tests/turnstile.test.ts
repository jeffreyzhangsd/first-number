import { describe, it, expect, vi } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

function mockFetch(response: { success: boolean; "error-codes"?: string[] }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  } as Response);
}

describe("verifyTurnstile", () => {
  it("returns true when Cloudflare reports success", async () => {
    const fetchFn = mockFetch({ success: true });
    const result = await verifyTurnstile(
      { token: "tok", ip: "1.2.3.4", secret: "sec" },
      fetchFn,
    );
    expect(result).toBe(true);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("sec");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("returns false when Cloudflare reports failure", async () => {
    const fetchFn = mockFetch({
      success: false,
      "error-codes": ["invalid-input-response"],
    });
    const result = await verifyTurnstile(
      { token: "bad", ip: "1.2.3.4", secret: "sec" },
      fetchFn,
    );
    expect(result).toBe(false);
  });

  it("returns false when token is empty", async () => {
    const fetchFn = vi.fn();
    const result = await verifyTurnstile(
      { token: "", ip: "1.2.3.4", secret: "sec" },
      fetchFn,
    );
    expect(result).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns false when fetch throws", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await verifyTurnstile(
      { token: "tok", ip: "1.2.3.4", secret: "sec" },
      fetchFn,
    );
    expect(result).toBe(false);
  });

  it("returns false when fetch returns non-ok", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const result = await verifyTurnstile(
      { token: "tok", ip: "1.2.3.4", secret: "sec" },
      fetchFn,
    );
    expect(result).toBe(false);
  });
});
