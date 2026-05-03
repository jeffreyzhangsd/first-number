# first-number — Design Spec

**Date:** 2026-05-02
**Status:** Approved (pre-implementation)

## Goal

Web app where a user submits a positive whole number and learns whether it is the first time _anyone_ has ever submitted that number to the system. Shared global novelty game.

## Scope (MVP)

- Single page: input + submit + result + personal history.
- Globally shared persistence across all users.
- Bot protection via invisible CAPTCHA.
- Personal session history kept in browser only.

Out of scope: leaderboards, accounts, social sharing, live feeds of others' submissions, decimal/negative numbers.

## Stack

- **Frontend:** Next.js (App Router) + Tailwind CSS, deployed on Vercel.
- **Backend:** Next.js Route Handler (`app/api/submit/route.ts`), Node runtime.
- **Storage:** Upstash Redis (free tier), provisioned via Vercel Marketplace. Auto-injected env: `KV_REST_API_URL`, `KV_REST_API_TOKEN`.
- **Bot protection:** Cloudflare Turnstile (invisible). Env: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
- **Testing:** Vitest.

## Number rules

- Positive whole integers only.
- Validation regex: `^[1-9]\d*$` (no leading zeros, no zero, no negatives, no decimals).
- Max length: 1000 characters. Prevents pathological spam input. Otherwise unbounded magnitude.
- Stored and compared as strings. No numeric parsing — sidesteps BigInt precision concerns.

## Data model (Redis)

| Key                 | Type    | Purpose                                                                     |
| ------------------- | ------- | --------------------------------------------------------------------------- |
| `attempts`          | HASH    | field = number string, value = total submission count for that number       |
| `stats:submissions` | INTEGER | total accepted submissions across all users (every successful submit)       |
| `stats:firsts`      | INTEGER | total unique numbers ever submitted (incremented only when a number is new) |

**Why HASH over SET:** `HINCRBY attempts <num> 1` is atomic and returns the new count in one op. New count `== 1` ⇒ this is the first ever submission. Count `> 1` ⇒ taken, and `count - 1` = others before this user. One operation gives both the answer and the "X others tried" data, with no second lookup.

**Atomicity note:** The three writes (`HINCRBY`, `INCR submissions`, conditional `INCR firsts`) are not wrapped in `MULTI`. Counters can drift by ≤1 in a rare crash-mid-request window. Acceptable for a novelty game — not worth transaction complexity.

## Components

```
app/
├── page.tsx                    # Single page UI
├── layout.tsx                  # Root layout, Tailwind, Turnstile script
└── api/
    └── submit/
        └── route.ts            # POST handler

lib/
├── redis.ts                    # Upstash Redis singleton
├── turnstile.ts                # verifyTurnstile(token, ip): Promise<boolean>
├── validate.ts                 # validateNumber(s): { ok, reason? }
└── config.ts                   # env validation at boot

tests/
├── validate.test.ts
├── turnstile.test.ts
├── config.test.ts
└── submit.test.ts              # API route integration test, mocked redis
```

All `lib/` modules: pure functions, functional style, no classes. Each unit isolated, testable, single-purpose.

## API contract

### `POST /api/submit`

**Request body:**

```json
{
  "number": "42",
  "turnstileToken": "0.AAAA..."
}
```

**Success — first time:**

```json
{ "result": "first", "firstsCount": 891 }
```

HTTP 200. `firstsCount` is the post-increment value of `stats:firsts`.

**Success — already taken:**

```json
{ "result": "taken", "attemptsBefore": 3 }
```

HTTP 200. `attemptsBefore = newHashCount - 1` (number of prior submissions of this same number).

**Error responses:**

| Case                      | Status | Body                                 |
| ------------------------- | ------ | ------------------------------------ |
| Malformed JSON body       | 400    | `{ "error": "bad_request" }`         |
| Format invalid            | 400    | `{ "error": "invalid_format" }`      |
| Length > 1000             | 400    | `{ "error": "too_long" }`            |
| Turnstile missing/invalid | 403    | `{ "error": "bot_check_failed" }`    |
| Redis unreachable         | 503    | `{ "error": "storage_unavailable" }` |
| Other unexpected          | 500    | `{ "error": "server_error" }`        |

`validateNumber` returns one of: `{ ok: true }`, `{ ok: false, reason: "invalid_format" }`, `{ ok: false, reason: "too_long" }`. The route handler maps `reason` directly to the error body.

On any error, **no Redis writes occur** and **no counters are incremented**. The number is not recorded.

## Server flow

