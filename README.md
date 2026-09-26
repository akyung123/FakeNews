# Prophecy

Launch a prophecy. It starts trading the moment you say it.

A launchpad where every token is a one-line prophecy. Buying raises the price and selling lowers it. When the curve supply sells out, liquidity moves into a Uniswap V4 pool and is locked.

- **An address book first.** `ringo.prophecy.eth` points to the prophet's wallet, `badges-2028.ringo.prophecy.eth` to that prophecy's token (ENSv2 on Sepolia).
- **Written once, never edited.** The sentence lives in the prophecy's own ENS resolver, and nobody holds the role to change it.
- **No judging.** No oracle, no True or False. After its deadline a prophecy is simply *Departed*.
- **One prophet name per person**, checked with World ID when you first issue.

New to the project, or not a developer? Start with the **[product requirements (PRD)](docs/PRD.md)**. It explains the idea, who it is for and what success looks like, in plain words.

## How it works

```text
1. Verify    World ID, once per person      → ringo.prophecy.eth points to your wallet
2. Issue     one sentence + a deadline      → badges-2028.ringo.prophecy.eth points to a new token
                                              the sentence is locked forever
3. Trade     anyone buys or sells by name   → buying raises the price, selling lowers it
                                              each trade can carry a one-line memo
4. Deadline  passes                         → the prophecy shows "Departed". Nothing is deleted
5. Sold out  all curve tokens bought        → a locked Uniswap V4 pool. Trading continues there
```

The prophet earns a share of every trade (0.30% of each curve trade, then 24% of the pool fees after graduation). Nobody is paid for being right. Numbers and rules: [`docs/SPEC.md`](docs/SPEC.md).

## Status

As of 2026-09-26. Nothing is deployed to Sepolia yet.

| Part | Built | Not yet |
|------|-------|---------|
| `contracts/` | `Launchpad` bonding curve: buy, sell, fees, memos, fee claims, last-buy fill and refund. `ProphecyToken`. ENS adapter (`ProphecyEns`). Curve, fuzz, vector and ENS lock tests | `registerProphet` (World ID) reverts for now. `launch` does not create the ENS name yet. Uniswap V4 pool, `ProphecyHook`, `LiquidityLocker` |
| `web/` | The four screens as a clickable prototype (data in `localStorage`). Wallet connect on Sepolia. World ID issue flow (mock by default) | Reading prophecies from the chain and ENS. Sending real trades |
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
| `contracts/` | Foundry: `Launchpad`, `ProphecyToken`, ENS adapter. Next: `ProphecyHook`, `LiquidityLocker` |
| `web/` | Vite + React 19 + wagmi + viem |
| `world/` | World ID verification server |
| `infra/` | Deploy notes, World signer helpers, Render blueprint |
| `docs/` | PRD, spec, decisions, interface, plan, ENSv2 notes |
| `.claude/` | Agent settings, skills, reviewer |
| `.github/` | CI, Pages preview, PR template |
