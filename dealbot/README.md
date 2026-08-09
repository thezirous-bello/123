# DealBot

An autonomous Telegram deal-hunting + affiliate bot with a private admin dashboard.

Scans connected product/affiliate sources → verifies discounts against real price
history (not just a merchant's claimed "was" price) → scores each deal (Deal Score
+ a separate Profit Score) → builds a real affiliate link → generates a Telegram
post → posts it to the right channel → tracks real clicks via a self-hosted
redirect. Nothing here fabricates data: demo mode uses clearly-labeled sample
products only; production mode only ever acts on real connected sources, and
metrics a provider doesn't supply (conversions, revenue) are shown as
unavailable rather than estimated.

## Stack

TypeScript throughout. `server/` — Fastify, better-sqlite3, Zod. `web/` — React,
Vite, Tailwind CSS v4. Same monorepo layout as this repo's sibling trading-bot
project (`memebot-local/`).

## Quick start

```bash
npm install
cp .env.example .env
# edit .env: at minimum set DASHBOARD_PASSWORD and SESSION_SECRET
npm run dev
```

Open http://localhost:4000, log in, click **START**. In demo mode (the
default) it immediately starts scanning a small built-in catalog of clearly
synthetic "Demo ..." products, so you can watch the whole pipeline — scan →
verify → score → reject/approve → affiliate link → Telegram post — run for
real before connecting anything.

## Going to production

### 1. A real deal source

Only a `demo` source ships built in. To connect a real one (Amazon
Associates PA-API, AWIN, CJ Affiliate, Rakuten Advertising, or a merchant's
own feed), implement the `DealSourceAdapter` interface in
`server/src/sources/` (see `demoSource.ts` for the shape) and register it in
`server/src/sources/registry.ts`. Every field an adapter returns must come
from the provider's real response — never invent a "reference price" to
manufacture a discount.

Then, on the **Sources** tab, add a source of that kind and set its real
affiliate tag/ID. Set `DEALBOT_MODE=production` in `.env` once at least one
real source is connected — production mode never falls back to the demo
catalog.

### 2. A Telegram bot

Create one for free via [@BotFather](https://t.me/BotFather) — no approval
needed. Put the token in `.env` as `TELEGRAM_BOT_TOKEN`. Add the bot as an
admin of your channel, post once, then hit
`https://api.telegram.org/bot<token>/getUpdates` to find the channel's chat
id. Add the channel on the **Channels** tab.

### 3. Real click tracking (optional but recommended)

Set `PUBLIC_BASE_URL` to this server's real public URL (e.g.
`https://deals.example.com`) if you're running it on a real server. Posts
then link through this server's own `/r/:slug` redirect, which logs a real
click before forwarding to the real affiliate URL — genuine click/CTR data,
not an estimate. Without it, posts link straight to the affiliate URL and
clicks aren't tracked.

### 4. Conversions/commission (optional)

Nothing in V1 talks to an affiliate network's own conversion-reporting
API/webhook — that's provider-specific and needs your account's
credentials. `server/src/tracking/repository.ts` exports `recordConversion`
for wiring one in later; until then, the dashboard honestly shows
conversions/revenue as "—" rather than a fabricated number.

## What's real vs. what needs your credentials

| Piece | Status |
|---|---|
| Scan loop, verification, scoring, rules engine, blocklists | Fully real, works today |
| Telegram posting, message editing (deal-ended), admin notifications | Fully real Bot API calls — inert until you set `TELEGRAM_BOT_TOKEN` |
| Affiliate link builder (tag-based, e.g. Amazon-Associates-style) | Fully real — works with just an affiliate tag string |
| Click tracking via `/r/:slug` | Fully real, self-hosted — needs `PUBLIC_BASE_URL` to be reachable by Telegram viewers |
| Conversions / commission / revenue | Schema + dashboard ready; needs a real affiliate-network integration you connect |
| Product/deal sources | Demo catalog ships built in; real providers need you to write + register an adapter with your own API credentials |

## Scripts

```bash
npm run dev         # server (tsx watch) + web (vite), concurrently
npm run build        # both workspaces
npm run typecheck    # both workspaces
npm test             # server test suite (vitest)
npm start             # production server (serves the built dashboard too)
```

## Security

Dashboard access requires login (`DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` in
`.env`) and a session cookie signed by `SESSION_SECRET` — change all three
before running this anywhere but your own machine. All API keys/tokens stay
server-side in `.env`, never sent to the browser. The server binds to
`127.0.0.1` only; if you deploy it to run 24/7, put it behind a reverse
proxy (nginx/Caddy) rather than exposing it directly.