```
1. Parse JSON body. If malformed → 400 bad_request.
2. validateNumber(body.number). On failure → 400 with reason as error code.
3. verifyTurnstile(body.turnstileToken, requestIp). On failure → 403.
4. newCount = HINCRBY attempts <number> 1
5. INCR stats:submissions
6. If newCount == 1: INCR stats:firsts → firstsCount; return { result: "first", firstsCount }.
7. Else: return { result: "taken", attemptsBefore: newCount - 1 }.
8. Any thrown Redis error → 503; any other thrown error → 500.
```

## Client flow

```
1. User types into input. Live-validate format; disable submit if invalid or empty.
2. On submit: read invisible Turnstile token, POST to /api/submit.
3. On 200: render result panel.
   - "first": "FIRST! You're the {firstsCount}th unique number ever submitted."
   - "taken": "Taken — {attemptsBefore} other{s} tried {number} before you."
4. On 4xx: inline error message under input. Re-enable submit.
5. On 5xx: "Server hiccup, try again." Re-enable submit. No history entry.
6. On 200 only: append to localStorage history { number, result, attemptsBefore?, firstsCount?, timestamp }.
7. Render history list below input, newest first.
```

History list is local to the browser only. No server-side per-user history.

## UI sketch

```
┌─────────────────────────────────────┐
│         FIRST NUMBER                │
│                                     │
│   Type a number. See if you're      │
│   the first.                        │
│                                     │
│   ┌─────────────────────────────┐   │
│   │       42                    │   │  ← large, centered
│   └─────────────────────────────┘   │
│              [ Submit ]              │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ FIRST! You're the 891st     │   │  ← result panel
│   │ unique number ever.         │   │
│   └─────────────────────────────┘   │
│                                     │
│   Your history                      │
│   ─────────────                     │
│   42         FIRST       just now   │
│   17         TAKEN (3)   2m ago     │
│   ...                               │
└─────────────────────────────────────┘
```

Tailwind utility classes. No custom CSS unless needed for input sizing.

## Configuration

`lib/config.ts` validates at boot:

| Env var                | Required | Source                         |
| ---------------------- | -------- | ------------------------------ |
| `KV_REST_API_URL`      | yes      | Vercel Marketplace (Upstash)   |
| `KV_REST_API_TOKEN`    | yes      | Vercel Marketplace (Upstash)   |
| `TURNSTILE_SITE_KEY`   | yes      | Cloudflare Turnstile dashboard |
| `TURNSTILE_SECRET_KEY` | yes      | Cloudflare Turnstile dashboard |

Provide `.env.example` with all four keys present and empty.

## Testing strategy

**Unit (pure functions):**

- `validate.test.ts` — table-driven valid/invalid cases including `""`, `"0"`, `"-5"`, `"1.5"`, `"01"`, `"abc"`, 1001-char string, 1000-char string (valid edge).
- `turnstile.test.ts` — mocked `fetch`, verifies request payload shape and parses success/failure response from Cloudflare.
- `config.test.ts` — missing env throws; populated env parses correctly.

**Integration (API route):**

- In-memory Redis stub matching `hincrby` / `incr` interface.
- Mocked `verifyTurnstile` toggled per test.
- Cases:
  - First submit of new number → `{ result: "first", firstsCount: 1 }`, all three counters updated.
  - Second submit of same number → `{ result: "taken", attemptsBefore: 1 }`, `submissions` incremented, `firsts` not.
  - Invalid format → 400, no Redis calls.
  - Turnstile fail → 403, no Redis calls.
  - Redis throws → 503.

**Out of scope:** E2E browser tests, real Upstash in CI.

**Manual smoke check:** Vercel preview deploy → submit number → verify Upstash dashboard shows hash field + counter values.

## Bot protection

Cloudflare Turnstile invisible widget on the page. Token included in every submit. Server verifies via `challenges.cloudflare.com/turnstile/v0/siteverify` before any Redis write.

No rate limiting. A user willing to spend their own time and CAPTCHA-solving cost to spam numbers earns whatever wins they get.

## Deployment

- Project deployed on Vercel.
- Upstash Redis added via Vercel Marketplace integration (auto-injects `KV_REST_*` env).
- Turnstile keys added manually to Vercel project env.
- `package.json` scripts: `dev`, `build`, `test`, `lint`.
- README documents setup steps for fresh clone.

## Open items deferred to implementation

- Exact Tailwind theme tokens (defer to user_design_preferences.md when implementing).
- Whether to add a "play again" affordance after result, or auto-clear input.
- Toast vs inline result panel — pick during implementation, easy to swap.
