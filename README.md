# first-number

Web app: type a number, find out if you're the first person ever to submit it.

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in:
#   - Upstash Redis (Vercel Marketplace → KV / Redis → "Get Started")
#   - Cloudflare Turnstile (https://dash.cloudflare.com → Turnstile → site)
```

## Develop

```bash
npm run dev
```

Open http://localhost:3000.

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

## Deploy

Push to a Vercel project. Add the Upstash Redis Marketplace integration (auto-injects `KV_REST_API_URL` + `KV_REST_API_TOKEN`). Manually add the four Turnstile env vars in Project Settings → Environment Variables.

## Architecture

See `docs/superpowers/specs/2026-05-02-first-number-design.md`.
