const ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type VerifyArgs = {
  token: string;
  ip: string;
  secret: string;
};

export type FetchFn = typeof fetch;

export async function verifyTurnstile(
  args: VerifyArgs,
  fetchFn: FetchFn = fetch,
): Promise<boolean> {
  if (!args.token) return false;
  try {
    const body = new URLSearchParams({
      secret: args.secret,
      response: args.token,
      remoteip: args.ip,
    });
    const res = await fetchFn(ENDPOINT, { method: "POST", body });
    if (!res.ok) {
      console.error("[turnstile] non-ok response", res.status);
      return false;
    }
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success !== true) {
      console.error("[turnstile] verify failed", data["error-codes"]);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[turnstile] fetch threw", err);
    return false;
  }
}
