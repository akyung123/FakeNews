# Uniswap Foundation — developer feedback (Prophit)

What we hit while building Prophit on Uniswap CCA, LBPStrategy and v4 on Sepolia. Each finding cites the official source we checked it against.

Sources: [`docs/INTERFACE_CCA.md`](docs/INTERFACE_CCA.md) (official pins in section 0), [`docs/DECISIONS.md`](docs/DECISIONS.md) #1, #18–#22, [PR #38 `CCA_RESEARCH.md`](https://github.com/prism-toggle-ai/Prophit/blob/a45aecb37f7e1fdc64bed17b1391bb2f603a8ea3/docs/CCA_RESEARCH.md) (`a45aecb`). Official code read at continuous-clearing-auction `v2.1.0` (`a56d422`) and liquidity-launcher `1c59049`.

## Project context

Prophit is a Sepolia launchpad that turns one sentence into a token. The address book is the core feature (`alice.prophecy.eth` → wallet, `badges-2028.alice.prophecy.eth` → token). There is no oracle and no True / False; the only on-screen stage is the market stage (auction, graduated or ended), read from the chain. We never describe the price as recording truth (DECISIONS #1).

Half of each token's supply sells through a Uniswap Continuous Clearing Auction (CCA), created by the official LBPStrategy v3.3.0. After the auction, anyone calls `migrate`, which opens a v4 pool through our `ProphecyHook`; our `LiquidityLocker` holds the position with no withdraw and splits fees 24 : 76. The first version used a bonding curve; we replaced it with CCA during the event.

## What we built on CCA + LBPStrategy + v4

**Deployment:** [`deployments/sepolia.json`](deployments/sepolia.json) — Launchpad `0x0b4BF5C6f73A1204CCe07f2522db9142d2BcB4Aa`, block 11785558, source commit `58514dd`. Read back on 2026-09-26: `hook()`, `locker()`, `lbpStrategy()`, `positionManager()`, `poolManager()` and `ens()` match that file. `auctionBlocks()` is **10** (`AuctionBlocksSet` in tx `0x3182ad0d…7880c`, block 11785569). Live transactions on this Launchpad are listed in the README's On-chain proof table.

| Piece | Decision / official path | Built and checked |
|---|---|---|
| Launchpad → LBPStrategy | `initializeDistribution(token, totalSupply, configData, salt)` on Sepolia `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000`. The strategy pulls tokens, has the factory create the CCA, and calls `onTokensReceived` | Deployed. Live `lbpStrategy()` is that address. Fork `test_launchpadHookLockerMigrateRegisterCollect` launches through it |
| CCA factory v2.1.0 | Official `0x000000001F26a0044BaA66024e7b6599c61963F8` (`7d7602d`). We do not deploy a factory | Pinned in `SepoliaConfig` and `deployments/sepolia.json`. Fork setup asserts `initializerFactory()` is this address |
| Auction | ETH currency. Default `auctionBlocks` is 25 (deployer-only `setAuctionBlocks`). Graduation line is 0.02 ETH for the 500M auction half (`CcaLib.AUCTION_SUPPLY`). A bid is a budget plus a max price | Fork demos (10 and 25 blocks) graduate and `claimTokens`. Live Launchpad is set to 10 blocks |
| `migrate` | Anyone calls `LBPStrategy.migrate(initializer)` after `migrationBlock`. Opens an ETH/token pool, fee `10000`, tickSpacing `200` | Fork: `migrate` opens a pool (`sqrtPriceX96 > 0`) and the PositionManager NFT is owned by our locker |
| `ProphecyHook` | ERC165 `IInitializerHook`, `authorized()` = LBPStrategy, `beforeInitialize` only. Constructor `(poolManager, authorized)`. Reference hook on Sepolia: `0x1600059B95A80d500fC42400ea9a88A9C29D2000` | Deployed `0x5f7Ba2Fa7e57873D9E57575e2Fc30F71897ea000`. Live `authorized()` is LBPStrategy. We implement the interface; we do not inherit the official hook contract |
| `LiquidityLocker` | Holds the PositionManager NFT. The official `_mint` does not call `onERC721Received`, so the locker also has `register(token, tokenId)`. `collect` splits 24 : 76. No principal out | Deployed `0x3c2642CDDB4CEE7fC65568240fD5c1C98Be70ff6`. Fork registers the mint `Transfer` id and `collect` matches `Graduation.splitFees` (24 : 76) |
| Recipients | `fundsRecipient` = LBPStrategy (else `InvalidFundsRecipient`). `recipient` and `tokensRecipient` = protocol — never the prophet, and `tokensRecipient` never the strategy | Encoded in `CcaLib`. `test_recipientsAreNeverProphet` passes |

Sepolia-fork outcome (CI run [36235288329](https://github.com/prism-toggle-ai/Prophit/actions/runs/36235288329), merged as `c0a8cc4`): **95 tests passed, 0 failed, 0 skipped**. That includes `CcaSepoliaForkTest` (11) and `CcaLaunchpadForkTest.test_launchpadHookLockerMigrateRegisterCollect` (launch, bid, `exitBid`, `claimTokens`, `migrate`, `register`, Universal Router buy, `collect`).

Live deploy gas, receipts in block 11785558: ProphecyEns CREATE 1,357,055; Launchpad CREATE 2,702,158; Hook CREATE2 279,022; Locker CREATE 1,135,409; `setUniswap` 91,115; `setCca` 85,506. `setAuctionBlocks(10)` used 28,040.

## What worked

- Official Sepolia LBPStrategy `initializerFactory()` is the v2.1.0 CCA factory; `poolManager()` / `positionManager()` match the v4 Sepolia table. Read on-chain in PR #38.
- `initializeDistribution`, `migrate`, `AuctionParameters` and `MigratorParameters` are documented and present at liquidity-launcher `1c59049`. The factory entry point is `create` since v2; the strategy still exposes `initializeDistribution`, so the Launchpad calls the strategy.
- `MigratorParams.validateHook` runs inside `initializeDistribution` (LBPStrategy L134), so a bad hook reverts at launch, not later in `migrate`.
- CCALens `state(auction)` is the intended off-chain read (`eth_call`; it checkpoints through a revert payload). `getInitializedTickData` is `view`.
- A local `new PoolManager(owner)` plus `StateLibrary` was enough to unit-test initialize, full-range liquidity, donate and collect without a fork. `Hooks.validateHookPermissions` in the hook constructor catches a wrong hook address immediately.
- `TickMath.minUsableTick` / `maxUsableTick` for spacing 200 give `-887200` / `887200`.
- On a Sepolia fork, one bid of 0.021 ETH at 2× floor fills the 500M auction half without a separate `checkpoint` (`exitBid` finalizes). `maxPrice == clearingPrice` reverts `CannotExitBid`. Floor graduation leaves 171 wei for the protocol.
- After `migrate`, Universal Router 2.1.2 (`0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`) buys and sells on the new pool with `V4_SWAP` (`0x10`) (`test_urSwapBuyAndSellAfterMigrate`: 0.001 ETH bought 23582658408766078402769254 token wei; the sell returned 502007047322968 wei).

## Friction

| When | Area | Issue | Workaround | Suggestion |
|---|---|---|---|---|
| 09-26 (Sepolia fork, PR #74) | CCA bid hint | TechnicalDocumentation (L244) says the `prevTickPrice` hint "must be the price of the tick immediately preceding it". We read that as the grid tick below `maxPrice` (`floor + (n-1) × tickSpacing`) and sent it. That tick is not in the linked list until some bid opens it, so `_initializeTickIfNeeded` reverts `TickPreviousPriceInvalid` (`TickStorage.sol` L64). Every first bid at our UI's default max price failed | Send the floor. It is always initialized, and the contract walks forward from any initialized tick below the target (L69–L72) | Say "any initialized tick below the target price; the floor always works" and name `TickPreviousPriceInvalid` next to the hint |
| 09-26 (research, PR #38) | LBP hook | `validateHook` requires ERC165 `IInitializerHook`, `authorized() == address(this)` (the strategy), a valid hook address for the fee, and `BEFORE_INITIALIZE`. Our first hook authorized the Launchpad and had no ERC165 | Implement `IInitializerHook`; set `authorized` to LBPStrategy `0x9543…2000` | Put "a custom hook must implement InitializerHook and set `authorized` to *this* LBPStrategy" next to the deployments table |
| 09-26 (research) | LBP hook | The official Sepolia `InitializerHook` `0x1600…2000` has `authorized() == LBPStrategy`. Using that address as `poolParameters.hook` initializes **that** hook, not ours | Deploy our own CREATE2 hook with the same interface | Show a "bring your own InitializerHook" snippet with the constructor `(PoolManager, authorized)` |
| 09-26 (research) | Locker | `migrate` mints through `PositionManager.modifyLiquidities` and transfers each NFT to `positionRecipient`. A locker built on PoolManager `modifyLiquidity` never holds the position | Rewrite the locker as the NFT holder; collect through PositionManager | Document that `positionRecipient` receiving the NFT is the only supported lock |
| 09-26 (fork, PR #42 / #47) | Locker | The official PositionManager `_mint` does not call `onERC721Received`, so a receiver-only locker never learns the LP `tokenId` | Permissionless `register(token, tokenId)` after the mint `Transfer(0 → locker)`. The fork test collects 24 : 76 on that id | Say in the migrate guide that the NFT arrives without an ERC-721 callback, so callers read the mint `tokenId` themselves |
| 09-26 (research) | Recipients | `fundsRecipient` **must** be the strategy (`InvalidFundsRecipient`). `tokensRecipient` **must not** be the strategy (`InvalidTokensRecipient`). `recipient` takes unused currency and recover-on-fail | Funds to the strategy; the other two to the protocol; never the prophet | `recipient`, `tokensRecipient` and `fundsRecipient` are easy to swap. A one-line matrix in the LBP deploy guide would have saved a revert |
| 09-26 (research) | Factory name | CCA `docs/DeploymentGuide.md` at `v2.1.0` (L17, L28) shows `initializeDistribution` on the factory. `ContinuousClearingAuctionFactory.sol` L25 is `create` | Call the strategy, not the factory, from the Launchpad | Update the DeploymentGuide snippet to `create` |
| 09-26 (research, page read that day) | Docs vs source | The [Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments) page said the factory "has no constructor parameters". Since v2.0.0 it takes `_protocolFeeController` (`ContinuousClearingAuctionFactory.sol` L20–L22) | The official Sepolia factory has fees off | Align the deployments page with the constructor |
| 09-26 (research) | README vs tag | The CCA README at tag `v2.1.0` (L36–L42) has no v2.1.0 row and says "v2.0.0 is the latest version". The deployments page lists factory v2.1.0 at `0x000000001F26…63F8` (`7d7602d`) | Use the deployments page for addresses | Add the v2.1.0 row in the same commit as the tag |
| 09-26 (research) | Gas | We missed the official gas snapshots at first: CCA `snapshots/AuctionTest.json` at `v2.1.0` (`submitBid` 154,441; `submitBidWithoutPrevTickPrice_initializeTick_search` 202,324; `exitBid` 84,337; `claimTokens` 67,247; `checkpoint_advanceToCurrentStep` 180,623) and liquidity-launcher `snapshots/LBPStrategy_E2E_Test.json` at `1c59049` (`LBP migrate: standard parameters with native currency` 816,586). The CCA `CONTRIBUTING.md` (L138) tells contributors to keep snapshots, but no README or docs page for integrators points to these files. `InitializeDistributionTest.json` covers `InstantLaunchStrategy`, not LBPStrategy | Read the JSON files directly | Link the snapshot files from the integrator docs; add an `LBPStrategy.initializeDistribution` entry |
| 09-26 ~12:30 | Hook address | Permission bits live in the hook address. A normal `CREATE` address fails `validateHookPermissions` in the constructor | In-repo `HookMiner` (CREATE2, 14-bit mask) | Put "mine the salt before the first real deploy" above the `deployCodeTo` example |
| 09-26 ~12:45 | Hook sender | `beforeInitialize` sees the `initialize` caller as `sender`. A helper that initializes on behalf of another contract is rejected | Initialize from the authorized caller (now LBPStrategy) | Call this out next to the hook `sender` docs |
| 09-26 ~13:00 | Tooling | `LiquidityAmounts` and `CurrencySettler` live under `v4-core/test/utils`, not `src/` | Import those two files | Promote them to `src/libraries` or document test-utils as supported |
| 09-26 ~13:10 | Tooling | `PoolManager.sol` is `pragma solidity 0.8.26` (exact). Our repo was on 0.8.24 | Bump `foundry.toml` to 0.8.26 | One line on the install page: solc must be exactly 0.8.26 for v4.0.0 |

## Docs / tooling gaps

- Hook permission flags and CREATE2: [Hooks getting started](https://developers.uniswap.org/docs/protocols/v4/guides/hooks/getting-started) (read on 09-26) shows `deployCodeTo` in the template tests, which hides the CREATE2 path a real deploy needs.
- The LBP custom-hook rules (`InitializerHook`, `authorized() == LBPStrategy`) are enforced in `MigratorParams.validateHook` but easy to miss if you start from the CCA factory alone.
- The `prevTickPrice` hint wording (see Friction).
- Universal Router 2.1.2: tag `v2.1.2` was not fetchable as a git ref from our environment. We took the Sepolia address from the [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments) page and confirmed `V4_SWAP` (`0x10`) with a buy and a sell on the fork.
- Gas snapshots exist, but no integrator-facing page links to them (see Friction).

## Suggestions

1. One deployments row per chain with the factory, LBPStrategy, InitializerHook and its `authorized()` target, and PositionManager. We joined three pages and an `eth_call` to learn that the Sepolia hook only accepts that strategy.
2. A "custom hook + locker" cookbook: implement `InitializerHook`, mine CREATE2 flags, set `positionRecipient` to an ERC-721 locker that reads the mint `tokenId`, set `fundsRecipient` to the strategy and `tokensRecipient` / `recipient` to a non-strategy address.
3. Reword the `prevTickPrice` hint docs: any initialized tick below the target works, the floor always does, and a guessed tick reverts `TickPreviousPriceInvalid`.
4. Fix the DeploymentGuide factory snippet (`create`), the factory constructor sentence, and the v2.1.0 README row.
5. Link the existing gas snapshots from the docs, and add `LBPStrategy.initializeDistribution`.
6. Keep `deployCodeTo` in tests, but put CREATE2 salt mining in the first hook guide.

## Note — moving from our own graduation to the official migrate

The hard part of the first hook was the address and the caller, not the hook body. Official LBP makes that stricter: the caller **must** be the strategy, the hook **must** speak ERC165, and the lock **must** hold an NFT. That still fits the product (a locked pool and a 24 : 76 fee split), but it is not a drop-in, so we rewrote the hook and the locker for it.
