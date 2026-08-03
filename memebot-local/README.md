# MemeBot Local

A local Solana meme-coin trading bot you run from your own laptop and monitor through a browser dashboard at `http://localhost:3000`. It is **not** a hosted service, not multi-user, and has no login system — it's a single-operator tool.

You describe a strategy in plain English, MemeBot Local turns it into strict structured rules, shows them to you for review, and then — once you activate it — monitors tokens and trades against those rules. It starts in **paper trading** mode with a virtual balance. Live trading against a real, separate wallet is possible but disabled by default and requires you to deliberately turn it on in two places (see [Live Trading](#live-trading) below).

## What this is not

- Not a public website or SaaS product.
- Not multi-user — there is no account system.
- No mobile app, no App Store/Play Store anything.
- No subscriptions, no payments.
- Doesn't touch your main Phantom/Trust Wallet or its seed phrase, ever.

## Safety model, in one paragraph

Automated trading only ever uses a **separate, dedicated trading wallet** you create specifically for this bot — never your main wallet, never a seed phrase you paste into the UI. That wallet's private key lives only in your local `.env` file, is never sent to the frontend, and is never logged. The bot starts in paper mode with live trading disabled by a server-side flag (`LIVE_TRADING_ENABLED=false`) that the dashboard cannot override on its own. Every trade — paper or live — passes through the same risk engine: maximum trade size, maximum open positions, maximum daily loss, minimum liquidity, slippage/price-impact caps, and a mandatory sell-simulation check before any buy. A large "EMERGENCY STOP" control is always visible and immediately halts new buys while leaving monitoring and manual selling available.

---

## 1. Install Node.js

You need **Node.js 22 or newer**. Check with:

```bash
node -v
```

If you don't have it, install it from [nodejs.org](https://nodejs.org) or via a version manager like `nvm`.

## 2. Install dependencies

From the `memebot-local` project root (this directory):

```bash
npm install
```

This installs both the `server` and `web` workspaces (a single `npm install` at the root handles both, via npm workspaces).

## 3. Configure `.env`

```bash
cp .env.example .env
```

Open `.env` in an editor. Every variable is documented inline in `.env.example` with what it's for, where to get it, and whether it's required. The short version:

| Variable | Required? | Purpose |
|---|---|---|
| `PORT` | No (default 3000) | Dashboard port |
| `DEFAULT_TRADING_MODE` | No (default `paper`) | Starting mode; live still requires the flag below |
| `SOLANA_RPC_URL` | Yes, but has a working default | Your Solana RPC endpoint. The public default is rate-limited; get a free one from [Helius](https://www.helius.dev) for real use |
| `SOLANA_PRIVATE_KEY` | No | Your dedicated trading wallet's key — leave blank and use `npm run wallet:generate` instead (see below) |
| `JUPITER_API_URL` | No (default is the free tier) | Jupiter swap API base URL |
| `JUPITER_API_KEY` | No | Only if you switch to the paid Jupiter API tier |
| `DEXSCREENER_API_URL` | No (default works, no key needed) | Market data source |
| `HELIUS_API_KEY` | No | Optional fallback for token metadata |
| `BIRDEYE_API_KEY` | No | Currently unused placeholder; reserved for future data-source fallback |
| `ANTHROPIC_API_KEY` | No | Enables AI-assisted strategy parsing for instructions the built-in parser can't confidently handle |
| `ANTHROPIC_MODEL` | No | Which Claude model to use if the key above is set |
| `LIVE_TRADING_ENABLED` | No (default `false`) | Must be the literal string `true` to allow live trading at all |

The app validates all of this at startup with Zod and will refuse to start with a clear error if something required is malformed.

## 4. Create a dedicated Solana trading wallet

**Never use your main Phantom or Trust Wallet's seed phrase here.** MemeBot Local only ever signs with a separate wallet meant just for this bot.

You have two options:

**Option A — generate a new one (recommended):**

```bash
npm run wallet:generate -w server
```

This creates a brand-new Solana keypair and writes its private key **directly into your local `.env` file** (permissions set to `600`). It prints only the new wallet's **public address** — the private key itself is never printed to your terminal, never logged, and never sent anywhere. Back up your `.env` file somewhere safe; if you lose it, you lose access to that wallet's funds. Never commit `.env` to git (it's already in `.gitignore`).

**Option B — use an existing dedicated wallet:**

If you already have a separate wallet set aside for bot trading (not your main one!), export its private key and paste it into `.env` as `SOLANA_PRIVATE_KEY`. Both formats work: a base58 string (what Phantom's "export private key" gives you) or a JSON array of numbers (what `solana-keygen new` produces).

Either way: **only fund this wallet with money you can afford to lose entirely.** Meme coins can go to zero.

## 5. Start the bot

```bash
npm run dev
```

This starts both the API server and the dashboard together. The first line of output tells you where things are; open:

```
http://localhost:3000
```

The dashboard is only reachable from your own machine (the API server binds to `127.0.0.1`, not `0.0.0.0`) unless you deliberately reconfigure it.

## 6. Open the dashboard and check the wallet

The **Dashboard** tab shows your bot status, wallet balance (paper cash balance by default, or your real trading wallet's SOL/token balances once configured), and open positions. You should see badges for `STOPPED`, `PAPER`, and either `NO TRADING WALLET` or your configured wallet.

## 7. Describe and activate a strategy

Go to the **Strategy** tab. Type a plain-English strategy, for example:

> Buy up to $20 when liquidity is above $100,000, five-minute volume is above $50,000, mint authority is disabled, freeze authority is disabled, and the top ten holders own less than 25%. Sell half at 50% profit, sell the rest at 100% profit, and stop loss at 20%.

Click **Parse Strategy**. You'll see the structured rules translated back into plain English, plus any warnings (for example, if your requested trade size exceeds your global risk limit, it gets clamped and the dashboard tells you so — it never silently loosens a limit, only tightens). You can expand **Edit rules manually** to adjust numbers directly. Give it a name and click **Confirm & Activate**.

If your instruction is unsafe or unbounded — "use my whole wallet," "buy anything trending," "ignore safety checks" — it will be rejected with the exact reason, not silently reinterpreted.

## 8. Use paper trading

Paper trading is the default and is always available, with no wallet required. Click **Start Bot** on the Dashboard (or Strategy) tab. With an active strategy, the bot polls token data on an interval, runs the same security and risk checks a live trade would use, and — in paper mode — simulates the fill (using a real Jupiter quote for realistic pricing, plus simulated network/priority fees and slippage) instead of sending a real transaction. Watch **Positions** and **History** fill in as it runs, and check **Dashboard** for realized/unrealized PnL, win rate, and other stats.

You can reset your paper balance at any time via the API (`POST /api/paper/reset`), which also wipes prior paper positions/trades so your stats stay meaningful.

## 9. Stop the bot

Click **Stop Bot** any time. This stops the monitoring loop; it does not close open positions for you (you can do that manually from the Positions tab, or just let existing stop-loss/take-profit logic keep running — wait, stopping the bot pauses evaluation entirely, so if you want stops/take-profits to keep firing while you're away, leave it running).

## 10. Live trading — how it can be enabled

Live trading is **off by default in two independent places**, and both must agree before a single real trade can happen:

1. **Server config**: `LIVE_TRADING_ENABLED=true` in `.env` (requires restarting the server after changing it).
2. **Dashboard confirmation**: clicking "Request Live Trading" and confirming a warning dialog that explains the risks.

If the server flag is `false`, the dashboard will tell you live mode is blocked by server configuration — it cannot be enabled from the UI alone. This two-key requirement is deliberate.

Once live, every trade still passes through the exact same risk engine as paper mode (max trade size, max daily loss, slippage/price-impact caps, minimum SOL reserve, mandatory sell-simulation, critical-risk-token blocking) — nothing about "live" bypasses those checks.

## 11. Withdrawing funds

MemeBot Local does not build a withdrawal UI — it has no custody model beyond "the private key is in your `.env`." To withdraw, use any standard Solana wallet (Phantom, `solana-cli`, etc.) with that same private key/keypair, and send funds to wherever you like. This is intentional: keeping withdrawals outside the app removes an entire class of risk (a compromised or buggy withdrawal endpoint) from a tool that's meant to stay small and auditable.

---

## Everyday commands

```bash
npm run dev         # start both dashboard and API, with hot reload
npm run build        # production build of both workspaces
npm start             # run the production build (single process, serves dashboard + API on PORT)
npm run test           # run the automated test suite (server logic)
npm run typecheck       # strict TypeScript check across both workspaces
```

## How it's wired up

- **Dev mode** (`npm run dev`): Vite serves the React dashboard on `http://localhost:3000` (or whatever `PORT` is set to) with hot reload, and proxies `/api/*` requests to a Fastify API server running internally on `PORT + 1`. You never need to think about the second port — it's an implementation detail of dev mode.
- **Production mode** (`npm run build && npm start`): a single Fastify process serves both the built dashboard (static files) and the API on `PORT`.
- The API server always binds to `127.0.0.1` (loopback only), not `0.0.0.0` — this app is local-only by design. If you want to expose it on your LAN, you'd need to change that bind address yourself, understanding the security implications of doing so.

## Project layout

```
memebot-local/
  server/            Fastify API + trading engine (TypeScript)
    src/
      db/            SQLite schema + migrations
      strategy/      NL parser, Zod schema, validator, AI-assisted parsing
      market/        DexScreener + on-chain (Solana RPC) data adapters
      security/      Token risk/security analysis
      jupiter/        Quote + swap execution against Jupiter
      engine/         Risk engine, paper engine, live engine, position manager,
                       bot controller / monitoring loop
      routes/         REST + SSE API endpoints
      wallet/         Trading wallet key handling (never exposed via API)
    tests/            Vitest test suite
  web/               React dashboard (Vite + Tailwind)
```

## Testing

```bash
npm run test
```

Covers: natural-language strategy parsing (including rejecting unsafe/unbounded instructions), Zod schema validation and global-limit clamping, position sizing, stop loss/take-profit/trailing-stop logic, risk engine checks (max trade size, max open positions, daily loss limit, emergency stop, live-trading-disabled gate, critical-risk blocking), token security scoring, Jupiter quote validation, paper-trade execution and PnL, and duplicate-order prevention via idempotency keys.

## What's simulated vs. real in paper mode

Paper trading fetches **real** Jupiter quotes (so pricing and price impact reflect actual market conditions at the time) and **real** on-chain/market data for security checks, but the fill itself, network fee, and priority fee are simulated — no transaction is ever sent. Paper results are a reasonable approximation, not a guarantee: they can't fully reproduce MEV, failed transactions, real slippage under load, or a rug pull that empties liquidity between your quote and a real fill.

## Known limitation: upstream dependency advisories

`npm audit` reports advisories in `bigint-buffer` and `uuid`, both transitive dependencies pulled in by `@solana/web3.js` / `@solana/spl-token`'s own dependency tree, not by this project directly. As of writing, there is no newer published version of `@solana/web3.js`/`@solana/spl-token` that resolves them without a major, breaking downgrade. This is a known, tracked issue in the Solana JS ecosystem — check `npm audit` and upgrade these packages when fixed upstream releases are available.

## Risk disclosures (read this)

- Meme coins can lose all their value, including going to zero.
- Liquidity can disappear entirely, sometimes in seconds (a "rug pull").
- Token security checks are based on available on-chain and market data and can miss malicious behavior — a low risk score is never a guarantee of safety, only "no critical issue detected by the available checks."
- Stop-loss and take-profit orders may execute below/above their intended price, especially in illiquid or fast-moving tokens.
- Transactions can fail outright, and failed transactions can still cost network fees.
- Network congestion and MEV (maximal extractable value, e.g. sandwich attacks) can affect your actual execution price versus the quoted price.
- Nothing in this project is financial advice, and past paper-trading or live results — however they look — do not guarantee future performance.
