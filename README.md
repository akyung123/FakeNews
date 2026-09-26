# Prophit

Launch a prophecy. It starts trading the moment you say it.

A launchpad where every token is a one-line prophecy. Half the supply sells through a Uniswap Continuous Clearing Auction (CCA); once the auction ends, anyone can migrate it into a Uniswap V4 pool, where the position is locked and trading continues.

- **An address book first.** `alice.prophecy.eth` points to the prophet's wallet, `badges-2028.alice.prophecy.eth` to that prophecy's token (ENSv2 on Sepolia).
- **Written once, never edited.** The sentence lives in the prophecy's own ENS resolver, and nobody holds the role to change it.
- **No judging.** No oracle, no True or False. There is no status about the sentence; the only stage on screen is the market stage (auction, graduated or ended), read from the chain.
- **One prophet name per person**, checked with World ID when you first issue.

New to the project, or not a developer? Start with the **[product requirements (PRD)](docs/PRD.md)**. It explains the idea, who it is for and what success looks like, in plain words.

The product is called Prophit. The ENS parent name stays `prophecy.eth`, and the contracts keep their `Prophecy*` names.

## Live

- **Site:** <https://prism-toggle-ai.github.io/Prophit/>
- **Network:** Ethereum Sepolia (chain id `11155111`)
- **Launchpad:** [`0x0b4BF5C6f73A1204CCe07f2522db9142d2BcB4Aa`](https://sepolia.etherscan.io/address/0x0b4BF5C6f73A1204CCe07f2522db9142d2BcB4Aa)
- **Status:** prototype on Sepolia. A prophet name has been claimed and prophecies have been launched on the live Launchpad; one prophecy (`branching-minds`) has graduated and its Uniswap v4 market is open. The migrate, fee registration and swap transactions are not linked below yet.

### On-chain proof

Transactions on the deployed Launchpad. Each link opens Sepolia Etherscan; a step without a link yet reads TBD.

| Step | What it shows | Name | Link |
|------|---------------|------|------|
| `registerProphet` | A World ID-checked prophet name points to the prophet's wallet | `ringo.prophecy.eth` | [tx `0xfc7ff698…35c1fd`](https://sepolia.etherscan.io/tx/0xfc7ff6986f5165e6577552ad688a14ffd2988835fa2df09191b94c125435c1fd) |
| `launch` | The prophecy name points to a new token; the sentence is written to ENS and the CCA auction opens | slug `trump` | [tx `0xff704906…aab905`](https://sepolia.etherscan.io/tx/0xff7049069c1fcd720c2353806bdecb9961ece52d0dac84ada3aa06df80aab905) |
| Graduated prophecy | The auction reached its goal; the market is open on Uniswap v4 | slug `branching-minds` | [token `0x09f8d704…7b2398`](https://sepolia.etherscan.io/token/0x09f8d704556687efc0621580beef6511937b2398) |
| `migrate` | Liquidity moves into a locked Uniswap V4 pool | `branching-minds` | TBD |
| Fee registration (`register`) | The pool is linked to the fee vault so fees split 24 : 76 | `branching-minds` | TBD |
| `swap` | Trading on the V4 pool | `branching-minds` | TBD |

### Costs

Launch costs ~5.35M gas (token + ENS subname + CCA auction + LBP strategy in one tx), paid as network gas only; no protocol fee on launch. Mainnet plan: L2 deploy and minimal-proxy clones.

### Trust assumptions

- The `prophecy.eth` owner still holds `SET_SUBREGISTRY` and `REGISTRAR` on the parent, to be revoked after the hackathon. Until then that wallet could point `prophecy.eth` at another registry or register a prophet name without World ID. Details in [Invariants & trust assumptions](#invariants--trust-assumptions).
- Prophet registration requires an Orb-level World ID: one prophet name per verified human.

## How it works

```text
1. Verify    World ID, once per person      → alice.prophecy.eth points to your wallet
2. Issue     one sentence                   → badges-2028.alice.prophecy.eth points to a new token
                                              launch writes the sentence only to ENS, opens the CCA auction
3. Bid       anyone bids ETH by name        → the auction clears at the price that sells the auction supply
                                              runs for a fixed number of blocks (10 on the live deployment)
4. Migrate   after the auction ends         → anyone calls migrate; opens a locked Uniswap V4 pool
5. Trade     swap on the pool               → trading continues there, no further judging
```

Nobody is paid during the auction (the CCA protocol fee is off). After migrate, the prophet gets 24% of the pool's trading fees, the protocol 76%. Nobody is paid for being right. Numbers and rules: [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) (CCA path, current on `main`); [`docs/SPEC.md`](docs/SPEC.md) still documents the earlier bonding-curve design.

## Where to look (for judges)

### ENSv2: the address book

| ENSv2 feature | Where we use it |
|---|---|
| Own subname registry per prophet | [`ProphecyEns.registerProphet`](contracts/src/ens/ProphecyEns.sol#L70-L105): a UserRegistry proxy from VerifiableFactory ([L85](contracts/src/ens/ProphecyEns.sol#L85)), `setParent` then its role revoked ([L92–L93](contracts/src/ens/ProphecyEns.sol#L92-L93)) |
| Permissioned Resolver per name, written once | [`_deployLockedResolver`](contracts/src/ens/ProphecyEns.sol#L143-L161): the sentence and address are written in `initialize`, then the adapter revokes its own text admin role ([L160](contracts/src/ens/ProphecyEns.sol#L160)). Nobody can edit the sentence |
| EAC: an account may edit only certain text records | The prophet gets `avatar` and `description` only ([L158–L159](contracts/src/ens/ProphecyEns.sol#L158-L159)) |
| Non-transferable, never-expiring names | Registered with owner roles `0` and expiry `type(uint64).max` ([L100](contracts/src/ens/ProphecyEns.sol#L100), [L136](contracts/src/ens/ProphecyEns.sol#L136)) |
| Proof in tests | [`Lock.t.sol`](contracts/test/Lock.t.sol): editing the sentence reverts (L55), transfer reverts (L100), swapping the resolver reverts (L118), `avatar` stays writable (L181) |
| Reading names in the app | [`getEnsText`](web/src/lib/ens.ts#L107) through the Universal Resolver; the list reads each sentence from ENS ([`launched.ts`](web/src/lib/launched.ts#L164-L170)) |

### Uniswap: CCA → LBPStrategy → V4

| Step | Where |
|---|---|
| Launch opens a CCA through the official LBPStrategy | [`Launchpad.launch`](contracts/src/Launchpad.sol#L157) → [`initializeDistribution`](contracts/src/Launchpad.sol#L193); config encoding in [`CcaLib.build`](contracts/src/cca/CcaLib.sol#L80-L120) |
| Hook that lets LBPStrategy initialize the V4 pool | [`ProphecyHook.beforeInitialize`](contracts/src/uniswap/ProphecyHook.sol#L54-L58) (`authorized` = LBPStrategy), address mined with [`HookMiner`](contracts/src/uniswap/HookMiner.sol) |
| Locked LP position, fees 24 : 76 | [`LiquidityLocker.register`](contracts/src/uniswap/LiquidityLocker.sol#L127), [`collect`](contracts/src/uniswap/LiquidityLocker.sol#L164); no withdraw function |
| Web: bid, migrate, register, swap | [`placeBidArgs`](web/src/lib/cca/bid.ts#L31), [`openMarketWrite`](web/src/lib/cca/migrate.ts#L17), [`registerLockerWrite`](web/src/lib/cca/register.ts#L32), Universal Router [`encodeV4ExactInSingle`](web/src/lib/cca/swap.ts#L180), Quoter [`quoteExactInRequest`](web/src/lib/cca/pool.ts#L96) |
| Full loop on a Sepolia fork | [`test_launchpadHookLockerMigrateRegisterCollect`](contracts/test/fork/CcaLaunchpadFork.t.sol#L83), [`test_urSwapBuyAndSellAfterMigrate`](contracts/test/fork/CcaSepoliaFork.t.sol#L194) |
| Developer feedback | [`FEEDBACK.md`](FEEDBACK.md) |

### World ID: one prophet name per person

| Step | Where |
|---|---|
| Proof of Human request, bound to the wallet | [`WorldGate.tsx`](web/src/components/WorldGate.tsx#L357) |
| Server-side verify with the Developer Portal, then a scoped signature | [`verifyAndSign`](world/src/verify.ts#L13) |
| On-chain check and nullifier stored | [`Launchpad.registerProphet`](contracts/src/Launchpad.sol#L137) |
| Failure paths | Reused nullifier reverts `NullifierUsed` ([test](contracts/test/LaunchpadWorld.t.sol#L89)); wrong signer, chain or Launchpad reverts ([tests](contracts/test/LaunchpadWorld.t.sol#L66-L88)); cancelling or failing in the widget keeps the issue button off |

**Why this credential.** Issuing creates a permanent public record under a name that cannot be transferred, and the nullifier is never freed. The product needs one name per human, not an identity: Proof of Human gives exactly that uniqueness and nothing else. Selfie Check gives a probabilistic sybil score, so one person could end up with two permanent names. Passport would reveal attributes we do not need. Buying and browsing need no check.

**Integration debrief.**

- Time to first success: TBD (team)
- Friction: the IDKit widget closed after the prove click and had to be kept open ([#62](https://github.com/prism-toggle-ai/Prophit/pull/62)); TBD (team)
- Missing capability or docs: TBD (team)
- The one improvement with the most impact: TBD (team)

## Status

As of 2026-09-27. Deployed to Sepolia (CCA path, commit `58514dd`) — see addresses below. Live transactions are in [On-chain proof](#on-chain-proof).

| Part | Built | Not yet |
|------|-------|---------|
| `contracts/` | `Launchpad`: World ID prophet names (`registerProphet`), ENS names on `launch`, CCA auction via the official LBPStrategy v3.3.0. `migrate` opens a Uniswap V4 pool through `ProphecyHook`, locked in `LiquidityLocker` (fees 24 : 76, no withdraw). `ProphecyToken`, ENS adapter. Deployed and read back on Sepolia; fork suite green (95 tests) | Revoking the team wallet's roles on `prophecy.eth` (see [Invariants & trust assumptions](#invariants--trust-assumptions)) |
| `web/` | The four screens. Wallet connect on Sepolia. Issue screen: World ID check, then a real `registerProphet` transaction. Auction bid / claim UI reading `auctionBlocks()` on-chain, `migrate`, and a pool price chart once the market opens. Names and sentences are read from ENS (`src/lib/ens.ts`) | — |
| `world/` | World ID verification server: `GET /rp-context`, `POST /verify`, `GET /health`. Signs the result for the Launchpad. Hosted on Render's free plan, so the first request after idle can take tens of seconds | — |
| `infra/` | Sepolia deploy scripts, `deployments/sepolia.json` record, GitHub Pages site for `web/`, Render blueprint for `world/` | — |

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

## Built at ETHGlobal Tokyo 2026

- Repository history starts at [`622b60d`](https://github.com/prism-toggle-ai/Prophit/commit/622b60d538a40709d86de39c04c2c7b17c958ea3) (2026-09-26 09:13 JST), the initial commit.
- [`272d03a`](https://github.com/prism-toggle-ai/Prophit/commit/272d03a6377f1c0b4b63ade62e69296cb2e84e22) (2026-09-26 09:23 JST) imported a web prototype and contracts skeleton that the team created earlier in this same hackathon (design and prototype work done after the event started). No code or assets from before the hackathon were used.
- The curve-based prototype was then replaced by the Uniswap CCA / LBPStrategy path during the event: [`4e388db`](https://github.com/prism-toggle-ai/Prophit/commit/4e388db) (contracts, 17:30 JST), [`1e494cf`](https://github.com/prism-toggle-ai/Prophit/commit/1e494cf) (web, 18:21 JST), then later PRs such as the Sepolia deploy script ([#46](https://github.com/prism-toggle-ai/Prophit/pull/46)) and the CCA merge into `main` ([#53](https://github.com/prism-toggle-ai/Prophit/pull/53)).

## Third-party code & attribution

### Submodules (`contracts/lib/`)

| Library | Pinned commit | License | What we use it for |
|---------|---------------|---------|--------------------|
| [forge-std](https://github.com/foundry-rs/forge-std) | [`bf647bd`](https://github.com/foundry-rs/forge-std/tree/bf647bd6046f2f7da30d0c2bf435e5c76a780c1b) | MIT or Apache-2.0 | Foundry tests and deploy scripts |
| [ENS contracts-v2](https://github.com/ensdomains/contracts-v2) | [`71a3b73`](https://github.com/ensdomains/contracts-v2/tree/71a3b7339dbc55ab47667abdfe8303bac4f4c24e) | MIT | Reference for the ENSv2 types and roles we mirror (see below). Its nested OpenZeppelin Contracts (MIT) supplies the one `IERC165` interface we import |
| [Uniswap v4-core](https://github.com/Uniswap/v4-core) | [`e50237c`](https://github.com/Uniswap/v4-core/tree/e50237c43811bd9b526eff40f26772152a42daba) (v4.0.0) | BUSL-1.1 or MIT, per file | Pool types, hook flags, math libraries and `IPoolManager`; a local `PoolManager` in unit tests |

### Copied or adapted files

| Our file | Source | What we took |
|----------|--------|--------------|
| `contracts/src/uniswap/CurrencySettler.sol` | v4-core [`test/utils/CurrencySettler.sol`](https://github.com/Uniswap/v4-core/blob/e50237c43811bd9b526eff40f26772152a42daba/test/utils/CurrencySettler.sol) at `e50237c` (MIT) | Copied as is. The current locker no longer uses it |
| `contracts/src/uniswap/ProphecyHook.sol`, `contracts/src/uniswap/IInitializerHook.sol` | liquidity-launcher [`InitializerHook.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/periphery/hooks/InitializerHook.sol) and [`IInitializerHook.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IInitializerHook.sol) at `1c59049` (MIT) | The InitializerHook pattern that lets LBPStrategy initialize the V4 pool, rewritten without v4-periphery's `BaseHook` |
| `contracts/src/cca/CcaTypes.sol`, `contracts/src/cca/ICca.sol` | continuous-clearing-auction [`IContinuousClearingAuction.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol) at `7d7602d`; liquidity-launcher [`MigratorParams.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol) and [`IStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IStrategy.sol) at `1c59049` (both MIT) | Struct field order and function signatures, mirrored so our calls match the deployed contracts |
| `contracts/src/ens/EnsV2.sol` | ENS contracts-v2 at `71a3b73` (MIT) | Struct layout, role bits and function signatures, mirrored so our calls match the deployed ENSv2 contracts |
| `contracts/src/cca/I*.sol` (other minimal interfaces), `web/src/lib/cca/abi/` | The official CCA, LBPStrategy, V4 and Universal Router contracts linked in each file | Function signatures and ABI fragments only |

### Official deployed contracts and services we call (not ours)

- Uniswap on Sepolia: LBPStrategy v3.3.0, CCA factory v2.1.0, V4 PoolManager and PositionManager, Universal Router 2.1.2, Permit2. Addresses are in [Deployed addresses](#deployed-addresses-sepolia).
- ENSv2 (beta) on Sepolia: the registries and resolvers listed in [`docs/ENSV2.md`](docs/ENSV2.md) section 0.
- World ID: IDKit in the browser, and the World Developer Portal API from the `world/` server.

### Packages

- `web/`: React 19, react-router-dom 7, wagmi 3, viem 2, @tanstack/react-query 5, @worldcoin/idkit 4.3.0, Vite 6, Vitest 5 (plus Testing Library and jsdom for tests). Exact versions are in [`web/bun.lock`](web/bun.lock).
- `world/`: @worldcoin/idkit-core 4.3.0 and viem 2, run on Bun.

### License

Our code is MIT ([`LICENSE`](LICENSE)); everything above keeps its own license. forge-std, ENS contracts-v2, OpenZeppelin, liquidity-launcher and continuous-clearing-auction are MIT (forge-std also Apache-2.0), so there is no conflict. **Uniswap v4-core is dual-licensed per file (BUSL-1.1 or MIT):** nothing in `contracts/src/` imports a BUSL-1.1 file. Its BUSL-1.1 `PoolManager.sol` is compiled only in local unit tests (non-production use, which BUSL-1.1 allows); on Sepolia we call Uniswap's own deployed PoolManager. One more v4-core file, the test helper `LiquidityAmounts.sol` (header `UNLICENSED`), is imported by one test and by `Graduation.fullRangeLiquidity`, which nothing calls, so none of it ships in deployed bytecode.

## AI tools used

Counted on `main` at [`c383e8e`](https://github.com/prism-toggle-ai/Prophit/commit/c383e8e) (2026-09-26): 377 commits, 252 of them not merge commits. The commit author and the `Co-Authored-By` trailer say which tool wrote each one.

| Who | Non-merge commits | Share | Main areas |
|-----|------------------:|------:|------------|
| Cursor Agent | 206 | 82% | Contracts: the CCA Launchpad, `LiquidityLocker`, `ProphecyHook`, the ENS adapter and lock tests, Foundry unit tests and Sepolia fork tests, deploy scripts. Web: the CCA library (`web/src/lib/cca/`) and UI wiring for bid, claim, migrate and swap. The `world/` server. Infra scripts, CI and the Pages workflow |
| Claude Code | 30 | 12% | Repo setup, docs (PRD, README, `PRODUCTION.md`, DECISIONS and PLAN updates), agent settings (`AGENTS.md`, `CLAUDE.md`, `.claude/`). Web features: follow prophets, prophet profile, the Following page, wallet balances, pool price chart, Sepolia RPC budget, World ID widget fix |
| Humans only (no AI trailer) | 16 | 6% | The initial commit, the Sepolia deployment record, and edits made in the GitHub editor (merge-conflict fixes, doc citations) |

- **Cursor Agent:** 203 commits it authored, plus 3 squash-merged PRs ([#7](https://github.com/prism-toggle-ai/Prophit/pull/7), [#10](https://github.com/prism-toggle-ai/Prophit/pull/10), [#16](https://github.com/prism-toggle-ai/Prophit/pull/16)) that carry its co-author trailer.
- **Claude Code:** 10 commits it authored, plus 20 committed by akyung123 with a Claude co-author trailer.
- **Merge commits (125):** 63 PR merges, all by akyung123, and 62 merges of `main` into feature branches (48 by Cursor Agent, 9 by akyung123, 5 by Claude Code).
- **Humans (akyung123 and team):** product spec, design direction, decisions, reviewing and merging every PR, live testing on Sepolia and in World App.
- **Spec and planning artifacts in the repo:** [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md), [`.claude/`](.claude/) (settings, hooks, skills, the `contract-reviewer` agent), [`docs/PRD.md`](docs/PRD.md), [`docs/SPEC.md`](docs/SPEC.md), [`docs/PLAN.md`](docs/PLAN.md), [`docs/DECISIONS.md`](docs/DECISIONS.md), [`docs/INTERFACE.md`](docs/INTERFACE.md), [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md).

To recount on a newer `main`:

```bash
git rev-list --count main                   # all commits
git rev-list --count --no-merges main       # non-merge commits
git log --no-merges --format='%an | %(trailers:key=Co-Authored-By,valueonly,separator=; )' main | sort | uniq -c
```

## What we built vs reused

**Built during the event:**

- `contracts/src/Launchpad.sol`: World ID prophet names (`registerProphet`), and on `launch` the token, its ENS name and sentence, and the CCA auction through LBPStrategy
- `contracts/src/ProphecyToken.sol`
- The ENS adapter: `contracts/src/ens/`
- `contracts/src/uniswap/LiquidityLocker.sol`: holds the V4 position with no withdraw path and splits fees 24 : 76 on `collect`
- The `ProphecyHook` wiring: hook salt mining (`HookMiner.sol`), `setUniswap` and `setCca` on the Launchpad
- `contracts/src/cca/CcaLib.sol`: LBPStrategy config encoding and the auction step schedule
- All Foundry tests in `contracts/test/`, including the Sepolia fork E2E tests in `contracts/test/fork/`, and the deploy scripts in `contracts/script/`
- The web app in `web/`: CCA, World ID and ENS flows, and every page
- The World ID verification server in `world/`
- `infra/`: deploy scripts, the deployment record, World signer helpers, the Render blueprint

**Reused:** only the libraries and files listed in [Third-party code & attribution](#third-party-code--attribution), and the official Uniswap contracts deployed on Sepolia (plus ENSv2 and World ID as services we call).

## Start here

| You are | Read |
|---------|------|
| Anyone new | [`docs/PRD.md`](docs/PRD.md): what and why |
| A contributor | [`CONTRIBUTING.md`](CONTRIBUTING.md): branches, PRs, who merges |
| An agent | [`AGENTS.md`](AGENTS.md) |
| Building a feature | [`docs/SPEC.md`](docs/SPEC.md), then [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) (CCA path, current) or [`docs/INTERFACE.md`](docs/INTERFACE.md) (curve fallback) |
| Asking "why is it like this?" | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| Judging demo vs production | [`docs/PRODUCTION.md`](docs/PRODUCTION.md): demo constants, what a real service changes, open questions |
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

## Invariants & trust assumptions

- **LP principal cannot be withdrawn.** The `LiquidityLocker` holds the PositionManager NFT and has no path to remove liquidity — only `collect` (fees 24 : 76).
- **Fee recipient is fixed at launch.** The prophet and protocol addresses are set when `launch` writes the ENS record and opens the auction; they cannot be changed afterwards.
- **One name per person (World nullifier).** `registerProphet` stores the World ID nullifier on-chain. A second registration with the same nullifier reverts.
- **World signature is scoped.** The server signs `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))`. A signature for one chain, contract, or wallet cannot be replayed elsewhere.
- **`worldSigner` is a single trusted key.** If this key leaks, anyone can forge a World verification and the one-name-per-person rule breaks. `worldSigner` is `immutable`, set in the Launchpad constructor; rotating it means a new Launchpad.
- **The parent name is not locked yet.** Every prophet and prophecy name is written once and locked, but one level up the team wallet still owns `prophecy.eth` on the `.eth` registry with `SET_SUBREGISTRY`, and holds `REGISTRAR` on the parent registry. With those it could point `prophecy.eth` at another registry, or register a prophet name without World ID. `prophecy.eth` also has a `.eth` expiry, and names under it stop resolving if it lapses. We plan to revoke those roles and renew the name for a long term; revoking is irreversible, so it is a separate, person-confirmed step.
- **Demo data.** TBD (team): if a demo prophet was registered with a signature made directly with the World signer key instead of an in-app World ID check, name it here.

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
| `LICENSE` | MIT, for our code. Third-party code keeps its own license: see [License](#license) |
