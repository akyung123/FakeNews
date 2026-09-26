# Interface (CCA)

Companion to [`INTERFACE.md`](INTERFACE.md). **`INTERFACE.md` stays the bonding-curve contract on `main`.** This file is the contract between `contracts/`, `web/`, `world/`, and `infra/` for the CCA path on branch `cca`. It applies when `cca` work is in progress; it supersedes `INTERFACE.md` only after `cca` merges to `main`.

- **Changing it:** edit this file first, in **the same PR** as the CCA code change, and write "INTERFACE_CCA change" in the PR description.
- **Sources:** [`SPEC.md`](SPEC.md), [`DECISIONS.md`](DECISIONS.md) #1 (unchanged), #18–#22. Official Uniswap sources are pinned in section 0. Research notes (not accepted as INTERFACE): [PR #38 `CCA_RESEARCH.md`](https://github.com/prism-toggle-ai/FakeNews/blob/a45aecb37f7e1fdc64bed17b1391bb2f603a8ea3/docs/CCA_RESEARCH.md).
- **TBD answers (this revision):** [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) head `b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9` — issue comments **INTERFACE_CCA TBD answers** and **Designer Q1-Q4 answers** — plus official pins in section 0. Designer-approved copy v2 is in section 7 (character-for-character).
- `(draft)` means the shape may still change during implementation. Remove the mark once it settles.
- `(removed-on-cca)` is the bonding-curve surface. Do not call it from web on the `cca` branch.
- `TBD(backend)` / `TBD (#42)` is still open on the contracts PR. Do not guess a function, field, event, or error to fill it. Do not invent floor / tick numbers.

## 0. Pinned official sources

Read on 2026-09-26. Every external signature below is copied from these pins. If a name is not in this file, it is not in the official source we read.

