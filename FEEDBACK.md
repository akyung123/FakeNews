# Uniswap Foundation — developer feedback (Prophecy)

Prize-submission notes for Uniswap. Facts only, from this repo and official Uniswap source / docs. Do not invent findings. `TODO(team)` means the result is not in yet.

Sources: [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) (CCA path), [`docs/INTERFACE.md`](docs/INTERFACE.md) (curve fallback on `main`), [`docs/DECISIONS.md`](docs/DECISIONS.md) #1, #18–#22, [PR #38 `CCA_RESEARCH.md`](https://github.com/prism-toggle-ai/FakeNews/blob/a45aecb37f7e1fdc64bed17b1391bb2f603a8ea3/docs/CCA_RESEARCH.md) (`a45aecb`), official pins in INTERFACE_CCA section 0.

Gates (KST): 22:00 INTERFACE + contract skeleton; 02:00 Sepolia-fork 4 steps; 03:30 web + deploy script. Miss any gate → submit the bonding-curve Launchpad already on `main`.

## Project context

Prophecy is a Sepolia launchpad that turns one sentence into a token. The address book is the core feature (`ringo.prophecy.eth` → wallet, `lingo-2028.ringo.prophecy.eth` → token). There is no oracle and no True / False; after the deadline the only on-screen status is Departed. We never describe the price as recording truth (DECISIONS #1).

On `main`, people buy and sell on a bonding curve; when that supply sells out, liquidity moves into a Uniswap v4 pool and is locked. On the `cca` family we replace the curve with Uniswap CCA + official LBPStrategy v3.3.0, then `migrate` opens the v4 pool.

## What we built on CCA + LBPStrategy + v4 hook

**Status (2026-09-26):** docs accepted on the `cca` branch (INTERFACE + DECISIONS #18–#22). Contracts, fork test, web, and deploy script are **not** on this PR.

| Piece | Decision / official path | Built? |
|---|---|---|
| Launchpad → LBPStrategy | `initializeDistribution(token, totalSupply, configData, salt)` on Sepolia `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000`. Strategy pulls tokens, factory-creates the CCA, calls `onTokensReceived` | Docs only. `TODO(team)` skeleton / fork |
| CCA factory v2.1.0 | Official `0x000000001F26a0044BaA66024e7b6599c61963F8` (`7d7602d`). We do not deploy a factory | Address pinned. No `create` from Launchpad — strategy calls it |
| Auction | ETH currency, 25 blocks, `requiredCurrencyRaised = 0.02 ETH`. Bid = budget + max price. State via CCALens `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | Docs only. `TODO(team)` bid / claim on a fork |
| `migrate` | Anyone calls `LBPStrategy.migrate(initializer)` after `migrationBlock`. Opens ETH/token pool, fee `10000`, tickSpacing `200` | Docs only. `TODO(team)` fork step 3 |
| `ProphecyHook` | Must **inherit** `InitializerHook`. `authorized()` = LBPStrategy. Reference hook on Sepolia: `0x1600059B95A80d500fC42400ea9a88A9C29D2000` | Curve-era hook on `main` authorizes Launchpad only and has no ERC165. Rewrite is `TODO(team)` |
| `LiquidityLocker` | Holds the PositionManager NFT (`positionRecipient`). `collect` still 24 : 76. No principal out | Curve-era locker on `main` is PoolManager-native, not an ERC-721 receiver. Rewrite is `TODO(team)` |
| Recipients | `fundsRecipient` = LBPStrategy (else `InvalidFundsRecipient`). `recipient` and `tokensRecipient` = protocol or Launchpad — never the prophet, and `tokensRecipient` never the strategy | Written into INTERFACE. `TODO(team)` to encode |

`TODO(team):` Sepolia-fork outcome for the four steps (launch+create auction, bid, migrate opens v4 pool, swap). `TODO(team):` gas for `initializeDistribution`, `submitBid`, `checkpoint`, `exitBid`, `claimTokens`, `migrate`, swap.

## What worked (verified in source / on `main`, not yet on the CCA fork)

- Official Sepolia LBPStrategy `initializerFactory()` is the v2.1.0 CCA factory; `poolManager()` / `positionManager()` match the v4 Sepolia table. Read on-chain in PR #38 (public RPC, 2026-09-26).
- Official `initializeDistribution` / `migrate` / `AuctionParameters` / `MigratorParameters` decode is documented and present at commit `1c5904912aefceaceb89c24528cd5e25d0b61597`. We did not have to invent a factory function name: v2 renamed `initializeDistribution` → factory `create`; the strategy still exposes `initializeDistribution`.
- CCALens `state(auction)` is the intended off-chain read (`eth_call`; it checkpoints via a revert payload). `getInitializedTickData` is `view`.
- On `main`, a local `new PoolManager(owner)` plus `StateLibrary` was enough to exercise initialize, full-range liquidity, donate and collect without a fork (curve graduation). `Hooks.validateHookPermissions` in the constructor catches a wrong hook address immediately.
- `TickMath.minUsableTick` / `maxUsableTick` for spacing 200 give `-887200` / `887200`.

## Friction — official path cannot attach our hook / locker as-is

Recorded from official LBPStrategy v3.3.0 source and from our curve-era contracts on `main`. This is why B2 rewrites the hook and locker instead of passing today’s addresses into `MigratorParameters`.

| Date / time (KST) | Area | Issue | Workaround | Suggestion |
|---|---|---|---|---|
| 09-26 (research, PR #38) | LBP hook | `validateHook` requires ERC165 `IInitializerHook`, `authorized() == address(this)` (the strategy), a valid hook address for the fee, and `BEFORE_INITIALIZE`. Our `ProphecyHook` authorized Launchpad and had no ERC165 | Inherit `InitializerHook`; set `authorized` to LBPStrategy `0x9543…2000` | Put “custom hook must inherit InitializerHook and set authorized to *this* LBPStrategy” next to the deployments table, not only in TechnicalReference |
| 09-26 (research) | LBP hook | Official Sepolia `InitializerHook` `0x1600…2000` has `authorized() == LBPStrategy`. Using that address as `poolParameters.hook` initializes **that** hook, not ours | Deploy our own CREATE2 hook that inherits the same base | Show a “bring your own InitializerHook” snippet with the constructor `(PoolManager, authorized)` |
| 09-26 (research) | Locker | `migrate` mints via `PositionManager.modifyLiquidities` and transfers each NFT to `positionRecipient`. Our locker `lock` / `collect` talk to PoolManager `modifyLiquidity` and have no `onERC721Received` | Rewrite locker as the NFT holder; collect through PositionManager | Document that `positionRecipient` is the only supported lock. Setting it to a PoolManager-native contract silently fails to lock |
| 09-26 (research) | Recipients | `fundsRecipient` **must** be the strategy (`InvalidFundsRecipient`). `tokensRecipient` **must not** be the strategy (`InvalidTokensRecipient`). `recipient` takes unused currency and recover-on-fail | Set funds to the strategy; set the other two to protocol / Launchpad; never the prophet | The two “recipient” names (`recipient` vs `tokensRecipient` vs `fundsRecipient`) are easy to swap. A one-line matrix in the LBP deploy guide would have saved a revert |
| 09-26 (research) | Factory name | DeploymentGuide still shows `initializeDistribution` on the CCA factory. Source v2+ is `create`. Strategy kept `initializeDistribution` | Call the strategy, not the factory, from Launchpad | Fix the stale DeploymentGuide snippet or mark it factory-v1 only |
| 09-26 (research) | Docs vs source | [Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments) says the factory “has no constructor parameters”. Factory v2.0.0+ takes `_protocolFeeController` | Ignore that sentence; official Sepolia factory was deployed with `address(0)` (fees off) | Align the deployments page with `ContinuousClearingAuctionFactory.sol` L20–L22 |
| 09-26 (research) | README vs deployments | CCA README at tag `v2.1.0` still lists v2.0.0 as “latest”. Deployments page lists factory v2.1.0 at `0x000000001F26…63F8` / `7d7602d` | Use the deployments page for addresses | Ship the v2.1.0 row in the README table in the same commit as the tag |
| 09-26 (research) | Gas | No official `.forge-snapshots` tree at CCA v2.1.0. Docs warn the no-hint `submitBid` is gas-intensive; `forceIterateOverTicks` can OOG | 5-arg `submitBid` with `prevTickPriceQ96`; do not iterate ticks in the demo | Publish snapshots for `create`, `submitBid` (hint / no hint), `checkpoint`, `exitBid`, `claimTokens`, `LBPStrategy.migrate` |
| 09-26 ~12:30 | Hook (curve era, still true) | Address permission bits are part of the product: a normal `CREATE` address fails `validateHookPermissions` in the constructor | In-repo HookMiner (CREATE2, 14-bit mask) | Getting-started should put “mine the salt before the first real deploy” above the `deployCodeTo` example |
| 09-26 ~12:45 | Hook sender (curve era) | `beforeInitialize` sees the `initialize` caller as `sender`. A helper that initializes on behalf of the Launchpad is rejected | Then: initialize from Launchpad. Now: initialize from LBPStrategy, so `authorized` must change | Call this out next to the hook `sender` docs |
| 09-26 ~13:00 | Tooling (curve era) | `LiquidityAmounts` and `CurrencySettler` live under `v4-core/test/utils`, not `src/` | Import those two files | Promote them to `src/libraries` or document test-utils as the supported path |
| 09-26 ~13:10 | Tooling (curve era) | `PoolManager.sol` is `pragma solidity 0.8.26` (exact). Repo was on 0.8.24 | Bump `foundry.toml` to 0.8.26 | One line on the install page: solc must be exactly 0.8.26 for v4.0.0 |

## Docs / tooling gaps

- Hook permission flags and CREATE2: [Hooks getting started](https://developers.uniswap.org/docs/protocols/v4/guides/hooks/getting-started) shows `deployCodeTo` in the template tests. That hides the CREATE2 path a real deploy needs.
- LBP custom hook: inherit `InitializerHook` + `authorized() == LBPStrategy` is enforced in `MigratorParams.validateHook` but easy to miss if you start from the CCA factory alone.
- Factory constructor vs deployments page (see table).
- CCA README latest-version row vs deployments v2.1.0 (see table).
- `v4-core` v4.0.0: `LiquidityAmounts.sol` and `CurrencySettler.sol` are only under `test/utils/`.
- Universal Router 2.1.2 Sepolia address is on the [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments) page; tag `v2.1.2` was not fetchable as a git ref from this environment, so **V4_SWAP command bytes stay `TBD(backend)`** in INTERFACE.
- No published gas snapshots for CCA v2.1.0 / LBPStrategy v3.3.0 migrate.

## Curve-era v4 work still on `main` (fallback)

If a CCA gate is missed, this is the Uniswap integration we already have.

**Status:** Launchpad graduates on the completing curve buy: initialize the v4 pool, lock LP in `LiquidityLocker`. Hook, locker and graduation math landed in PR #23. No Sepolia V4 deploy recorded.

| Piece | Spec (then DECISIONS #11) | Built? |
|---|---|---|
| Graduation | Last curve buy fills remaining supply, refunds excess ETH, sets `complete`, opens a v4 pool (native ETH / token, 1% = 10000, tickSpacing 200, full-range), locker holds the position | Wired on `main`. Leftover seed ETH/tokens refund to Launchpad (`receive` from locker / PoolManager only) |
| `ProphecyHook` | `beforeInitialize` allows only the Launchpad. CREATE2 salt for permission flags | Built. CREATE-predicted Launchpad address breaks the hook/launchpad cycle |
| `LiquidityLocker` | No principal withdraw. `collect` pays prophet 24 : protocol 76 | Built. Failed prophet ETH is accrued; `withdrawAccrued` pays it later |

Notes from that slice:

- Tests deploy `PoolManager` in-process (`new PoolManager(owner)`). No fork.
- Hook flags: `BEFORE_INITIALIZE_FLAG` only (`1 << 13`).
- `v4-core` pinned at tag `v4.0.0` (`e50237c`). `v4-periphery` was not required for the PoolManager-native locker.

### Curve-era test status

```text
cd contracts && forge build && forge test
# result on main (curve): 63 tests passed, 0 failed, 4 skipped (67 total)
```

- Solvency: pass (`testFuzz_solvency`)
- Round trip never gains: pass (`testFuzz_roundTripNeverGains`)
- Graduation vs pool start price: pass (`testFuzz_priceGapUnderLimit`, gap < 68 ppm)

CCA fork result: `TODO(team)`.

## Suggestions (concrete)

1. One deployments page row per chain that states: factory address + LBPStrategy address + InitializerHook address + `authorized()` target + PositionManager. We had to join three pages and an `eth_call` to learn the Sepolia hook only accepts that strategy.
2. A “custom hook + locker” cookbook: inherit `InitializerHook`, mine CREATE2 flags, set `positionRecipient` to an ERC-721 locker, set `fundsRecipient` to the strategy, set `tokensRecipient` / `recipient` to a non-strategy address.
3. Fix the factory constructor sentence and the v2.1.0 README latest-version line.
4. Publish gas snapshots for the four demo steps we have to pass (create, bid-with-hint, migrate, swap).
5. Keep `deployCodeTo` in tests, but put CREATE2 salt mining in the first hook guide.

## 09-26 note — switching from curve graduation to official migrate

The hard part of the curve-era hook was the address and the caller, not the hook body. Official LBP makes that stricter: the caller **must** be the strategy, the hook **must** speak ERC165, and the lock **must** be an NFT. That is a product fit (we still want a locked pool and a 24 : 76 fee split) but it is not a drop-in. [`INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) records the rewrite so frontend, backend and infra can move in parallel. `INTERFACE.md` on `main` stays the curve contract. Implementation results belong in the rows marked `TODO(team)`.
