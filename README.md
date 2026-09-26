# Prophecy

Launch a prophecy. It starts trading the moment you say it.

A launchpad where every token is a one-line prophecy. Buying raises the price and selling lowers it. When the curve supply sells out, liquidity moves into a Uniswap V4 pool and is locked.

- **An address book first.** `ringo.prophecy.eth` points to the prophet's wallet, `lingo-2028.ringo.prophecy.eth` to that prophecy's token (ENSv2 on Sepolia).
- **Written once, never edited.** The sentence lives in the prophecy's own ENS resolver, and nobody holds the role to change it.
- **No judging.** No oracle, no True or False. After its deadline a prophecy is simply *Departed*.
- **One prophet name per person**, checked with World ID when you first issue.

## Status

| Part | State |
|------|-------|
| `web/` | Clickable prototype without a chain (bonding-curve math in the browser, data in localStorage) |
| `contracts/` | Skeleton. Being rebuilt to match [`docs/SPEC.md`](docs/SPEC.md) |
| `world/` | Not started |

## Start here

- **Everyone:** [`CONTRIBUTING.md`](CONTRIBUTING.md) for how we work (branches, PRs, who merges)
- **Agents:** [`AGENTS.md`](AGENTS.md)
- **Product:** [`docs/SPEC.md`](docs/SPEC.md)
- **Tasks:** [`docs/PLAN.md`](docs/PLAN.md)
- **Infra:** [`docs/INFRA.md`](docs/INFRA.md) (Sepolia deploy, hosting, human inputs)

## Commands

```bash
cd contracts && forge build && forge test
cd web && bun install && bun run dev      # http://localhost:5174
cd web && bun run build
```

## Layout

| Path | Role |
|------|------|
| `contracts/` | Foundry: `Launchpad`, `ProphecyToken`, `ProphecyHook`, `LiquidityLocker` |
| `web/` | Vite + React 19 + viem |
| `world/` | World ID verification server (planned) |
| `docs/` | Spec, decisions, interface, plan, ENSv2 notes |
| `.claude/` | Agent settings, skills, reviewer |
