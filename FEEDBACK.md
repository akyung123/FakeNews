# Uniswap Foundation — developer feedback (Prophecy)

Fallback write-up for the Uniswap Foundation if V4 deployment integration is cut at the **22:00 KST** check. Fill rows as work happens. Do not invent findings.

Sources: [`docs/SPEC.md`](docs/SPEC.md), [`docs/DECISIONS.md`](docs/DECISIONS.md) #11.

## Project context

Prophecy is a Sepolia launchpad that turns one sentence into a token. Buying raises the price and selling lowers it. When the curve supply sells out, liquidity moves into a Uniswap V4 pool and is locked so later traders still have a market. The address book is the core feature (`ringo.prophecy.eth` → wallet, `lingo-2028.ringo.prophecy.eth` → token). There is no oracle and no True / False; after the deadline the only on-screen status is Departed.

## What we built / planned with Uniswap V4

**Status:** hook, locker and graduation math are implemented and tested against a locally deployed `PoolManager`. Launchpad still does not call them (follow-up PR). No Sepolia V4 deploy in this change.

| Piece | Spec (DECISIONS #11 / SPEC “Uniswap V4”) | Built? |
|---|---|---|
| Graduation | Last curve buy fills remaining supply, refunds excess ETH, sets `complete`, opens a V4 pool (native ETH / token, 1% = 10000 pips, tickSpacing 200, full-range liquidity), sends the position NFT to the locker, burns leftover tokens | Math + seed helper built. Launchpad wiring not in this PR |
| `ProphecyHook` | `beforeInitialize` allows only the Launchpad. Hook address is part of the `PoolKey`. Deployed with a mined CREATE2 salt so the address bits carry the hook permission flags | Built. Tested with HookMiner CREATE2 |
| `LiquidityLocker` | Holds the position. No withdraw. Anyone may call `collect`; fees go only to prophet 24 : protocol 76 | Built. Position is owned by the locker via `modifyLiquidity` (no PositionManager NFT yet) |

Notes while implementing (addresses, salts, `PoolManager` used):

- Tests deploy `PoolManager` in-process (`new PoolManager(owner)`). No fork, no Sepolia `PoolManager` address recorded.
- Hook flags: `BEFORE_INITIALIZE_FLAG` only (`1 << 13`). Constructor calls `Hooks.validateHookPermissions`.
- `v4-core` pinned at tag `v4.0.0` (`e50237c`). `v4-periphery` was not required for this slice.

## Running log — blockers and friction

Add a row when something slows V4 work. Leave unused rows blank. Times in KST.

| Date / time (KST) | Area | Issue | Workaround | Suggestion |
|---|---|---|---|---|
| 09-26 ~12:30 | Hook | Address permission bits are part of the product: a normal `CREATE` address fails `validateHookPermissions` in the constructor. Salt mining is mandatory, not optional tooling. | In-repo HookMiner (CREATE2, 14-bit mask). Test deploys at a flagged address. | Official getting-started guide should put “mine the salt before the first compile of a real hook” above the example that uses `deployCodeTo`. |
| 09-26 ~12:45 | Graduation / Hook | `beforeInitialize` sees the `initialize` caller as `sender`. A locker or helper that initializes on behalf of the Launchpad is rejected. | Library `Graduation.initializePool` runs in the Launchpad (or test) context. Locker only adds liquidity after that. | Call this out next to the hook `sender` docs. It is easy to put initialize inside the locker unlock and then spend an hour on a revert with no selector. |
| 09-26 ~13:00 | Tooling | `LiquidityAmounts` and `CurrencySettler` live under `v4-core/test/utils`, not `src/`. Production locker code has to import test helpers. | Import those two files. | Promote them to `src/libraries` or document that test-utils are the supported integration path. |
| 09-26 ~13:10 | Tooling | `PoolManager.sol` is `pragma solidity 0.8.26` (exact). The repo was on 0.8.24. | Bump `foundry.toml` to 0.8.26. Existing `^0.8.24` sources still compile. | A one-line “solc must be exactly 0.8.26 to compile v4.0.0” on the install page would have saved a failed first build. |
| | | | | |

## Docs / tooling gaps

- Hook permission flags and CREATE2: [Hooks Overview](https://developers.uniswap.org/docs/protocols/v4/guides/hooks/getting-started) shows `deployCodeTo` in the template tests. That hides the CREATE2 path a real deploy needs.
- `v4-core` v4.0.0: `LiquidityAmounts.sol` and `CurrencySettler.sol` are only under `test/utils/`.
- `PoolManager` constructor is just `constructor(address initialOwner)`. Local deploy is straightforward; the docs lean on periphery artifacts that this repo did not need.

## What worked well

- Local `new PoolManager(owner)` plus `PoolDonateTest` / `StateLibrary` is enough to exercise initialize, full-range liquidity, donate and collect without a fork.
- `TickMath.minUsableTick` / `maxUsableTick` for spacing 200 give `-887200` / `887200` with no extra rounding helper.
- `Hooks.validateHookPermissions` in the constructor catches a wrong address immediately.

## Test status

```text
cd contracts && forge build && forge test
# result: 50 passed; 0 failed; 0 skipped
```

SPEC asks for three fuzz tests once the curve and pool exist: solvency; a fee-inclusive round trip never gains; graduation price vs pool start price gap under 0.0068%. Record pass/fail here only after those tests run.

- Solvency: pass (`testFuzz_solvency`)
- Round trip never gains: pass (`testFuzz_roundTripNeverGains`)
- Graduation vs pool start price: pass (`testFuzz_priceGapUnderLimit`, gap < 68 ppm)

## 09-26 entry — hook development experience

The hard part was not the hook body (`beforeInitialize` is a two-check function). It was the address and the caller:

1. The hook address *is* the ABI. If the low 14 bits are wrong, V4 never calls the function you wrote. Constructor validation is good; discovering it only after a failed `initialize` would be worse.
2. `sender` is the initializer, not the hook and not `tx.origin`. That forces initialize to stay in the Launchpad, and the locker to be a later step.
3. Fee collection through `modifyLiquidity(liquidityDelta = 0)` works. Donated amounts are not paid out 1:1 because of fee-growth rounding (a couple of wei). The 24:76 split has to be tested on the collected amounts, not the donated ones.

We did not need `v4-periphery` or a PositionManager NFT for a locker that is itself the position owner. That kept the local test graph small.