| Piece | Pin | What we read |
|---|---|---|
| Continuous Clearing Auction **v2.1.0** (same as web [PR #43](https://github.com/prism-toggle-ai/FakeNews/pull/43) `448f3f8`) | git tag `v2.1.0` = `a56d42231e7bf048136d9d88fa61e8518c10c5ff`. Deployments-page factory commit `7d7602d257733315434570f2a0c2f94f1c7b207a`. **Same tree** `e534d08279d7a7f6bf18ba8150eabf1cc8fa8840` — not a different version | [`IContinuousClearingAuction.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/a56d42231e7bf048136d9d88fa61e8518c10c5ff/src/interfaces/IContinuousClearingAuction.sol), [`ContinuousClearingAuctionFactory.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol). Sepolia factory address from [Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments) |
| CCALens | tag `v2.1.0` (lens source) / deployed **v2.0.0** commit `aee9bca51c92c24eb24a00d75ad98e678bac61d3` | [`CCALens.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/lens/CCALens.sol) = `AuctionStateLens` + `TickDataLens`. Address from the CCA README Deployments table |
| LBPStrategy **v3.3.0** | commit `1c5904912aefceaceb89c24528cd5e25d0b61597` (no `v3.3.0` git tag exists) | [`IStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IStrategy.sol), [`ILBPStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/ILBPStrategy.sol), [`LBPStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol), [`MigratorParams.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol) |
| InitializerHook **v3.3.0** | source at `1c590491…`; Sepolia deploy commit `7ea523c9d75a51cb2f497be5e49bacdaeb80a342` | [`InitializerHook.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/periphery/hooks/InitializerHook.sol), [`IInitializerHook.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IInitializerHook.sol) |
| Uniswap v4 Sepolia | [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments) | PoolManager, PositionManager, Universal Router **2.1.2** `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`, StateView, Quoter, Permit2 |
| Universal Router `execute` | tag `2.1.2` [`IUniversalRouter.sol`](https://github.com/Uniswap/universal-router/blob/2.1.2/contracts/interfaces/IUniversalRouter.sol) L21–L40 + [`Commands.sol`](https://github.com/Uniswap/universal-router/blob/2.1.2/contracts/libraries/Commands.sol) L36 | `execute(commands, inputs, deadline)`; `V4_SWAP = 0x10`. Not Universal Router 2.0 |
| v4-periphery actions / swap params | pin `545a5d2a87228167edde48f3b9eda122d1e3c4d6` | [`Actions.sol`](https://github.com/Uniswap/v4-periphery/blob/545a5d2a87228167edde48f3b9eda122d1e3c4d6/src/libraries/Actions.sol) L28 / L40 / L44 (`SWAP_EXACT_IN_SINGLE = 0x06`, `SETTLE_ALL = 0x0c`, `TAKE_ALL = 0x0f`); collect `DECREASE_LIQUIDITY = 0x01` L11, `TAKE_PAIR = 0x11` L46; [`IV4Router.sol`](https://github.com/Uniswap/v4-periphery/blob/545a5d2a87228167edde48f3b9eda122d1e3c4d6/src/interfaces/IV4Router.sol) L31–L38 six-field `ExactInputSingleParams` |
| PositionManager collect actions | same `545a5d2` `Actions.sol` + [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`LiquidityLocker.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol) L24–L25, L163–L169 | fees-only: `0x01` then `0x11`, liquidity delta `0` |

The CCA README at tag `v2.1.0` still lists v2.0.0 as “latest” in its own table. The official deployments page lists factory **v2.1.0** at `0x000000001F26a0044BaA66024e7b6599c61963F8` / `7d7602d`. Use that address. The git tag SHA (`a56d422`) and the deployments SHA (`7d7602d`) are two commits of the same bump; `IContinuousClearingAuction` ABI is identical.

**Cross-check vs web PR #43** (`web/src/lib/cca/abi/` at `448f3f8`). External signatures that both files list **match**, including `owner` indexed on `BidSubmitted`, `BidExited`, and `TokensClaimed`. Differences that are **not** a CCA version split:

| Item | This file | PR #43 `448f3f8` |
|---|---|---|
| CCA version / factory | v2.1.0 · `0x000000001F26…63F8` · tag `a56d422` / deploy `7d7602d` | same address and v2.1.0; events cited at `a56d422`, factory commit comment `7d7602d` |
| `BidSubmitted` / `BidExited` / `TokensClaimed` | `owner` indexed | `owner` indexed — same |
| Bid function | official **`submitBid` 5-arg** (`maxPriceQ96, amount, owner, prevTickPriceQ96, hookData`) at `a56d422` [`IContinuousClearingAuction.sol` L137–L144](https://github.com/Uniswap/continuous-clearing-auction/blob/a56d42231e7bf048136d9d88fa61e8518c10c5ff/src/interfaces/IContinuousClearingAuction.sol#L137-L144). A 4-arg overload exists (L154–L157) — do **not** use it | `cca.ts` lists both; `placeBid` is **not** an official name and must not be the demo call |
| `submitBid` demo call | 5-arg `submitBid` only | `placeBid` sends the **4-arg** overload — do not copy that call |
| CCALens `state` | not `view`; `eth_call` | same |
| LBPStrategy `migrate` | `1c590491` · `0x9543…2000` | same |
| Universal Router | **2.1.2** `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`; `V4_SWAP = 0x10` ([`Commands.sol` tag `2.1.2` L36](https://github.com/Uniswap/universal-router/blob/2.1.2/contracts/libraries/Commands.sol#L36)); actions `0x06, 0x0c, 0x0f` | **2.0** `0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b` is on the official table but is **not** this product’s router. Do not use 2.0 |

## 0.1 Fixed Sepolia addresses and parameters

Verified on a Sepolia fork at block **11_784_960** in [PR #41](https://github.com/prism-toggle-ai/FakeNews/pull/41) `7139f72` (`contracts/test/fork/CCAFork.t.sol` + `CCAForkHelpers.sol`). Forge green at 25 and 10 blocks. These rows replace the old `TBD(backend)` for the same fields.

| Item | Value | Who uses it | Source |
|---|---|---|---|
| LBPStrategy v3.3.0 | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` | Launchpad `initializeDistribution`; web `migrate` | official + #41 |
| CCA factory v2.1.0 | `0x000000001F26a0044BaA66024e7b6599c61963F8` | LBPStrategy `initializerFactory()` (already wired on chain). Launchpad does **not** call `create` | official + #41 |
| InitializerHook reference | `0x1600059B95A80d500fC42400ea9a88A9C29D2000` | Reference only. `ProphecyHook` **inherits** `InitializerHook`; `authorized()` must be the LBPStrategy above | official + #41 |
| CCALens v2.0.0 | `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | Web `state(auction)` via `eth_call` | official |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Hook, locker, fork tests | official + #41 |
| PositionManager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` | LBPStrategy mints the LP NFT here; locker holds it | official + #41 |
| Universal Router 2.1.2 | `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3` | Web v4 swap after migrate. **Not** Universal Router 2.0 | official v4 Sepolia table + [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers |
| StateView | `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c` | Optional pool reads / pending-fees view (Designer Q4) | official |
| Quoter | `0x61b3f2011a92d183c7dbadbda940a7555ccf9227` | Optional quotes | official |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Unused for ETH bids. **Required** before a token→ETH swap (section 4.7) | official + [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers / Designer Q3 |
| Currency | native ETH (`address(0)`) | `AuctionParameters.currency` and `MigratorParameters.currency` | **#41** |
| `N` (auction blocks) | **25** default (also green at **10**) | `endBlock = startBlock + N` | **#41** |
| Auction windows | `startBlock = block.number`; `endBlock = start + N`; `claimBlock = end`; `migrationBlock = end + 1` | Launchpad `configData` | **#41** `CCAForkHelpers._auctionWindows` |
| `auctionStepsData` | `abi.encodePacked(uint24(1e7 / N), uint40(N))` so `mps * N == 1e7`. N=25 → `(400_000, 25)`; N=10 → `(1_000_000, 10)` | `AuctionParameters.auctionStepsData` | **#41** `packUniformSteps` |
| Floor price (auction Q96) | `1000 << 96` — **pending #42 recalculation** for the 1B product mint (~0.02 ETH at full sale). Do not invent a replacement | `AuctionParameters.floorPrice` | **#41** (`CCA_FLOOR_PRICE`); still `CcaLib.FLOOR_PRICE_Q96` at [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`CcaLib.sol` L27](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/cca/CcaLib.sol#L27) |
| Auction price tick | `100 << 96` — **pending #42 recalculation** (paired with floor). Do not invent a replacement | `AuctionParameters.tickSpacing` — **not** the v4 pool tick | **#41** (`CCA_TICK_SPACING`); still `CcaLib.AUCTION_TICK_SPACING_Q96` at [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`CcaLib.sol` L28](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/cca/CcaLib.sol#L28) |
| Graduation threshold | **0.02 ETH** (`20000000000000000` wei) | `AuctionParameters.requiredCurrencyRaised` | **#41** |
| Pool fee | **1% = `10000` pips** | `PoolParameters.fee` | **#41** |
| Pool tickSpacing | **200** | `PoolParameters.tickSpacing` | **#41** |
| First bid id | **0** | `submitBid` return / `BidSubmitted.id` | official CCA [`BidStorage.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/a56d42231e7bf048136d9d88fa61e8518c10c5ff/src/BidStorage.sol) L10 (`uint256 private $_nextBidId` defaults to 0), L47–L49 (`bidId = $_nextBidId; $_nextBidId++`). **Not** asserted in #41 |
| `fundsRecipient` | **LBPStrategy** (`0x9543…2000`) | official `InvalidFundsRecipient` if anything else | **#41** |
| `tokensRecipient` | **protocol** (`protocolFeeRecipient`) — **never the prophet**, never LBPStrategy | unsold auction tokens via `sweepUnsoldTokens` | **#41** |
| `recipient` | **protocol** (`protocolFeeRecipient`) — **never the prophet** | unused currency / recover-on-fail | **#41** |
| Goal not reached (`raised < 0.02 ETH`) | `exitBid` refunds **full ETH**, **0 tokens**; `claimTokens` reverts `NotGraduated`; **no v4 pool** | UI **Get your ETH back ({amount} ETH)** | **#41** `7139f72` [`test_goalNotReached_refundAndTokenSink`](https://github.com/prism-toggle-ai/FakeNews/blob/7139f721e7540dc0d5a733d08fdde953cbe0354b/contracts/test/fork/CCAFork.t.sol#L75): L93–L94 `vm.expectRevert(NotGraduated.selector)` then `claimTokens`; L121–L122 `getSlot0` `sqrtPriceX96 == 0` |
| LP NFT holder | `LiquidityLocker` | `MigratorParameters.positionRecipient` (product). #41 used a temp address — harness only | product |
| Fee split after the pool | prophet **24** : protocol **76** | locker `collect` | product |
| Deadline vs auction | **not linked** | ENS `deadline` / Departed stay as today. Auction blocks do not read the deadline | DECISIONS #21 |
| World ID / ENS | **unchanged** | section 1 and section 3 | DECISIONS #5 / #10 |

Do not describe the auction or the pool in terms of returns, profit, or prediction. Do not use “coin”. Do not show a percent price change.

## 1. Names (ENS)

Unchanged from `main`. The parent is written as `prophecy.eth`. The real one comes from `VITE_PARENT_NAME` (see DECISIONS "Not decided yet").

| Name | Address record (coinType 60) | Text records | Who can write |
|---|---|---|---|
| `<prophet>.prophecy.eth` | prophet wallet | `avatar`, `description` | prophet only (per-key role) |
| `<slug>.<prophet>.prophecy.eth` | prophecy token | `prophecy` = sentence (1–140 UTF-8 bytes; `BadProphecy`) | **nobody** (written at init only) |
| | | `deadline` = unix seconds, decimal string | **nobody** |
| | | `avatar`, `description` | prophet only |

- **Label rules** `(draft)`
  - Prophet: 3–16 chars, `[a-z0-9]`
  - Prophecy: 3–32 chars, `[a-z0-9-]`, no leading or trailing hyphen
- **Expiry:** `type(uint64).max` for every name, so names never expire (DECISIONS #14).
- **Transfer:** not allowed. The owner's role bitmap is 0.
- **Departed:** `now >= deadline`. Computed by the UI; there is no on-chain status. Independent of auction blocks (DECISIONS #21).

## 2. Contracts

### `Launchpad` `(draft)`

Constructor stays `(protocolFeeRecipient, worldSigner, ens)`. No new constructor arguments.

Surface from [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) head `b71c64e` [`Launchpad.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol). Constructor stays `(protocolFeeRecipient, worldSigner, ens)`. No new constructor arguments.

```solidity
constructor(address protocolFeeRecipient, address worldSigner, address ens);

// Deployer-only, once. After Launchpad, Hook (CREATE2), and Locker exist.
function setUniswap(address poolManager, address hook, address locker) external;

// Deployer-only, once. Official Sepolia LBPStrategy + PositionManager.
// Name is setCca (not setLbp). Reverts InvalidHook unless hook.authorized() == lbpStrategy.
function setCca(address lbpStrategy, address positionManager) external; // L111–L121

// Deployer-only. Default 25. N must divide 1e7.
function setAuctionBlocks(uint64 auctionBlocks) external; // L123–L129

// Unchanged. Create a prophet name. Needs a World ID server signature. Once per nullifier.
function registerProphet(string label, uint256 nullifier, bytes serverSig) external;

// Issue a prophecy. Caller must own a prophet name.
// Mints ProphecyToken (1_000_000_000e18) to the Launchpad, writes ENS (sentence + deadline
// only on the prophecy resolver), prepares the locker, approves LBPStrategy for `totalSupply`,
// then calls LBPStrategy.initializeDistribution(token, totalSupply, configData, salt).
// Not payable. There is no first buy. Returns the token only — read auction from Launched or auctionOf.
function launch(string slug, string prophecy, uint64 deadline)
    external
    returns (address token); // L157–L160

// views
function auctionOf(address token) external view returns (address); // L205–L207 — no poolOpened flag
function isGraduated(address token) external view returns (bool);  // forwards auction.isGraduated(); false if no auction
function prophetOf(address wallet) external view returns (string label);
function protocolFeeRecipient() external view returns (address);
function worldSigner() external view returns (address);
function ens() external view returns (address);
function deployer() external view returns (address);
function poolManager() external view returns (address);
function hook() external view returns (address);
function locker() external view returns (address);
function lbpStrategy() external view returns (address);
function positionManager() external view returns (address);
function auctionBlocks() external view returns (uint64);
```

`initializeDistribution` **returns nothing** ([`IStrategy.sol` L29–L33](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IStrategy.sol#L29-L33)). Launchpad obtains `auction` from the official factory predict in the same transaction ([`Launchpad.sol` L195–L199](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L195-L199)):

```solidity
// Launchpad.sol L191 — frontend does NOT pass a salt
bytes32 salt = keccak256(abi.encode(token, msg.sender, slug));

// LBPStrategy.sol L91–L94
bytes32 initializerSalt = keccak256(abi.encode(salt, migrationParams));
initializerFactory.create(token, auctionSupply, initializerParams, initializerSalt);

// factory
function getAddress(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
    external view returns (IDistributor distributor);
// CREATE2 salt inside the factory is keccak256(abi.encode(sender, salt))
// with sender = LBPStrategy
```

**Salt rule** ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers + [`Launchpad.sol` L191](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L191)): the frontend **must not** pass a salt on `launch`, bid, claim, migrate, or swap.

| Artifact | How | Formula | Frontend |
|---|---|---|---|
| ProphecyToken | `CREATE` (not CREATE2) | `new ProphecyToken(...)` from Launchpad ([`Launchpad.sol` L176](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L176)) | no salt |
| LBP `initializeDistribution` salt | Launchpad | `salt = keccak256(abi.encode(token, msg.sender, slug))` | no salt |
| Factory `create` / `getAddress` salt | official LBP | `initializerSalt = keccak256(abi.encode(salt, migrationParams))`; factory sender = LBPStrategy | no salt |
| ProphecyHook | CREATE2, mined | `HookMiner`: `salt = bytes32(i)` until the address has `BEFORE_INITIALIZE`. Ctor `(poolManager, authorized=LBPStrategy)` | no salt (deploy only) |

There is **no** Launchpad `openMarket` wrapper. Web calls `LBPStrategy.migrate(auction)` directly ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers). Detect the open pool from `Migrated` or `PoolManager.getSlot0` — `auctionOf` does not return `poolOpened`.

```solidity
event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
event Launched(
    address indexed token,
    address indexed prophet,
    address indexed auction,
    string prophetLabel,
    string slug
); // Launchpad.sol L50–L52
event UniswapSet(address poolManager, address hook, address locker);
event CcaSet(address lbpStrategy, address positionManager); // L54
event AuctionBlocksSet(uint64 auctionBlocks);               // L55
```

- `Launched` still does **not** contain the sentence or the deadline (DECISIONS #5).
- `registerProphet` recovers EIP-191 `personal_sign` of `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))` (section 3). `chainId` must be `block.chainid` and `launchpad` must be this contract; the signed wallet must be `msg.sender`. Label is chosen by the caller and is not in the signed payload. Check order ([`Launchpad.sol` L142–L145](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L142-L145)): `NullifierUsed`, `AlreadyProphet`, `LabelTaken`, `InvalidSignature`.
- Deploy order: Launchpad, Hook (CREATE2; `authorized` = LBPStrategy), Locker (`constructor(poolManager, launchpad, hook)`), `setUniswap(poolManager, hook, locker)`, `setCca(lbpStrategy, positionManager)`. A second call or a non-deployer call reverts. `launch` reverts `CcaNotSet` if Uniswap or CCA is not set ([`Launchpad.sol` L162–L164](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L162-L164)).
- `receive()` leftover ETH only from the locker and the PoolManager ([`Launchpad.sol` L131–L133](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L131-L133)). It does **not** accept ETH from LBPStrategy (official LBP does not pay Launchpad; `recipient` is protocol).
- Sentence length: 1–140 UTF-8 bytes (`BadProphecy`).

#### `launch` encodes these official structs

`configData` for `initializeDistribution` is `abi.encode(MigratorParameters, bytes initializerParams)` ([`LBPStrategy.sol` L74–L75](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L74-L75)). `initializerParams` is `abi.encode(AuctionParameters)` (factory `abi.decode(configData, (AuctionParameters))`).

```solidity
// IContinuousClearingAuction.sol — AuctionParameters
struct AuctionParameters {
    address currency;                 // address(0) = ETH
    address tokensRecipient;          // protocol — NEVER prophet, NEVER LBPStrategy (#41)
    address fundsRecipient;           // MUST be LBPStrategy
    uint64 startBlock;                // block.number (#41)
    uint64 endBlock;                  // startBlock + N (#41)
    uint64 claimBlock;                // = endBlock (#41)
    uint256 tickSpacing;              // 100 << 96 — NOT pool tickSpacing 200 (#41). pending #42 recalculation
    address validationHook;           // address(0) = none
    uint256 floorPrice;               // 1000 << 96 (#41). pending #42 recalculation for 1B supply (~0.02 ETH at full sale)
    uint128 requiredCurrencyRaised;   // 0.02 ether
    bytes auctionStepsData;           // abi.encodePacked(uint24(1e7/N), uint40(N)) (#41)
}

// MigratorParams.sol — MigratorParameters
struct MigratorParameters {
    address token;
    address currency;                 // address(0)
    uint64 migrationBlock;            // endBlock + 1 (#41)
    uint128 reservedTokenAmountForLP; // pulled to the strategy; rest is auction supply
    address recipient;                // protocol — NEVER prophet (#41)
    address positionRecipient;        // LiquidityLocker
    PoolParameters poolParameters;
    bytes positionDefinitions;        // abi.encode(PositionDefinition[])
    bytes lpAllocationSchedule;       // abi.encode(LiquidityAllocationBracket[])
}

struct PoolParameters {
    uint24 fee;                       // 10000
    int24 tickSpacing;                // 200
    address hook;                     // ProphecyHook (inherits InitializerHook)
}

struct PositionDefinition {
    int24 offsetLower;                // sentinel MIN_TICK + MAX_TICK = full range
    int24 offsetUpper;
    uint24 weight;                    // mps, 1e7 = 100%
    address overridePositionRecipient; // address(0) → positionRecipient (locker)
}

struct LiquidityAllocationBracket {
    uint128 lowerThreshold;           // first bracket MUST be 0
    uint24 rate;                      // mps, 1e7 = 100%
}
```

Strategy pull ([`LBPStrategy.sol` L67–L116](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L67-L116)): Launchpad must `approve` the strategy for `totalSupply` first. Strategy `safeTransferFrom`s `auctionSupply = totalSupply - reservedTokenAmountForLP` to the auction and `reservedTokenAmountForLP` to itself, then calls `onTokensReceived()`. Launchpad does **not** call `onTokensReceived` itself on this path.

Official errors the prophet can see on `launch` (bubble from LBP / factory / CCA constructor):

`ZeroAddressToken`, `InitializerAlreadyCreated`, `HookIsStrategy`, `InvalidReservedTokenAmountForLP`, `TokenMismatch`, `CurrencyMismatch`, `TokenAmountMismatch`, `PoolIdOccupied`, `InvalidFundsRecipient`, `InvalidTokensRecipient`, `InvalidEndBlock`, `InvalidRecipient`, `InvalidPositionRecipient`, `InvalidTickSpacing`, `InvalidFee`, `InvalidHook`, `InvalidTokenAmount`, `InvalidTokenAmountReceived` (CCA name) / `InvalidAmountReceived` (IDistributor name), plus CCA constructor names in section 8.

#### What stays

- `registerProphet`, World ID signature, one nullifier, prophet ENS name (section 3).
- ENS adapter: prophecy sentence and deadline live only on the prophecy resolver (DECISIONS #5).
- Constructor `(protocolFeeRecipient, worldSigner, ens)`.
- `setUniswap` + CREATE2 hook address flags.
- `LiquidityLocker.collect` / `withdrawAccrued` after the pool exists. Prophet 24 : protocol 76.
- Label / slug / prophecy length rules. Names never expire.

#### What is removed-on-cca

Bonding-curve trading. Do not keep these on Launchpad:

```solidity
function launch(..., uint256 minTokensOut) external payable returns (address token); // old
function buy(address token, uint256 minTokensOut, string memo) external payable;
function sell(address token, uint256 tokensIn, uint256 minEthOut, string memo) external;
function claimCreatorFee() external;
function curve(address token) external view returns (
    uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete);
function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee);
function quoteSell(address token, uint256 tokensIn) external view returns (uint256 ethOut, uint256 fee);
function creatorFeeOf(address wallet) external view returns (uint256);
function ccaFactory() external view returns (address); // Path A proposal only; B2 talks to LBPStrategy

event Trade(address indexed token, address indexed trader, bool isBuy,
            uint256 ethAmount, uint256 tokenAmount, uint256 fee, uint256 vEthAfter, uint256 vTokenAfter, string memo);
event CreatorFeeClaimed(address indexed prophet, uint256 amount);
event Graduated(address indexed token, bytes32 indexed poolId, uint256 ethToPool, uint256 tokensToPool,
                uint160 sqrtPriceX96, uint24 fee, int24 tickSpacing, address hooks); // last-buy graduate
event CcaFactorySet(address factory); // Path A proposal only
```

`(removed-on-cca)` Launchpad revert names the UI must stop mapping: `CurveComplete`, `Slippage`, `MemoTooLong`, `ExceedsSold`, `ZeroAmount` (`claimCreatorFee`).

Write-facing names that **still** apply, from [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`Launchpad.sol` L57–L80](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L57-L80): `NullifierUsed`, `LabelTaken`, `AlreadyProphet`, `SlugTaken`, `InvalidSignature`, `NotProphet`, `BadSlug`, `BadProphecy`, `BadLabel`, `ZeroAddress`, `NotDeployer`, `UniswapAlreadySet`, `UniswapNotSet`, `CcaNotSet`, `CcaAlreadySet`, `BadAuctionBlocks`, `AuctionExists`, `ProphetRecipient`, `AuctionNotCreated`, `InvalidHook`, `TokenTransferFailed`, `UnexpectedEth`, `EthTransferFailed`, `Reentrant`. There is no `UnknownToken`.

`registerProphet` check order stays: `NullifierUsed`, `AlreadyProphet`, `LabelTaken`, `InvalidSignature`.

Former TBD names are now written: “LBP not set” is `CcaNotSet`; “auction already exists” is `AuctionExists`. Full list in section 7.13.

### `ProphecyToken`

Unchanged.

- ERC-20, 18 decimals, 1,000,000,000 total. All minted to the Launchpad.
- `name` is the full prophecy name (`lingo-2028.ringo.prophecy.eth`).
- `symbol` is the slug in upper case, truncated to 11 chars `(draft)`.
- Plain ERC-20 (no fee-on-transfer). Auction `amount` must be `<= type(uint128).max` (1e27 is inside).

### `ProphecyHook`

Must inherit official `InitializerHook` so LBPStrategy `validateHook` passes ([`MigratorParams.validateHook`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol#L143-L158)).

```solidity
// InitializerHook.sol — public surface ProphecyHook keeps
constructor(IPoolManager _poolManager, address _authorized) BaseHook(_poolManager);
address public immutable authorized;
function getHookPermissions() public pure virtual returns (Hooks.Permissions memory);
function supportsInterface(bytes4 interfaceId) public pure virtual returns (bool);
error InvalidInitializer(address caller, address expected);
```

- `_authorized` **must** be LBPStrategy `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000`. The official Sepolia InitializerHook’s `authorized()` is that strategy. Today’s “only Launchpad may initialize” does **not** work on B2: `migrate` initializes as the strategy.
- ERC165 must report `IInitializerHook` (`authorized()`).
- Permission bits must include `BEFORE_INITIALIZE`. Deploy with a mined CREATE2 salt.
- Official `getHookPermissions` is `beforeInitialize` only. [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`ProphecyHook.sol` L31–L47](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/ProphecyHook.sol#L31-L47) matches: `beforeSwap` / `afterSwap` are false. Extra flags are out of the 02:00 fork gate.
- Do not point `PoolParameters.hook` at the official reference hook `0x1600…2000` if we want `ProphecyHook` in the `PoolKey`. That reference address is the inherit-from sample, not our pool hook.

### `LiquidityLocker`

LBPStrategy mints a PositionManager ERC-721 and transfers it to `positionRecipient` ([`LBPStrategy.sol` L346–L363](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L346-L363)). The locker **is** that recipient.

Surface from [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) head `b71c64e` [`LiquidityLocker.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol). Official PositionManager `_mint` is callback-less, so `onERC721Received` does not run on Sepolia. Anyone may bind the NFT after `prepare` via `register`.

```solidity
constructor(IPoolManager poolManager, address launchpad, IHooks hook); // L85–L92

function prepare(address token, address prophet, address protocolFeeRecipient) external; // Launchpad-only; L107–L116
function register(address token, uint256 tokenId) external; // permissionless; L120–L123
function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
    external returns (bytes4); // L125–L130; still kept if a callback mint happens

function collect(address token) external;          // L155–L182
function withdrawAccrued() external;               // L184–L192

function tokenIdOf(address token) external view returns (uint256); // L194–L197; reverts UnknownLock if NFT not registered
function prophetOf(address token) external view returns (address); // L200–L203; reverts UnknownLock if not prepared
function positions(address token) external view returns (Position);
function accruedEth(address prophet) external view returns (uint256);

event Prepared(address indexed token, address indexed prophet, address indexed protocolFeeRecipient);
event Registered(address indexed token, uint256 indexed tokenId); // L49, L150
event PositionReceived(address indexed token, uint256 indexed tokenId); // also emitted from _register
event Collected(address indexed token, uint256 prophetAmount0, uint256 protocolAmount0, uint256 prophetAmount1, uint256 protocolAmount1);
event ProphetAccrued(address indexed prophet, uint256 amount);
event ProphetWithdrawn(address indexed prophet, uint256 amount);
event PositionManagerSet(address positionManager);

error NotLaunchpad();
error NotPositionManager();
error ZeroAddress();
error AlreadyPrepared();
error AlreadyReceived();
error UnknownLock();
error PositionManagerAlreadySet();
error PositionManagerNotSet();
error BadPoolKey();
error EthTransferFailed();
error TokenTransferFailed();
error Reentrant();
error NothingAccrued();
error UnexpectedEth();
error NotNftOwner(); // L76, L134
```

There is **no** `prophetOf(uint256 tokenId)` and **no** standalone `protocolFeeRecipient()` view. Key is the ERC-20. Recipients live on `positions[token]`.

**How the locker learns the mapping** ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers + [`LiquidityLocker.sol` L106–L151](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol#L106-L151)):

1. `Launchpad.launch` → `locker.prepare(token, prophet, protocolFeeRecipient)` (Launchpad-only). Recipients are fixed here.
2. After a successful `LBPStrategy.migrate`, PositionManager mints the LP NFT to the locker **without** `onERC721Received`.
3. Anyone calls `register(token, tokenId)`. Shared `_register` also serves `onERC721Received` if a callback mint happens.
4. Checks: `ownerOf(tokenId) == locker`; poolKey `currency0 == ETH`, `currency1 == token`, `hooks == ProphecyHook`, `fee == 10000`, `tickSpacing == 200`; token prepared; not yet received. Else `NotNftOwner` / `BadPoolKey` / `UnknownLock` / `AlreadyReceived`.

Event and error names for `register` **are** in #42 (`Registered`, `NotNftOwner`). Do not mark them TBD.

- `collect(address token)` can be called by anyone. Collected fees go **only** to prophet 24 : protocol 76 ([`Graduation.sol` L17–L18, L62–L64](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/Graduation.sol#L62-L64): `prophetShare = amount * 24 / 100`, remainder including dust to protocol).
- No withdraw of principal. The locker must not `transferFrom` the NFT out, and must not decrease liquidity.
- If sending ETH to the prophet fails, `collect` still pays the protocol and accrues the prophet share. The prophet later calls `withdrawAccrued()`.
- `withdrawAccrued()` sends only accrued ETH, never pool principal.
- Collect path is PositionManager `modifyLiquidities(bytes unlockData, uint256 deadline)`. Fees-only action bytes ([`LiquidityLocker.sol` L24–L25, L163–L169](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol#L163-L169)): `DECREASE_LIQUIDITY = 0x01` (liquidity delta `0`) then `TAKE_PAIR = 0x11`.
- `(removed-on-cca)` Launchpad-only `lock(address token, address prophet, address protocolFeeRecipient, PoolKey key, uint256 tokenAmount)` that called `PoolManager.modifyLiquidity` directly. The NFT arrives from LBPStrategy, not from Launchpad.
- Demo intent is still one full-range position (`CcaLib.emptyPositionDefinitions` at `b71c64e`). More than one NFT if `positionDefinitions` has several rows is still not a product path.
- After `migrate`, if `tokenIdOf(token)` reverts `UnknownLock`, web calls `locker.register(token, tokenId)` ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers). `tokenId` comes from PositionManager / the `Migrated` plan.

## 3. World server → Launchpad `(draft)`

Unchanged from `main`.

- The server verifies an IDKit 4 Proof of Human with Portal v4.
- On success it signs `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))` with EIP-191.
- The Launchpad checks that the signer is `WORLD_SIGNER` and that the nullifier is unused.

### Web → World server `(draft)`

The web app never holds the RP signing key. HTTP matches `world/` (PR #10, now on main): `GET /rp-context`, then `POST /verify`.

`GET {VITE_WORLD_SERVER_URL}/rp-context`

Live IDKit uses `app_id`, `action`, and `environment` from this envelope so the proof matches `WORLD_ENVIRONMENT`.

```json
{
  "app_id": "app_...",
  "action": "register-prophet",
  "environment": "production",
  "rp_context": {
    "rp_id": "rp_...",
    "nonce": "0x...",
    "created_at": 1700000000,
    "expires_at": 1700000300,
    "signature": "0x..."
  }
}
```

`POST {VITE_WORLD_SERVER_URL}/verify`

```json
{
  "wallet": "0x...",
  "chainId": 11155111,
  "launchpad": "0x...",
  "idkitResponse": { }
}
```

`idkitResponse` is the IDKit 4 result, forwarded as-is (`proof` is an accepted alias on the server). Verify errors: `portal_rejected`, `malformed_payload`, `context_mismatch` — the last two share the retry sentence. On success:

```json
{ "nullifier": "0x<uint256>", "serverSig": "0x<eip191>" }
```

`serverSig` is EIP-191 personal_sign of `keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier))`. Fixture: `world/fixture/register-prophet-signature.json`. While `VITE_WORLD_MOCK` is not `0`/`false`, the web app uses the mock client in `web/src/lib/world.ts` instead of these URLs.

Live `GET /rp-context` and `POST /verify` wait up to 60 seconds. The first check can take a minute when the World server has been idle. The issue button stays off while the check is running. The retry sentence is shown only after a timeout or a dropped connection — not while the request is still open.

## 4. What the web calls (exact ABI + address)

Issue still goes to Launchpad (`registerProphet`, `launch`). After `launch`, trading talks to the **auction**, **LBPStrategy**, **CCALens**, and **Universal Router** — not Launchpad `buy` / `sell`.

### 4.1 Home list

Keep `Launched`. Path B2 extends it with `auction` as the third indexed topic. Home still queries `fromBlock = VITE_LAUNCHPAD_DEPLOY_BLOCK`.

Sentence and deadline still come from ENS (`getEnsAddress`, `getEnsText(name, "prophecy")`, `getEnsText(name, "deadline")`).

Name next to a wallet: reverse lookup, falling back to `prophetOf(wallet)`.

### 4.2 Auction address from a token

| Order | Call | Address |
|---|---|---|
| 1 | `launchpad.auctionOf(token)` → `address` ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`Launchpad.sol` L205–L207](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L205-L207)). There is no `poolOpened` flag | `VITE_LAUNCHPAD_ADDRESS` |
| 2 | Decode `Launched` where `token` matches | Launchpad logs |
| 3 | LBPStrategy `InitializerCreated` / `DistributionInitialized` | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` |

Do not use factory `getAddress` unless the UI already has the exact `create` args.

### 4.3 Auction state (CCALens + CCA views)

CCA has no `getState()` enum. CCALens `state` is **not** `view`: it runs `checkpoint()` inside and returns via a revert payload ([`AuctionStateLens.sol` L26–L31](https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/lens/AuctionStateLens.sol#L26-L31)). Call it with `eth_call`.

```solidity
// CCALens at 0xc3C65F5453A3674aDb693cbdA3C842545cD30f53
struct AuctionState {
    Checkpoint checkpoint;
    uint256 currencyRaised;
    uint256 totalCleared;
    bool isGraduated;
}
struct Checkpoint {
    uint256 clearingPrice; // Q96
    ValueX7 currencyRaisedAtClearingPriceQ96X7;
    uint256 cumulativeMpsPerPrice;
    uint24 cumulativeMps;
    uint64 prev;
    uint64 next;
}
function state(IContinuousClearingAuction auction) public returns (AuctionState memory);
function getInitializedTickData(IContinuousClearingAuction auction)
    public view returns (TickWithData[] memory ticks);
```

Direct CCA views (auction address from `auctionOf`):

```solidity
function startBlock() external view returns (uint64);
function endBlock() external view returns (uint64);
function claimBlock() external view returns (uint64);
function currency() external view returns (address);
function token() external view returns (address);
function totalSupply() external view returns (uint128);
function clearingPrice() external view returns (uint256); // Q96 ETH per token; stale until checkpoint
function isGraduated() external view returns (bool);      // may be stale
function lastCheckpointedBlock() external view returns (uint64); // ICheckpointStorage
function floorPrice() external view returns (uint256);
function tickSpacing() external view returns (uint256);
function bids(uint256 bidId) external view returns (Bid memory);
function nextBidId() external view returns (uint256);

struct Bid {
    uint64 startBlock;
    uint24 startCumulativeMps;
    uint64 exitedBlock;
    uint256 maxPrice;
    address owner;
    uint256 amountQ96;
    uint256 tokensFilled;
}
```

Display the clearing price as `clearingPrice / 2^96` ETH per token. Do not call `curve()`. Do not show a percent change.

`$_tokensReceived` is internal — there is no public `tokensReceived()` getter.

### 4.4 Bid (budget + max price)

Address: the CCA at `auctionOf(token).auction`. Currency is ETH (`address(0)`). Empty `hookData` when `validationHook == 0`.

```solidity
function submitBid(
    uint256 maxPriceQ96,
    uint128 amount,
    address owner,
    uint256 prevTickPriceQ96,
    bytes calldata hookData
) external payable returns (uint256 bidId);

// 4-arg overload omits prevTickPriceQ96 and scans from the floor — do not use in the demo
function submitBid(uint256 maxPriceQ96, uint128 amount, address owner, bytes calldata hookData)
    external payable returns (uint256 bidId);
```

| Field | Meaning |
|---|---|
| `amount` | budget in wei; `msg.value` **must** equal `amount` |
| `maxPriceQ96` | max price the bidder accepts (Q96 ETH per token), strictly above current clearing and `<= MAX_BID_PRICE` |
| `owner` | bidder (receives tokens and leftover ETH) |
| `prevTickPriceQ96` | hint; #41 uses `floor + (n-1) * tick` with `maxPrice = floor + n * tick` |

First `submitBid` return / `BidSubmitted.id` is **0**. Official CCA [`BidStorage.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/a56d42231e7bf048136d9d88fa61e8518c10c5ff/src/BidStorage.sol) L10 and L47–L49 (`$_nextBidId` starts at 0; `_createBid` assigns then increments). **Not** fork-asserted in #41.

```solidity
event BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount);
```

Bid revert names (official CCA `a56d422` + [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers; params shown when the ABI has them): `AuctionNotStarted()`, `TokensNotReceived()`, `AuctionIsOver()`, `BidAmountTooSmall()`, `BidOwnerCannotBeZeroAddress()`, `InvalidAmount()`, `CurrencyIsNotNative()`, `InvalidBidPriceTooHigh(uint256 maxPriceQ96, uint256 maxBidPriceQ96)`, `BidMustBeAboveClearingPrice()`, `AuctionSoldOut()`, `InvalidBidUnableToClear()`, `TickPreviousPriceInvalid()`, `TickPriceNotIncreasing()`, `TickPriceNotAtBoundary()`, `TickNotInitialized()`, `InvalidTickPrice()`, `TickHintMustBeGreaterThanNextActiveTickPrice(uint256 tickPriceQ96, uint256 nextActiveTickPriceQ96)`, `BidIdDoesNotExist(uint256 bidId)`.

There is **no sell** during the auction.

### 4.5 Claim tokens and refund leftover

Same CCA address.

```solidity
function checkpoint() external returns (Checkpoint memory);
function exitBid(uint256 bidId) external;
function exitPartiallyFilledBid(uint256 bidId, uint64 lastFullyFilledCheckpointBlock, uint64 outbidBlock) external;
function claimTokens(uint256 bidId) external;
function claimTokensBatch(address owner, uint256[] calldata bidIds) external;
```

| Action | When | ETH / tokens |
|---|---|---|
| `exitBid` | after `endBlock`; bid max price strictly **above** final clearing | leftover ETH paid in `BidExited` |
| `exitPartiallyFilledBid` | partial fill; needs checkpoint hints. `outbidBlock = 0` means still at clearing at the end | leftover ETH in `BidExited` |
| `claimTokens` | after `claimBlock`, auction graduated, bid already exited | tokens to `bid.owner`. Anyone may call |

```solidity
event BidExited(uint256 indexed bidId, address indexed owner, uint256 tokensFilled, uint256 currencyRefunded);
event TokensClaimed(uint256 indexed bidId, address indexed owner, uint256 tokensFilled);
event CheckpointUpdated(uint256 blockNumber, uint256 clearingPriceQ96, uint24 cumulativeMps);
event ClearingPriceUpdated(uint256 blockNumber, uint256 clearingPriceQ96);
event TokensReceived(uint128 totalSupply);
```

Exit / refund revert names: `AuctionIsNotOver()`, `BidAlreadyExited()`, `CannotExitBid()`, `CannotPartiallyExitBidBeforeGraduation()`, `CannotPartiallyExitBidBeforeEndBlock()`, `InvalidLastFullyFilledCheckpointHint()`, `InvalidOutbidBlockCheckpointHint()`, `BidIdDoesNotExist(uint256 bidId)`.

Claim revert names: `NotClaimable()`, `AuctionIsNotFinalized()`, `NotGraduated()`, `BidNotExited()`, `BatchClaimDifferentOwner(address expectedOwner, address receivedOwner)`, `BidIdDoesNotExist(uint256 bidId)`.

Demo: prefer a bid strictly above final clearing so the UI can `exitBid` without partial-exit hints.

#### If the auction ends below 0.02 ETH (`requiredCurrencyRaised`)

**Yes — every bid is fully refunded. 0 tokens. No pool.** Official source, and asserted on the Sepolia fork in [PR #41](https://github.com/prism-toggle-ai/FakeNews/pull/41) `7139f72` [`test_goalNotReached_refundAndTokenSink`](https://github.com/prism-toggle-ai/FakeNews/blob/7139f721e7540dc0d5a733d08fdde953cbe0354b/contracts/test/fork/CCAFork.t.sol#L75) (raised 0.01 ETH):

- Graduation rule: `currencyRaised >= requiredCurrencyRaised`. “If the auction never graduates, bidders can refund their full bid amount via `exitBid` and all tokens are returned to the tokens recipient.” ([TechnicalDocumentation.md — Protocol Overview](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#protocol-overview), pin `7d7602d`)
- Implementation: `exitBid` after `endBlock` — if `!_isGraduated()`, it `_processExit(_bidId, 0, 0)` (zero tokens filled, full currency back). Comment: “Fully refund the bid if the auction did not graduate, since it is over.” ([`ContinuousClearingAuction.sol` L495–L501](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L495-L501))
- Fork (#41 `7139f72` `test_goalNotReached_refundAndTokenSink`): `exitBid` refunds the **full ETH**; bidder token balance stays **0**. `claimTokens` reverts `NotGraduated` ([L93–L94](https://github.com/prism-toggle-ai/FakeNews/blob/7139f721e7540dc0d5a733d08fdde953cbe0354b/contracts/test/fork/CCAFork.t.sol#L93-L94) `vm.expectRevert(NotGraduated.selector)`). `sweepUnsoldTokens` sends the auction supply to protocol. `LBPStrategy.migrate` does **not** revert; then `getSlot0` `sqrtPriceX96 == 0` ([L121–L122](https://github.com/prism-toggle-ai/FakeNews/blob/7139f721e7540dc0d5a733d08fdde953cbe0354b/contracts/test/fork/CCAFork.t.sol#L121-L122)). **No v4 pool** is opened.
- `exitPartiallyFilledBid` after `endBlock` does the same full refund when not graduated ([L525–L529](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L525-L529)). Prefer `exitBid` in the UI.

UI copy for this state: **Get your ETH back ({amount} ETH)** → `exitBid(bidId)` on the CCA (full refund; not “unused”). Goal met uses **Get back unused ETH ({amount} ETH)** (section 7).

### 4.6 Open market (`migrate`)

Address: LBPStrategy `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000`. Anyone may call after `migrationBlock`.

```solidity
function migrate(ILBPInitializer initializer) external;
function initializers(ILBPInitializer initializer) external view returns (MigratorParameters memory);
function registeredPoolIds(PoolId poolId) external view returns (address initializer);
function positionManager() external view returns (IPositionManager);
function initializerFactory() external view returns (IDistributorFactory);

event InitializerCreated(ILBPInitializer indexed initializer, MigratorParameters migrationParams);
event Migrated(ILBPInitializer indexed initializer, PoolKey indexed key, uint160 initialSqrtPriceX96, bytes plan);
event MigrationFailed(ILBPInitializer indexed initializer, bytes reason);
event FundsRecovered(ILBPInitializer indexed initializer, address indexed recipient, uint256 amount);
event CurrencySwept(address indexed recipient, uint256 amount);
event TokensSwept(address indexed recipient, uint256 amount);
```

`initializer` is the auction address from `auctionOf` / `Launched`.

If `tryMigrate` reverts, official `migrate` recovers currency + reserved tokens to `recipient` and does **not** create a pool. That `recipient` is protocol, not the prophet. The outer `migrate` does **not** revert: it emits `MigrationFailed` + `FundsRecovered` ([`LBPStrategy.sol` `1c590491` L260–L273](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L260-L273)).

Official `ILBPStrategy` (`1c590491`) revert names — **selectors differ from the zero-arg names previously listed** ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers + [`ILBPStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/ILBPStrategy.sol)):

- `MigrationNotYetAllowed(uint256 migrationBlock, uint256 currentBlock)` — L64; selector `0x2aa91e59` (not `MigrationNotYetAllowed()` `0x259e0809`)
- `InitializerNotRegistered(ILBPInitializer initializer)` — L129; ABI type `address`; selector `0x8581b481` (not `InitializerNotRegistered()` `0xee7e9915`)
- `PoolManagerAlreadyUnlocked()` — L137; no args, `0x84308fec`. Thrown on the **outer** `migrate` ([`LBPStrategy.sol` L221](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L221)) **before** the one-shot clear, so it can be retried.

`tryMigrate` inner names (`CurrencyRaisedMismatch`, `NoPositionsCreated`) are caught and become `MigrationFailed` + `FundsRecovered`. After a caught failure, `registeredPoolIds` is already cleared ([`LBPStrategy.sol` L247–L248](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L247-L248)) so migrate cannot be retried (`InitializerNotRegistered`). `OnlySelfCall` is not a `migrate()` catch path — `migrate` always self-calls `this.tryMigrate`.

There is no Launchpad wrapper. Web calls the strategy.

Pool key after success: native ETH (`address(0)`), `token`, fee `10000`, tickSpacing `200`, hooks = `ProphecyHook`. `poolId = keccak256(abi.encode(key))`. After a successful migrate, if `tokenIdOf(token)` reverts `UnknownLock`, call `locker.register(token, tokenId)`.

### 4.7 v4 swap

Address: Universal Router **2.1.2** `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3` (official v4 Sepolia table). **Not** Universal Router 2.0 `0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b`. Launchpad does **not** wrap swaps. After `migrate`, the web calls the router directly ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers).

```solidity
// IUniversalRouter.sol tag 2.1.2 L40
function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
error ExecutionFailed(uint256 commandIndex, bytes message); // L21
error TransactionDeadlinePassed();                         // L29
error LengthMismatch();                                    // L31
```

**Command / actions** (official; do not invent):

```
commands = abi.encodePacked(uint8(0x10))   // V4_SWAP — Commands.sol tag 2.1.2 L36
actions  = abi.encodePacked(uint8(0x06), uint8(0x0c), uint8(0x0f))
           // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
           // Actions.sol 545a5d2 L28 / L40 / L44
inputs[0] = abi.encode(actions, params)
router.execute{value: msgValue}(commands, inputs, deadline)
```

**PoolKey** (our migrate / CcaLib; [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers):

```
currency0 = address(0)   // ETH
currency1 = token
fee = 10000
tickSpacing = 200
hooks = ProphecyHook     // beforeInitialize only; hookData = 0x
```

`ExactInputSingleParams` at the UR 2.1.2 periphery pin `545a5d2` is **six fields** ([`IV4Router.sol` L31–L38](https://github.com/Uniswap/v4-periphery/blob/545a5d2a87228167edde48f3b9eda122d1e3c4d6/src/interfaces/IV4Router.sol#L31-L38); Designer Q2 supersedes the earlier five-field note):

```solidity
struct ExactInputSingleParams {
    PoolKey poolKey;
    bool zeroForOne;
    uint128 amountIn;
    uint128 amountOutMinimum;
    uint256 minHopPriceX36; // 0 disables the per-hop check
    bytes hookData;
}
```

- Exact-in ETH → token: `zeroForOne = true`, `msg.value = amountIn`. SETTLE_ALL currency0, TAKE_ALL currency1.
- Exact-in token → ETH: `zeroForOne = false`, `msg.value = 0`. **Permit2 first** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`): (1) token `approve` to Permit2, one time per token; (2) `permit2.approve(token, router, amount, expiration)` ([`IAllowanceTransfer.sol` L124](https://github.com/Uniswap/permit2/blob/main/src/interfaces/IAllowanceTransfer.sol#L124)).

`ProphecyHook` has no swap hooks (`beforeSwap` / `afterSwap` false, [`ProphecyHook.sol` `b71c64e` L39–L40](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/ProphecyHook.sol#L39-L40)). No hook error can come from a swap.

Swap revert names the UI will hit (Designer Q2): `V4TooLittleReceived(uint256,uint256)` ([`IV4Router.sol` L14](https://github.com/Uniswap/v4-periphery/blob/545a5d2a87228167edde48f3b9eda122d1e3c4d6/src/interfaces/IV4Router.sol#L14)), `TransactionDeadlinePassed()`, `ExecutionFailed(uint256,bytes)`, `LengthMismatch()`, Permit2 `InsufficientAllowance(uint256)` / `AllowanceExpired(uint256)`.

**TBD:** this calldata has not been executed against the live Sepolia 2.1.2 router in this repo (PR #41 used `PoolSwapTest` `0x9b6b46e2c869aa39918db7f52f5557fe577b6eee` as a harness-only caller; that is not the product ABI).

Optional reads: StateView `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c`, Quoter `0x61b3f2011a92d183c7dbadbda940a7555ccf9227`.

UI v2 chrome (DECISIONS #17) still applies. The trade controls on this branch are bid / claim / open market / swap, not curve Buy / Sell.

## 5. Environment variables and `deployments/sepolia.json`

| Name | Used by |
|---|---|
| `VITE_RPC_URL` | web |
| `VITE_LAUNCHPAD_ADDRESS` | web |
| `VITE_LAUNCHPAD_DEPLOY_BLOCK` | web (`fromBlock` for `Launched` logs) |
| `VITE_HOOK_ADDRESS`, `VITE_LOCKER_ADDRESS` | web (optional) |
| `VITE_LBP_STRATEGY` | web (optional; empty = `launchpad.lbpStrategy()` / official `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000`) |
| `VITE_CCA_FACTORY` | web (optional; empty = official `0x000000001F26a0044BaA66024e7b6599c61963F8`) |
| `VITE_CCA_LENS` | web (optional; empty = official `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53`) |
| `VITE_POSITION_MANAGER` | web (optional; empty = official `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4`) |
| `VITE_UNIVERSAL_ROUTER` | web (optional; empty = official `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`) |
| `VITE_PARENT_NAME` | web (e.g. `prophecy.eth`) |
| `VITE_UNIVERSAL_RESOLVER` | web ([`ENSV2.md`](ENSV2.md) section 0) |
| `VITE_WORLD_APP_ID`, `VITE_WORLD_ACTION` | web |
| `VITE_WORLD_MOCK` | web (default on; set `0` to call the world server) |
| `VITE_WORLD_SERVER_URL` | web (world/ base URL; unused while mock) |
| `VITE_WALLETCONNECT_PROJECT_ID` | web (optional; injected wallets work without it) |
| `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY` | contract deployment (people only) |
| `TEAM_WALLET` | deploy scripts (optional; defaults to the deployer). If set, must equal the deployer — one wallet |
| `PARENT_USER_REGISTRY` | deploy script (`deployUserRegistry` output; required when the script creates `ProphecyEns`) |
| `ENS_ADAPTER_ADDRESS` | deploy script **output** (logged `ProphecyEns`). Optional override: if set, skip adapter CREATE |
| `UNISWAP_V4_POOL_MANAGER` | deploy script (optional). Empty = official Uniswap v4 Sepolia PoolManager |
| `HOOK_SALT` | deploy script (optional). Empty = mine a CREATE2 salt whose address has `beforeInitialize` flags |
| `PARENT_LABEL`, `ENS_REGISTRATION_SECRET`, `ENS_DURATION_SECONDS` | parent `.eth` register (`infra/scripts/deploy-sepolia.sh`) |
| `MOCK_USDC_MINT_AMOUNT` | optional MockUSDC `mint` amount (6 decimals). Empty = script mints enough for the fee |
| `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_SIGNER_KEY` | World verification server |

Empty `VITE_LAUNCHPAD_ADDRESS` means the launchpad is not deployed yet. The web app must not invent a contract address. When the address is set, the web app sends `registerProphet` / `launch` only for a live prophet, and sends bid / exit / claim / migrate / swap only for tokens that came from a `Launched` log or a live `launch` receipt. Prototype rows are never write targets. Empty address keeps the local mock store. `VITE_UNIVERSAL_RESOLVER` is the ENSv2 address from [`ENSV2.md`](ENSV2.md) section 0. The web app does not read `ENS_ADAPTER_ADDRESS`; if it needs the adapter it calls `launchpad.ens()`.

After a successful send, infra writes a machine-readable record (no secrets) to `deployments/sepolia.json`, or `deployments/anvil.json` on a local / fork run (gitignored). Format: [`infra/README.md`](../infra/README.md) “Deployment record”. Web copies `launchpad` into `VITE_LAUNCHPAD_ADDRESS` and `launchpadBlock` into `VITE_LAUNCHPAD_DEPLOY_BLOCK`.

**Keys infra must add** to `deployments/sepolia.json` (later infra PR; this file does not edit the writer):

| JSON field | Value | Vite / web |
|---|---|---|
| `lbpStrategy` | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` | `VITE_LBP_STRATEGY` |
| `ccaFactory` | `0x000000001F26a0044BaA66024e7b6599c61963F8` | `VITE_CCA_FACTORY` |
| `ccaLens` | `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | `VITE_CCA_LENS` |
| `positionManager` | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` | `VITE_POSITION_MANAGER` |
| `universalRouter` | `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3` | `VITE_UNIVERSAL_ROUTER` |
| `initializerHookReference` | `0x1600059B95A80d500fC42400ea9a88A9C29D2000` | record only (not a Vite var) |
| *(existing)* `launchpad` / `launchpadBlock` | our CREATE | `VITE_LAUNCHPAD_ADDRESS` / `VITE_LAUNCHPAD_DEPLOY_BLOCK` |
| *(existing)* `hook` / `locker` / `poolManager` | our CREATE2 / CREATE / official v4 | optional `VITE_HOOK_ADDRESS` / `VITE_LOCKER_ADDRESS` |
| *(do not add per auction)* | auction / pool / NFT ids | `Launched.auction` / `auctionOf` / `Migrated` |

`VITE_CHAIN_ID` stays `11155111`.

`Deploy.s.sol` order on this branch (later contracts / infra PR; do not CREATE the official factory or strategy):

1. Predict Launchpad CREATE address.
2. `new ProphecyEns(predictedPad, …)` then `new Launchpad(protocolFeeRecipient, worldSigner, ens)`.
3. Mine CREATE2 salt; `new ProphecyHook{salt}(poolManager, lbpStrategy)` — `authorized` is LBPStrategy, not Launchpad.
4. `new LiquidityLocker(poolManager, launchpad, hook)` — [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`LiquidityLocker.sol` L85](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol#L85). ERC-721 receiver plus permissionless `register`.
5. `launchpad.setUniswap(poolManager, hook, locker)` once.
6. `launchpad.setCca(0x95434E898Af471945Cab33D5064d2aC1A6Ba2000, 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4)`. Require the views match. Reverts `InvalidHook` unless `hook.authorized() == lbpStrategy`.

`ENS_ADAPTER_ADDRESS` / `TEAM_WALLET` / parent-lock rules stay as on `main`. Parent lock is not part of this deploy.

## 6. Curve quote vectors `(removed-on-cca)`

Bonding-curve quote vectors (`contracts/test/Curve.vectors.json`, `web/src/lib/Curve.vectors.json`) are unused on this branch. Do not re-derive them. A later contracts PR deletes the callers; this file does not edit those files.

## 7. Auction UI states, designer copy, and revert names

Designer-approved copy v2 (character-for-character). English only. No returns / profit / prediction / “coin” / percent price change (DECISIONS #1, section 11). CCA has no `getState()` enum — the UI derives a label from blocks + views. `block` is the chain’s block-numberish. Sepolia is 12s blocks. 25 blocks is five minutes at that pace.

Departed (`now >= deadline` from ENS) is its own badge next to any state below (DECISIONS #21). It never replaces the auction header.

### 7.1 Status headers

| UI state | Detect on-chain | Header |
|---|---|---|
| **Not funded** | No `TokensReceived`; `submitBid` would revert `TokensNotReceived`. After a successful `launch` this should not appear | `Auction is getting ready` |
| **Not started** | Funded, `block < startBlock()` | `Auction starts in {startBlock - block} blocks` |
| **Live** | Funded, `startBlock() <= block < endBlock()` | `Auction live · ends in {blocks} blocks` (`{blocks}` = `endBlock - block`) |
| **Sold out** (still live) | `block < endBlock()` but next `submitBid` reverts `AuctionSoldOut` | `Auction live · all tokens are bid for` · helper: `New bids are closed. Come back when the auction ends.` |
| **Ended, not finalized** | `block >= endBlock()` and `lastCheckpointedBlock() != endBlock()` | `Auction ended · final price not set yet`. CTA (`checkpoint`): `Set final price` / pending: `Setting final price…` |
| **Ended, graduated** | `block >= endBlock()`, `isGraduated() == true` after a current checkpoint | `Auction ended · ready to open the market` |
| **Ended, failed** | `block >= endBlock()` and `isGraduated() == false` after a final checkpoint | `Auction ended · goal not reached` |
| **Claim blocked** | Graduated and `block < claimBlock()` | `Tokens can be claimed from block {claimBlock}.` |
| **Claimable** | Graduated, `block >= claimBlock()`, bid already exited | keep **Ended, graduated** header; CTAs in 7.4 |
| **Migratable** | Graduated, `block >= migrationBlock`, no `Migrated` yet | keep **Ended, graduated** header; CTAs in 7.6 |
| **Pool open** | `Migrated` or `slot0 != 0` (`auctionOf` has no `poolOpened` flag — [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`Launchpad.sol` L205–L207](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L205-L207)) | `Market open on Uniswap v4` |

### 7.2 Clearing price and progress

Shown as `clearingPrice / 2^96` ETH per token (`clearingPrice()` or CCALens `state`). No percent change next to the price.

| Surface | Copy |
|---|---|
| Label, live | `Current clearing price` |
| Label, after `endBlock` | `Final clearing price` |
| Helper | `Everyone buying in the same block pays that block's price per token. You never pay more than your max price.` |
| Progress | `{raised} of 0.02 ETH raised to open the market` |

### 7.3 Bid form (`submitBid` 5-arg; `BidSubmitted`)

No sell control on this screen.

| Surface | Copy |
|---|---|
| Field | `Budget (ETH)` → `amount` / `msg.value` |
| Field | `Max price per token (ETH)` → `maxPriceQ96` (UI ETH × 2^96) |
| Helper | `You never pay more than your max price. After the auction ends, you can get back any ETH not used.` |
| CTA | `Place bid` / pending: `Placing bid…` / done: `Bid placed` |
| Your bid row | `Your bid · {budget} ETH up to {max} ETH per token` |

| Error | Copy |
|---|---|
| `AuctionNotStarted` | `The auction hasn't started yet.` |
| `TokensNotReceived` | `The auction isn't ready yet. Try again in a moment.` |
| `AuctionIsOver` | `This auction has ended.` |
| `AuctionSoldOut` | `All tokens are bid for. New bids are closed.` |
| `BidMustBeAboveClearingPrice` | `Your max price must be above the current clearing price.` |
| `InvalidBidPriceTooHigh` | `That max price is too high. Enter a lower one.` |
| `InvalidBidUnableToClear` | `This bid can't be filled at that price. Raise your max price.` |
| `BidAmountTooSmall` | `Your budget is too small. Enter a larger amount.` |
| `InvalidAmount` | `The ETH sent doesn't match your budget. Try again.` |
| `CurrencyIsNotNative`, `BidOwnerCannotBeZeroAddress` | `Something went wrong with this bid. Try again.` |
| `TickPreviousPriceInvalid`, `TickPriceNotIncreasing`, `TickPriceNotAtBoundary`, `TickNotInitialized`, `InvalidTickPrice`, `TickHintMustBeGreaterThanNextActiveTickPrice` | `Prices moved. Refresh and try again.` |

### 7.4 After the auction, goal met (Ended, graduated → Claimable)

Order: unused ETH first (`exitBid`; `exitPartiallyFilledBid` for a partial fill, same label), then `claimTokens` (needs the bid exited).

| Surface | Copy |
|---|---|
| CTA (`exitBid`) | `Get back unused ETH ({amount} ETH)` / pending: `Sending ETH…` / done: `ETH returned` |
| Helper | `Do this first, even if all of your budget was used. Then claim your tokens.` |
| Done, 0 ETH back (`BidExited.currencyRefunded == 0`) | `All of your budget was used.` |
| CTA (`claimTokens`) | `Claim tokens` / pending: `Claiming…` / done: `Tokens claimed` |
| Claim blocked | `Tokens can be claimed from block {claimBlock}.` |

### 7.5 After the auction, goal not met (Ended, failed)

Hide `Claim tokens` and `Open market` (`claimTokens` reverts `NotGraduated`; `migrate` opens no pool).

| Surface | Copy |
|---|---|
| Header | `Auction ended · goal not reached` |
| Progress | `{raised} of 0.02 ETH raised to open the market` |
| Helper | `The goal wasn't reached, so no tokens were issued and the market won't open. Every bid is returned in full.` |
| CTA (`exitBid`, full refund) | `Get your ETH back ({amount} ETH)` / pending: `Sending ETH…` / done: `ETH returned` |

Designer-approved copy v2 (character-for-character). `TickPriceNotIncreasing` and `TickHintMustBeGreaterThanNextActiveTickPrice` share `Prices moved. Refresh and try again.` with the other tick rows (section 7.3). `BatchClaimDifferentOwner` is `These bids belong to different wallets. Claim them one by one.`

### 7.6 Exit / refund errors

| Error | Copy |
|---|---|
| `AuctionIsNotOver` | `You can get your ETH back after the auction ends.` |
| `BidAlreadyExited` | `You already got your ETH back for this bid.` |
| `CannotExitBid` | `This bid can't be settled this way. Refresh and try again.` |
| `CannotPartiallyExitBidBeforeGraduation`, `CannotPartiallyExitBidBeforeEndBlock` | `This bid can be settled after the auction ends.` |
| `InvalidLastFullyFilledCheckpointHint`, `InvalidOutbidBlockCheckpointHint` | `Auction data changed. Refresh and try again.` |
| `BidIdDoesNotExist` | `We couldn't find this bid.` |

### 7.7 Claim errors

| Error | Copy |
|---|---|
| `NotGraduated` | `The goal wasn't reached, so there are no tokens to claim.` |
| `NotClaimable` | `Tokens can't be claimed yet. Try again from block {claimBlock}.` |
| `AuctionIsNotFinalized` | `The final price isn't set yet. Set it first, then claim.` |
| `BidNotExited` | `Get back unused ETH first, then claim your tokens.` |
| `BatchClaimDifferentOwner` | `These bids belong to different wallets. Claim them one by one.` |
| `BidIdDoesNotExist` | `We couldn't find this bid.` |

### 7.8 Open market (`LBPStrategy.migrate`; Migratable → Pool open)

Web calls `LBPStrategy.migrate(auction)` directly; there is no Launchpad wrapper ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers).

| Surface | Copy |
|---|---|
| CTA | `Open market` |
| Helper | `Moves the raised ETH and tokens into a Uniswap v4 pool. Anyone can do this once the auction ends and the goal is reached.` |
| Before `migrationBlock` | `The market can open from block {migrationBlock}.` |
| Pending / done | `Opening market…` / `Market open. You can swap now.` (`Migrated`) |
| `MigrationFailed` + `FundsRecovered` (no pool, no revert) | `The market couldn't open. No pool was created.` (full state in 7.9) |

| Error | Copy |
|---|---|
| `MigrationNotYetAllowed(uint256,uint256)` | `Too early. The market can open from block {migrationBlock}.` |
| `InitializerNotRegistered(address)` | `This auction isn't linked to a market.` |
| `PoolManagerAlreadyUnlocked()` | `The market couldn't open. Try again.` |
| `CurrencyRaisedMismatch`, `NoPositionsCreated`, `OnlySelfCall` | no revert copy: caught inside `migrate`, show 7.9 state |

Rule: **`The market couldn't open. Try again.`** is only for `PoolManagerAlreadyUnlocked`. Other migrate failures show the 7.9 state. Designer (copy v2): only `PoolManagerAlreadyUnlocked` reverts and can be retried.

Dev note (copy v2): `migrate` is one-shot. It clears the pool registration before trying, so a second call reverts `InitializerNotRegistered`. Check `Migrated` / `MigrationFailed` for the auction before you show `Open market`.

### 7.9 Open market failed (graduated, then `MigrationFailed` + `FundsRecovered`)

Source: official LBPStrategy `migrate` (`1c590491` L260–L273). On failure it sends the raised ETH and the tokens set aside for the pool to the protocol recipient, clears the registration, and does not revert. It can't be run again (see 7.8).

| Surface | Copy |
|---|---|
| Header | `Auction ended · market couldn't open` |
| Body (v1 string, kept) | `The market couldn't open. No pool was created.` |
| Helper | `This can't be tried again, so this token has no market for now. You can still get back unused ETH and claim your tokens.` |
| Hide | `Open market` and the Swap section. Keep `Get back unused ETH` and `Claim tokens` (7.4) as they are. |
| Transaction toast for the caller (the tx succeeds even though the market didn't open) | `Transaction confirmed, but the market couldn't open.` |

Goal not reached (7.5): `migrate` also ends in `MigrationFailed` + `FundsRecovered` there, and that is expected. Keep the 7.5 state and show no failure copy.

Designer Q1 ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42)): after a graduated + caught migrate, bidders can still `exitBid` (unspent refund) and `claimTokens` (after `exitBid`). After a not-graduated migrate, `exitBid` refunds full ETH and `claimTokens` reverts `NotGraduated`. `TBD:` exact 1-wei leftover solvency after graduated + caught migrate — not proven against a live fork in this repo.

### 7.10 Swap (after Pool open; Universal Router 2.1.2 `execute`)

Web calls the Universal Router directly (no Launchpad wrapper): `commands = 0x10` (`V4_SWAP`), actions `0x06, 0x0c, 0x0f` (`SWAP_EXACT_IN_SINGLE`, `SETTLE_ALL`, `TAKE_ALL`). PoolKey: ETH / token, fee `10000`, tickSpacing `200`, hooks `ProphecyHook`, `hookData = 0x`. Exact-in only.

Dev note: this encoding has not been run against the live Sepolia 2.1.2 router yet (PR #41 used `PoolSwapTest`). Test it before launch. Use the six-field `ExactInputSingleParams` including `minHopPriceX36 = 0` (Designer Q2; supersedes the five-field note).

| Surface | Copy |
|---|---|
| Section title | `Swap` |
| Before Pool open (section hidden, or shown disabled) | `Swapping opens when the market opens.` |
| Tabs | `Buy` / `Sell` |
| Fee note | `Pool fee 1%. Fees are split 24% to the prophet and 76% to the protocol.` |

Buy (ETH → token, `zeroForOne = true`, `msg.value = amountIn`):

| Surface | Copy |
|---|---|
| Field | `You pay (ETH)` → `amountIn` |
| Output | `You get about {amount} {SYMBOL}` |
| Minimum line | `At least {minAmount} {SYMBOL}` → `amountOutMinimum` |
| CTA | `Buy {SYMBOL}` / pending: `Buying…` / done: `Bought {amount} {SYMBOL}` |
| Not enough balance (checked before sending) | `Not enough ETH.` |

Sell (token → ETH, `zeroForOne = false`, `msg.value = 0`). Selling needs Permit2 first: (1) token `approve` to Permit2, one time per token; (2) `permit2.approve(token, router, amount, expiration)`, again when that allowance runs out or expires. Show only the steps still needed.

| Surface | Copy |
|---|---|
| Field | `You sell ({SYMBOL})` → `amountIn` |
| Output | `You get about {amount} ETH` |
| Minimum line | `At least {minAmount} ETH` → `amountOutMinimum` |
| Step 1 CTA (token → Permit2) | `Allow Uniswap to use your {SYMBOL}` / pending: `Allowing…` / done: `{SYMBOL} allowed` |
| Step 1 helper | `One-time step before your first sale of this token.` |
| Step 2 CTA (Permit2 → Universal Router) | `Confirm {SYMBOL} for this sale` / pending: `Confirming…` / done: `Ready to sell` |
| Step 2 helper | `Lets the Uniswap router move the {SYMBOL} you sell. You may need this again later.` |
| Step counter | `Step {n} of {total}` |
| CTA | `Sell {SYMBOL}` / pending: `Selling…` / done: `Sold {amount} {SYMBOL}` |
| Not enough balance (checked before sending) | `Not enough {SYMBOL}.` |

Dev note: the approval goes to Permit2 and the Uniswap router, not to a Prophecy contract, and the wallet shows those names. That is why the step says "Uniswap", not "Prophecy".

| Error | Copy |
|---|---|
| `V4TooLittleReceived` (v4-periphery V4Router, "min out" check; Designer Q2) | `The price moved before your swap went through. Try again.` |
| `TransactionDeadlinePassed` | `This swap took too long. Try again.` |
| `ExecutionFailed`, `LengthMismatch` | `The swap didn't go through. Try again.` |
| Permit2 `InsufficientAllowance`, `AllowanceExpired` (Designer Q3) | `Confirm {SYMBOL} for this sale again, then sell.` |
| Pool not open yet (PoolManager `PoolNotInitialized`) | `Swapping opens when the market opens.` |
| Wallet rejected (no revert) | `Swap canceled.` |

ProphecyHook has no swap hooks (`beforeInitialize` only), so no hook error can come from a swap. `Slippage` (curve Launchpad) was removed on `cca`. The price-moved row maps to the router's check instead.

### 7.11 Launch-time errors (prophet, on `launch`)

Any official create / LBP name in section 2 and below (`InvalidEndBlock`, `InvalidFundsRecipient`, `FloorPriceTooLow`, `InvalidTokenAmount`, `ClaimBlockIsBeforeEndBlock`, `InvalidAuctionDataLength`, `StepBlockDeltaCannotBeZero`, `InvalidStepDataMps`, `InvalidEndBlockGivenStepData`, `FloorPriceIsZero`, `TickSpacingTooSmall`, `FloorPriceAndTickSpacingGreaterThanMaxBidPrice`, `FloorPriceAndTickSpacingTooLarge`, `TotalSupplyIsZero`, `TotalSupplyIsTooLarge`, `TokenIsAddressZero`, `TokenAndCurrencyCannotBeTheSame`, `FundsRecipientIsZero`, `TokensRecipientIsZero`): **`Couldn't start the auction. Try again.`**

v2: the new Launchpad error names are now known. Copy is in 7.13.

### 7.12 Trading fees (`LiquidityLocker.collect(token)`)

Source: [`LiquidityLocker.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol) @ `b71c64e`. Anyone can call `collect(token)`. Fees always go to the two recipients set at launch (prophet 24, protocol 76, dust to the protocol). The caller gets nothing. It takes ETH and {SYMBOL} fees and never touches the locked liquidity. Show it only after Pool open (`tokenIdOf(token)` reverts `UnknownLock` before that; treat that as "not open", not as an error).

| Surface | Copy |
|---|---|
| Section title | `Trading fees` |
| CTA | `Collect fees` / pending: `Collecting fees…` / done: `Fees sent` |
| Helper | `Sends the pool's trading fees: 24% to the prophet and 76% to the protocol. Anyone can do this. The locked pool stays as it is.` |
| Done, nothing to send (`Collected` with all amounts 0) | `No fees to collect yet.` |
| Before Pool open | `Fees start once the market opens.` |
| Prophet line (optional, when the wallet is `prophetOf(token)`) | `You get 24% of this pool's trading fees.` |

Prophet: held fees (`accruedEth(prophet) > 0`, `withdrawAccrued`). If the prophet wallet can't receive ETH during `collect`, its share is held in the locker (`ProphetAccrued`).

| Surface | Copy |
|---|---|
| Line | `{amount} ETH in fees is waiting for you.` |
| CTA | `Withdraw fees` / pending: `Withdrawing…` / done (`ProphetWithdrawn`): `Fees withdrawn` |

| Error | Copy |
|---|---|
| `UnknownLock` (on `collect`) | `Fees start once the market opens.` |
| `EthTransferFailed`, `TokenTransferFailed` (on `collect`) | `Fees couldn't be sent right now. Try again later.` |
| `NothingAccrued` (on `withdrawAccrued`) | `There are no fees to withdraw.` |
| `EthTransferFailed` (on `withdrawAccrued`) | `Your wallet couldn't receive ETH. Try another wallet setup.` |
| `PositionManagerNotSet`, `Reentrant` | `Something went wrong. Try again later.` (should not happen once deployed) |

### 7.13 Launchpad / Hook / Locker / LBP error table (v2, full list from [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42))

"no UI copy (internal)" = admin or deploy-only, or not reachable from the web. If one shows up anyway, use `Something went wrong. Try again later.`

Launchpad: `registerProphet` (prophet name)

| Error | Copy |
|---|---|
| `BadLabel` | `Use 3–16 lowercase letters or numbers.` |
| `LabelTaken` | `That name is taken. Try another.` |
| `AlreadyProphet` | `This wallet already has a prophet name.` |
| `NullifierUsed` | `This World ID already has a prophet name.` |
| `InvalidSignature` | `We couldn't confirm your World ID. Verify again.` |

Launchpad: `launch`

| Error | Copy |
|---|---|
| `NotProphet` | `Get a prophet name first, then launch.` |
| `BadSlug` | `Use 3–32 lowercase letters, numbers, or hyphens. No hyphen at the start or end.` |
| `BadProphecy` | `Your prophecy must be 1 to 140 characters.` |
| `SlugTaken` | `You already used this name for a prophecy. Pick another.` |
| `CcaNotSet` | `Launching isn't open yet. Try again later.` |
| `AuctionExists`, `AuctionNotCreated`, `TokenTransferFailed` | `Couldn't start the auction. Try again.` |
| `ProphetRecipient` | no UI copy (internal: only the protocol fee wallet can hit this) |

Dev note: `BadProphecy` counts bytes, not characters (1–140 bytes). Emoji and non-Latin text use more than one byte each, so count bytes in the input field.

Launchpad: internal — `NotDeployer`, `UniswapAlreadySet`, `UniswapNotSet`, `CcaAlreadySet`, `InvalidHook`, `BadAuctionBlocks`, `ZeroAddress`, `UnexpectedEth`, `EthTransferFailed` (declared, not used in Launchpad), `Reentrant`: no UI copy (internal).

ProphecyHook — `NotPoolManager`, `InvalidInitializer`, `ZeroAddress`: no UI copy (internal). The hook only runs at pool start inside `migrate`. If it fails there, `migrate` catches it and the 7.9 state shows.

LiquidityLocker

- User-reachable: `UnknownLock`, `EthTransferFailed`, `TokenTransferFailed`, `NothingAccrued`, `PositionManagerNotSet`, `Reentrant`: see 7.12.
- `NotLaunchpad`, `NotPositionManager`, `ZeroAddress`, `AlreadyPrepared`, `AlreadyReceived`, `PositionManagerAlreadySet`, `BadPoolKey`, `UnexpectedEth`, `NotNftOwner`: no UI copy (internal).

LBP (`LBPStrategy.migrate`)

- `MigrationNotYetAllowed(uint256,uint256)`, `InitializerNotRegistered(address)`, `PoolManagerAlreadyUnlocked()`: see 7.8.
- `CurrencyRaisedMismatch`, `NoPositionsCreated`, `OnlySelfCall`: caught inside `migrate` → 7.9 state, not a revert.
- Launch-time LBP names: see 7.11.

Removed on `cca` (do not map): `CurveComplete`, `Slippage`, `MemoTooLong`, `ExceedsSold`, `ZeroAmount`. v1 final had no copy for any of these, so nothing was dropped.

## 8. Four fork-test steps (02:00 KST gate)

**Canonical sequence:** [PR #41](https://github.com/prism-toggle-ai/FakeNews/pull/41) `7139f72` [`contracts/test/fork/CCAFork.t.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/7139f721e7540dc0d5a733d08fdde953cbe0354b/contracts/test/fork/CCAFork.t.sol) `_runHappyPath` (25 and 10 blocks) plus `test_goalNotReached_refundAndTokenSink`. Pin `vm.createSelectFork(rpc, 11_784_960)`. Helpers: `CCAForkHelpers.sol`. That suite talks to official LBPStrategy / CCA directly (no Launchpad). A later Launchpad fork wraps step 1 with `launch`.

| # | Step | Calls (as in #41) | Pass when |
|---|---|---|---|
| 1 | Create auction | `initializeDistribution` → factory `create` + `onTokensReceived` | Auction code at the predicted address. `fundsRecipient == LBPStrategy`, `tokensRecipient` and `recipient` are protocol, not the prophet |
| 2 | Bid | 5-arg `submitBid{value: amount}(maxPrice, amount, owner, prevTick, "")`. First `bidId` is **0** (official `BidStorage`, not asserted in #41). Hint: `maxPrice = floor + n * tick`, `prevTick = floor + (n-1) * tick` | `BidSubmitted`. Raised demand ≥ 0.02 ETH for the happy path |
| 3 | Settle + open market | `vm.roll` to `endBlock`, `checkpoint()`, `exitBid` (unused ETH), `claimTokens`. Then `vm.roll` to `endBlock + 1`, `LBPStrategy.migrate(auction)` | `isGraduated() == true`. `PoolManager.getSlot0(poolId)` non-zero. Fee 10000, tickSpacing 200 |
| 4 | Swap | After (3), one ETH→token swap. Product: Universal Router 2.1.2 `execute` with `V4_SWAP = 0x10` and actions `0x06, 0x0c, 0x0f` (section 4.7). #41 harness used `PoolSwapTest` | Token balance of the trader moves |

Goal not reached is the same file, not a fifth happy-path step: `exitBid` full ETH / 0 tokens; `claimTokens` reverts `NotGraduated` (L93–L94); no pool (`sqrtPriceX96 == 0`, L121–L122). See section 4.5.

`TBD(backend):` gas for each step. Record in `FEEDBACK.md` after the run (`TODO(team)` until then).

## 9. Gates and fallback

All CCA work lives on the `cca` branch family. It reaches `main` only after the final gate. Hours are KST.

| Gate | When | Must be true | If missed |
|---|---|---|---|
| INTERFACE + contract skeleton | 22:00 | this file + a compiling Launchpad / hook / locker skeleton on a `cca/*` branch | submit the curve version on `main` |
| Sepolia-fork 4 steps green | 02:00 | section 8 | submit the curve version on `main` |
| Web + deploy script wired | 03:30 | web bid / lens / claim / migrate / swap; `Deploy.s.sol` writes the new JSON keys | submit the curve version on `main` |

Do not merge CCA contracts into `main` before the final gate.

## 10. `TBD(backend)` list

Answered items stay struck through so later PRs can see the trail. Remaining rows are still open. Do not invent numbers.

1. ~~`salt` derivation~~ → [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`Launchpad.sol` L191](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L191): `salt = keccak256(abi.encode(token, msg.sender, slug))`. Frontend does not pass a salt.
2. `floorPrice` / auction `tickSpacing` — **pending #42 recalculation** for the 1B product mint (~0.02 ETH at full sale). Current values stay `1000 << 96` / `100 << 96` from #41 / `CcaLib` L27–L28. Do not invent replacements.
3. ~~`auctionStepsData`~~ → section 0.1 (`abi.encodePacked(uint24(1e7/N), uint40(N))`) from #41.
4. ~~`startBlock`~~ → `block.number` from #41.
5. ~~`claimBlock` / `migrationBlock`~~ → `end` / `end + 1` from #41.
6. `reservedTokenAmountForLP` / auction supply — [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`CcaLib.sol` L15–L17](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/cca/CcaLib.sol#L15-L17) currently uses 793.1M auction / 206.9M LP. Still paired with the pending floor recalculation. #41’s spike used `800e18` / `200e18` on a `1000e18` test token.
7. Exact `positionDefinitions` / `lpAllocationSchedule` encodings. #41 and #42 `CcaLib` use empty `PositionDefinition[]` (implicit full-range) and one bracket `{0, 1e7}`. Still confirm against the pending floor recalculation.
8. ~~`tokensRecipient` / `recipient`~~ → **protocol** (never the prophet) from #41.
9. ~~Whether Launchpad wraps `migrate`~~ → web always calls `LBPStrategy.migrate(auction)`. No Launchpad wrapper ([PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) TBD answers).
10. ~~How `auctionOf(token).poolOpened` is set~~ → `auctionOf` returns `address` only ([`Launchpad.sol` L205–L207](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L205-L207)). Detect pool open from `Migrated` or `slot0 != 0`.
11. ~~New Launchpad custom-error names~~ → full list in section 7.13 / [`Launchpad.sol` L57–L80](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L57-L80). “LBP not set” is `CcaNotSet`.
12. ~~`LiquidityLocker` constructor and tokenId bind~~ → `constructor(poolManager, launchpad, hook)`; `prepare` then permissionless `register(token, tokenId)` ([`LiquidityLocker.sol` L85, L120–L123](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol#L120-L123)). Event `Registered`; error `NotNftOwner`.
13. ~~PositionManager action bytes for fees-only `collect`~~ → `0x01` + `0x11`, liquidity delta `0` ([`LiquidityLocker.sol` L24–L25, L163–L169](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/LiquidityLocker.sol#L163-L169)).
14. ~~Universal Router 2.1.2 `V4_SWAP` command + inputs~~ → section 4.7. **TBD:** not executed against live Sepolia 2.1.2 in this repo (PR #41 used `PoolSwapTest`).
15. ~~Whether `receive()` must accept ETH from LBPStrategy~~ → no. [`Launchpad.sol` L131–L133](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/Launchpad.sol#L131-L133) accepts only locker and PoolManager. `recipient` is protocol, not Launchpad.
16. Hook CREATE2 flags if any permission besides `BEFORE_INITIALIZE` is added. [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) `b71c64e` [`ProphecyHook.sol` L31–L47](https://github.com/prism-toggle-ai/FakeNews/blob/b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9/contracts/src/uniswap/ProphecyHook.sol#L31-L47) is `beforeInitialize` only.
17. **TBD:** 1-wei leftover solvency after graduated + caught `migrate` (Designer Q1).
18. **TBD:** Sepolia StateView `0xe1dd9c3…` bytecode vs pin `545a5d2` for a pending-fees view (Designer Q4). No locker `pendingFees` yet.

## 11. Copy (user-facing)

English only. No wording about returns, profit, or prediction. No “coin”. No percent price change. The price says people are here, not that the sentence is true (DECISIONS #1).
