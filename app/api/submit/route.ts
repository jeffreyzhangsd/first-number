import { NextRequest, NextResponse } from "next/server";
import { handleSubmit } from "@/lib/submit";
import { getRedis } from "@/lib/redis";
import { verifyTurnstile } from "@/lib/turnstile";
import { loadConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const cfg = loadConfig();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";

    const result = await handleSubmit(
      {
        number: (body as { number?: unknown })?.number,
        turnstileToken: (body as { turnstileToken?: unknown })?.turnstileToken,
        ip,
      },
      {
        redis: getRedis(),
        verifyTurnstile: ({ token, ip, secret }) =>
          verifyTurnstile({ token, ip, secret }),
        secret: cfg.turnstileSecretKey,
      },
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
