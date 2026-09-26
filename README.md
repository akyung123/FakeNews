# Prophecy

Launch a prophecy. It starts trading the moment you say it.

A launchpad where every token is a one-line prophecy. Half the supply sells through a Uniswap Continuous Clearing Auction (CCA); once the auction ends, anyone can migrate it into a Uniswap V4 pool, where the position is locked and trading continues.

- **An address book first.** `ringo.prophecy.eth` points to the prophet's wallet, `badges-2028.ringo.prophecy.eth` to that prophecy's token (ENSv2 on Sepolia).
- **Written once, never edited.** The sentence lives in the prophecy's own ENS resolver, and nobody holds the role to change it.
- **No judging.** No oracle, no True or False. There is no status about the sentence; the only stage on screen is the market stage (auction, graduated or ended), read from the chain.
- **One prophet name per person**, checked with World ID when you first issue.

New to the project, or not a developer? Start with the **[product requirements (PRD)](docs/PRD.md)**. It explains the idea, who it is for and what success looks like, in plain words.

## How it works

```text
1. Verify    World ID, once per person      → ringo.prophecy.eth points to your wallet
2. Issue     one sentence                   → badges-2028.ringo.prophecy.eth points to a new token
                                              launch writes the sentence only to ENS, opens the CCA auction
3. Bid       anyone bids ETH by name        → the auction clears at the price that sells the auction supply
                                              runs for a fixed number of blocks (10 on the live deployment)
4. Migrate   after the auction ends         → anyone calls migrate; opens a locked Uniswap V4 pool
5. Trade     swap on the pool               → trading continues there, no further judging
```

Nobody is paid during the auction (the CCA protocol fee is off). After migrate, the prophet gets 24% of the pool's trading fees, the protocol 76%. Nobody is paid for being right. Numbers and rules: [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) (CCA path, current on `main`); [`docs/SPEC.md`](docs/SPEC.md) still documents the earlier bonding-curve design.

## Status

As of 2026-09-26. Deployed to Sepolia (CCA path, commit `58514dd`) — see addresses below. No prophecy has been launched on the live contract yet, so there is no live bid, claim, or migrate on-chain.

| Part | Built | Not yet |
|------|-------|---------|
| `contracts/` | `Launchpad`: World ID prophet names (`registerProphet`), ENS names on `launch`, CCA auction via the official LBPStrategy v3.3.0, memos, fee claims. `migrate` opens a Uniswap V4 pool through `ProphecyHook`, locked in `LiquidityLocker` (fees 24 : 76, no withdraw). `ProphecyToken`, ENS adapter. Deployed and read back on Sepolia; fork suite green (95 tests) | A live launch, bid, claim, and migrate on the deployed contract |
| `web/` | The four screens. Wallet connect on Sepolia. Issue screen: World ID check, then a real `registerProphet` transaction. Auction bid / claim UI reading `auctionBlocks()` on-chain, `migrate`, and a pool price chart once the market opens. Helpers to read names and sentences from ENS (`src/lib/ens.ts`) | List, detail and prophet page fall back to prototype rows until a real prophecy is launched and picked up from a `Launched` log |
| `world/` | World ID verification server: `GET /rp-context`, `POST /verify`, `GET /health`. Signs the result for the Launchpad | Hosting (planned on Render, see [`infra/README.md`](infra/README.md)) |
| `infra/` | Sepolia deploy scripts, `deployments/sepolia.json` record, GitHub Pages preview for `web/`, Render blueprint for `world/` | Hosting the World server for a live demo |

Live task board: [`docs/PLAN.md`](docs/PLAN.md). Build and deploy notes: [`FEEDBACK.md`](FEEDBACK.md).

## Deployed addresses (Sepolia)

From [`deployments/sepolia.json`](deployments/sepolia.json), source commit `58514dd`, deploy block `11785558`.

| Contract | Address |
|---|---|
| Launchpad | `0x0b4BF5C6f73A1204CCe07f2522db9142d2BcB4Aa` |
| ProphecyEns adapter | `0x90258b09Ea17fBdEED808889c6b96E6000E7B5FD` |
| ProphecyHook | `0x5f7Ba2Fa7e57873D9E57575e2Fc30F71897ea000` |
| LiquidityLocker | `0x3c2642CDDB4CEE7fC65568240fD5c1C98Be70ff6` |

Official Uniswap contracts this deployment points at (not ours — pinned and cited in [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) section 0):

| Contract | Address |
|---|---|
| LBPStrategy v3.3.0 | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` |
| CCA factory v2.1.0 | `0x000000001F26a0044BaA66024e7b6599c61963F8` |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| PositionManager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` |
| Universal Router 2.1.2 | `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

ENSv2 addresses are separate — see [`docs/ENSV2.md`](docs/ENSV2.md) section 0.

## Start here

| You are | Read |
|---------|------|
| Anyone new | [`docs/PRD.md`](docs/PRD.md): what and why |
| A contributor | [`CONTRIBUTING.md`](CONTRIBUTING.md): branches, PRs, who merges |
| An agent | [`AGENTS.md`](AGENTS.md) |
| Building a feature | [`docs/SPEC.md`](docs/SPEC.md), then [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) (CCA path, current) or [`docs/INTERFACE.md`](docs/INTERFACE.md) (curve fallback) |
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
| `docs/` | PRD, spec, decisions, interface (curve and CCA), plan, ENSv2 notes |
| `.claude/` | Agent settings, skills, reviewer |
| `.github/` | CI, Pages preview, PR template |
