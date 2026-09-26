# Prophecy

Launch a prophecy. It starts trading the moment you say it.

A launchpad where every token is a one-line prophecy. Buying raises the price and selling lowers it. When the curve supply sells out, liquidity moves into a Uniswap V4 pool and is locked.

- **An address book first.** `ringo.prophecy.eth` points to the prophet's wallet, `badges-2028.ringo.prophecy.eth` to that prophecy's token (ENSv2 on Sepolia).
- **Written once, never edited.** The sentence lives in the prophecy's own ENS resolver, and nobody holds the role to change it.
- **No judging.** No oracle, no True or False. There is no status about the sentence; the only stage on screen is the market stage (auction, graduated or ended), read from the chain.
- **One prophet name per person**, checked with World ID when you first issue.

New to the project, or not a developer? Start with the **[product requirements (PRD)](docs/PRD.md)**. It explains the idea, who it is for and what success looks like, in plain words.

## How it works

```text
1. Verify    World ID, once per person      → ringo.prophecy.eth points to your wallet
2. Issue     one sentence                   → badges-2028.ringo.prophecy.eth points to a new token
                                              launch writes the sentence only to ENS
3. Trade     anyone buys or sells by name   → buying raises the price, selling lowers it
                                              each trade can carry a one-line memo
4. Sold out  all curve tokens bought        → a locked Uniswap V4 pool. Trading continues there
```

The prophet takes a share of every trade (0.30% of each curve trade, then 24% of the pool fees after graduation). Nobody is paid for being right. Numbers and rules: [`docs/SPEC.md`](docs/SPEC.md).

## Status

As of 2026-09-26. Nothing is deployed to Sepolia yet.

| Part | Built | Not yet |
|------|-------|---------|
| `contracts/` | `Launchpad`: World ID prophet names (`registerProphet`), ENS names on `launch`, bonding curve buy and sell, fees, memos, fee claims. Graduation into a Uniswap V4 pool with `ProphecyHook` and `LiquidityLocker` (fees 24 : 76, no withdraw). `ProphecyToken`, ENS adapter. Curve, fuzz, vector, lock, World, graduation, hook and locker tests | Deploying to Sepolia (a person runs it) |
| `web/` | The four screens as a clickable prototype. Wallet connect on Sepolia. Issue screen: World ID check, then a real `registerProphet` transaction. Helpers to read names and sentences from ENS (`src/lib/ens.ts`) | List, detail and prophet page still use prototype data, not live ENS or the chain. Real buy, sell and `launch` transactions |
| `world/` | World ID verification server: `GET /rp-context`, `POST /verify`, `GET /health`. Signs the result for the Launchpad | Hosting (planned on Render, see [`infra/README.md`](infra/README.md)) |
| `infra/` | Sepolia deploy scripts (dry run), GitHub Pages preview for `web/`, Render blueprint for `world/` | A person runs the real deployment |

Live task board: [`docs/PLAN.md`](docs/PLAN.md).

## Start here

| You are | Read |
|---------|------|
| Anyone new | [`docs/PRD.md`](docs/PRD.md): what and why |
| A contributor | [`CONTRIBUTING.md`](CONTRIBUTING.md): branches, PRs, who merges |
| An agent | [`AGENTS.md`](AGENTS.md) |
| Building a feature | [`docs/SPEC.md`](docs/SPEC.md), then [`docs/INTERFACE.md`](docs/INTERFACE.md) |
| Asking "why is it like this?" | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| Looking for a task | [`docs/PLAN.md`](docs/PLAN.md) |

## Commands

```bash
# contracts (Foundry)
cd contracts && forge build && forge test

# web (Bun + Vite)
cd web && bun install && bun run dev      # http://localhost:5174
cd web && bun test && bun run build

# world server (Bun)
cd world && bun install && bun test
cd world && bun start                     # http://localhost:8787
```

Environment variables: copy [`.env.example`](.env.example) and see [`infra/README.md`](infra/README.md) for who provides each value. Never commit a `.env` file.

## Layout

| Path | Role |
|------|------|
| `contracts/` | Foundry: `Launchpad`, `ProphecyToken`, ENS adapter, `ProphecyHook`, `LiquidityLocker` |
| `web/` | Vite + React 19 + wagmi + viem |
| `world/` | World ID verification server |
| `infra/` | Deploy notes, World signer helpers, Render blueprint |
| `docs/` | PRD, spec, decisions, interface, plan, ENSv2 notes |
| `.claude/` | Agent settings, skills, reviewer |
| `.github/` | CI, Pages preview, PR template |
