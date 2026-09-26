# Interface (CCA)

Companion to [`INTERFACE.md`](INTERFACE.md). **`INTERFACE.md` stays the bonding-curve contract on `main`.** This file is the contract between `contracts/`, `web/`, `world/`, and `infra/` for the CCA path on branch `cca`. It applies when `cca` work is in progress; it supersedes `INTERFACE.md` only after `cca` merges to `main`.

- **Changing it:** edit this file first, in **the same PR** as the CCA code change, and write "INTERFACE_CCA change" in the PR description.
- **Sources:** [`SPEC.md`](SPEC.md), [`DECISIONS.md`](DECISIONS.md) #1 (unchanged), #18–#22. Official Uniswap sources are pinned in section 0. Research notes (not accepted as INTERFACE): [PR #38 `CCA_RESEARCH.md`](https://github.com/prism-toggle-ai/FakeNews/blob/a45aecb37f7e1fdc64bed17b1391bb2f603a8ea3/docs/CCA_RESEARCH.md).
- `(draft)` means the shape may still change during implementation. Remove the mark once it settles.
- `(removed-on-cca)` is the bonding-curve surface. Do not call it from web on the `cca` branch.
- `TBD(backend)` is a question the contracts lane must answer. Do not guess a function, field, event, or error to fill it.

## 0. Pinned official sources

Read on 2026-09-26. Every external signature below is copied from these pins. If a name is not in this file, it is not in the official source we read.

| Piece | Pin | What we read |
|---|---|---|
| Continuous Clearing Auction **v2.1.0** (same as web [PR #43](https://github.com/prism-toggle-ai/FakeNews/pull/43) `35c1302`) | git tag `v2.1.0` = `a56d42231e7bf048136d9d88fa61e8518c10c5ff`. Deployments-page factory commit `7d7602d257733315434570f2a0c2f94f1c7b207a`. **Same tree** `e534d08279d7a7f6bf18ba8150eabf1cc8fa8840` — not a different version | [`IContinuousClearingAuction.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/a56d42231e7bf048136d9d88fa61e8518c10c5ff/src/interfaces/IContinuousClearingAuction.sol), [`ContinuousClearingAuctionFactory.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol). Sepolia factory address from [Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments) |
| CCALens | tag `v2.1.0` (lens source) / deployed **v2.0.0** commit `aee9bca51c92c24eb24a00d75ad98e678bac61d3` | [`CCALens.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/v2.1.0/src/lens/CCALens.sol) = `AuctionStateLens` + `TickDataLens`. Address from the CCA README Deployments table |
| LBPStrategy **v3.3.0** | commit `1c5904912aefceaceb89c24528cd5e25d0b61597` (no `v3.3.0` git tag exists) | [`IStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IStrategy.sol), [`ILBPStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/ILBPStrategy.sol), [`LBPStrategy.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol), [`MigratorParams.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol) |
| InitializerHook **v3.3.0** | source at `1c590491…`; Sepolia deploy commit `7ea523c9d75a51cb2f497be5e49bacdaeb80a342` | [`InitializerHook.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/periphery/hooks/InitializerHook.sol), [`IInitializerHook.sol`](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IInitializerHook.sol) |
| Uniswap v4 Sepolia | [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments) | PoolManager, PositionManager, Universal Router 2.1.2, StateView, Quoter, Permit2 |
| Universal Router `execute` | [`IUniversalRouter.sol` on `main`](https://github.com/Uniswap/universal-router/blob/main/contracts/interfaces/IUniversalRouter.sol) | signature only; **V4_SWAP command bytes are `TBD(backend)`** — tag `v2.1.2` was not fetchable from this environment |
| PositionManager collect actions | [`IPositionManager.sol` on `main`](https://github.com/Uniswap/v4-periphery/blob/main/src/interfaces/IPositionManager.sol) | `modifyLiquidities` only; **action-byte encoding is `TBD(backend)`** |

The CCA README at tag `v2.1.0` still lists v2.0.0 as “latest” in its own table. The official deployments page lists factory **v2.1.0** at `0x000000001F26a0044BaA66024e7b6599c61963F8` / `7d7602d`. Use that address. The git tag SHA (`a56d422`) and the deployments SHA (`7d7602d`) are two commits of the same bump; `IContinuousClearingAuction` ABI is identical.

**Cross-check vs web PR #43** (`web/src/lib/cca/abi/` at `35c1302`). External signatures that both files list **match**, including `owner` indexed on `BidSubmitted`, `BidExited`, and `TokensClaimed`. Differences that are **not** a CCA version split:

| Item | This file | PR #43 `35c1302` |
|---|---|---|
| CCA version / factory | v2.1.0 · `0x000000001F26…63F8` · tag `a56d422` / deploy `7d7602d` | same address and v2.1.0; events cited at `a56d422`, factory commit comment `7d7602d` |
| `BidSubmitted` / `BidExited` / `TokensClaimed` | `owner` indexed | `owner` indexed — same |
| `submitBid` ABI | 5-arg and 4-arg | both in `cca.ts` |
| `submitBid` demo call | use 5-arg; do not use 4-arg | `placeBid` sends the **4-arg** overload |
| CCALens `state` | not `view`; `eth_call` | same |
| LBPStrategy `migrate` | `1c590491` · `0x9543…2000` | same |
| Universal Router | **2.1.2** `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`; `V4_SWAP` bytes `TBD(backend)` | **2.0** `0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b`; `V4_SWAP` `0x10` + actions `0x06` / `0x0c` / `0x0f`. `execute(commands, inputs, deadline)` matches. Both addresses are on the official Sepolia v4 table |

## 0.1 Fixed Sepolia addresses and parameters

Verified on a Sepolia fork at block **11_784_960** in [PR #41](https://github.com/prism-toggle-ai/FakeNews/pull/41) `d84aed4` (`contracts/test/fork/CCAFork.t.sol` + `CCAForkHelpers.sol`). Forge green at 25 and 10 blocks. These rows replace the old `TBD(backend)` for the same fields.

| Item | Value | Who uses it | Source |
|---|---|---|---|
| LBPStrategy v3.3.0 | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` | Launchpad `initializeDistribution`; web `migrate` | official + #41 |
| CCA factory v2.1.0 | `0x000000001F26a0044BaA66024e7b6599c61963F8` | LBPStrategy `initializerFactory()` (already wired on chain). Launchpad does **not** call `create` | official + #41 |
| InitializerHook reference | `0x1600059B95A80d500fC42400ea9a88A9C29D2000` | Reference only. `ProphecyHook` **inherits** `InitializerHook`; `authorized()` must be the LBPStrategy above | official + #41 |
| CCALens v2.0.0 | `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | Web `state(auction)` via `eth_call` | official |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Hook, locker, fork tests | official + #41 |
| PositionManager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` | LBPStrategy mints the LP NFT here; locker holds it | official + #41 |
| Universal Router 2.1.2 | `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3` | Web v4 swap after migrate | official (see §0 vs #43) |
| StateView | `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c` | Optional pool reads | official |
| Quoter | `0x61b3f2011a92d183c7dbadbda940a7555ccf9227` | Optional quotes | official |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Not used for ETH bids | official |
| Currency | native ETH (`address(0)`) | `AuctionParameters.currency` and `MigratorParameters.currency` | **#41** |
| `N` (auction blocks) | **25** default (also green at **10**) | `endBlock = startBlock + N` | **#41** |
| Auction windows | `startBlock = block.number`; `endBlock = start + N`; `claimBlock = end`; `migrationBlock = end + 1` | Launchpad `configData` | **#41** `CCAForkHelpers._auctionWindows` |
| `auctionStepsData` | `abi.encodePacked(uint24(1e7 / N), uint40(N))` so `mps * N == 1e7`. N=25 → `(400_000, 25)`; N=10 → `(1_000_000, 10)` | `AuctionParameters.auctionStepsData` | **#41** `packUniformSteps` |
| Floor price (auction Q96) | `1000 << 96` | `AuctionParameters.floorPrice` | **#41** (`CCA_FLOOR_PRICE`) |
| Auction price tick | `100 << 96` | `AuctionParameters.tickSpacing` — **not** the v4 pool tick | **#41** (`CCA_TICK_SPACING`) |
| Graduation threshold | **0.02 ETH** (`20000000000000000` wei) | `AuctionParameters.requiredCurrencyRaised` | **#41** |
| Pool fee | **1% = `10000` pips** | `PoolParameters.fee` | **#41** |
| Pool tickSpacing | **200** | `PoolParameters.tickSpacing` | **#41** |
| First bid id | **0** | `submitBid` return / `BidSubmitted.id` | **#41** |
| `fundsRecipient` | **LBPStrategy** (`0x9543…2000`) | official `InvalidFundsRecipient` if anything else | **#41** |
| `tokensRecipient` | **protocol** (`protocolFeeRecipient`) — **never the prophet**, never LBPStrategy | unsold auction tokens via `sweepUnsoldTokens` | **#41** |
| `recipient` | **protocol** (`protocolFeeRecipient`) — **never the prophet** | unused currency / recover-on-fail | **#41** |
| Goal not reached (`raised < 0.02 ETH`) | `exitBid` refunds **full ETH**, **0 tokens**; `claimTokens` reverts `NotGraduated`; **no v4 pool** | UI **Get back unused ETH** | **#41** `test_goalNotReached_refundAndTokenSink` |
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

```solidity
constructor(address protocolFeeRecipient, address worldSigner, address ens);

// Deployer-only, once. After Launchpad, Hook (CREATE2), and Locker exist.
function setUniswap(address poolManager, address hook, address locker) external;

// Deployer-only, once. Official Sepolia LBPStrategy + PositionManager.
function setLbp(address lbpStrategy, address positionManager) external;

// Unchanged. Create a prophet name. Needs a World ID server signature. Once per nullifier.
function registerProphet(string label, uint256 nullifier, bytes serverSig) external;

// Issue a prophecy. Caller must own a prophet name.
// Mints ProphecyToken (1_000_000_000e18) to the Launchpad, writes ENS (sentence + deadline
// only on the prophecy resolver), approves LBPStrategy for `totalSupply`, then calls
// LBPStrategy.initializeDistribution(token, totalSupply, configData, salt).
// Not payable. There is no first buy.
function launch(string slug, string prophecy, uint64 deadline)
    external
    returns (address token, address auction);

// views
function auctionOf(address token) external view returns (address auction, bool poolOpened);
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
```

`initializeDistribution` **returns nothing** ([`IStrategy.sol` L29–L33](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IStrategy.sol#L29-L33)). Launchpad obtains `auction` from the official factory predict or from the strategy event in the same transaction:

```solidity
// LBPStrategy.sol L91–L94
bytes32 initializerSalt = keccak256(abi.encode(salt, migrationParams));
initializerFactory.create(token, auctionSupply, initializerParams, initializerSalt);

// factory
function getAddress(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
    external view returns (IDistributor distributor);
// CREATE2 salt inside the factory is keccak256(abi.encode(sender, salt))
// with sender = LBPStrategy
```

`TBD(backend):` exact `salt` derivation (must be unique per prophecy). `TBD(backend):` whether Launchpad also exposes a permissionless `openMarket(token)` wrapper around `LBPStrategy.migrate`, or web always calls `migrate` on the strategy. Either way web can detect the open pool from `Migrated` or `PoolManager.getSlot0`.

```solidity
event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
event Launched(
    address indexed token,
    address indexed prophet,
    address indexed auction,
    string prophetLabel,
    string slug
);
event UniswapSet(address poolManager, address hook, address locker);
event LbpSet(address lbpStrategy, address positionManager);
```

- `Launched` still does **not** contain the sentence or the deadline (DECISIONS #5).
- `registerProphet` recovers EIP-191 `personal_sign` of `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))` (section 3). `chainId` must be `block.chainid` and `launchpad` must be this contract; the signed wallet must be `msg.sender`. Label is chosen by the caller and is not in the signed payload.
- Deploy order: Launchpad, Hook (CREATE2; `authorized` = LBPStrategy), Locker (ERC-721 receiver), `setUniswap(poolManager, hook, locker)`, `setLbp(lbpStrategy, positionManager)`. A second call or a non-deployer call reverts. `launch` reverts if Uniswap or LBP is not set.
- `receive()` leftover ETH only from the locker, the PoolManager, and — `TBD(backend)` — LBPStrategy / PositionManager if migrate refunds native ETH to Launchpad as `recipient`.
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
    uint256 tickSpacing;              // 100 << 96 — NOT pool tickSpacing 200 (#41)
    address validationHook;           // address(0) = none
    uint256 floorPrice;               // 1000 << 96 (#41)
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

Write-facing names that **still** apply: `NullifierUsed`, `LabelTaken`, `AlreadyProphet`, `SlugTaken`, `InvalidSignature`, `NotProphet`, `BadSlug`, `BadProphecy`, `BadLabel`, `ZeroAddress`, `NotDeployer`, `UniswapAlreadySet`, `UniswapNotSet`, `UnknownToken`.

`registerProphet` check order stays: `NullifierUsed`, `AlreadyProphet`, `LabelTaken`, `InvalidSignature`.

`TBD(backend):` names for “LBP not set”, “auction already exists”, “not the Launchpad’s token”. Do not invent them in web until the contracts PR writes them.

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
- Official `getHookPermissions` is `beforeInitialize` only. Extra flags (e.g. `afterSwap`) are out of the 02:00 fork gate.
- Do not point `PoolParameters.hook` at the official reference hook `0x1600…2000` if we want `ProphecyHook` in the `PoolKey`. That reference address is the inherit-from sample, not our pool hook.

### `LiquidityLocker`

LBPStrategy mints a PositionManager ERC-721 and transfers it to `positionRecipient` ([`LBPStrategy.sol` L346–L363](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L346-L363)). The locker **is** that recipient.

```solidity
// Incoming NFT (official ERC-721)
function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
    external returns (bytes4);

function collect(address token) external;
function withdrawAccrued() external;

// views — names are (draft); tokenId mapping is required
function tokenIdOf(address token) external view returns (uint256 tokenId);
function prophetOf(address token) external view returns (address);
function protocolFeeRecipient() external view returns (address);
```

- `collect(address token)` can be called by anyone. Collected fees go **only** to prophet 24 : protocol 76.
- No withdraw of principal. The locker must not `transferFrom` the NFT out, and must not decrease liquidity.
- If sending ETH to the prophet fails, `collect` still pays the protocol and accrues the prophet share. The prophet later calls `withdrawAccrued()`.
- `withdrawAccrued()` sends only accrued ETH, never pool principal.
- Collect path is PositionManager `modifyLiquidities(bytes unlockData, uint256 deadline)` ([`IPositionManager.sol`](https://github.com/Uniswap/v4-periphery/blob/main/src/interfaces/IPositionManager.sol)). **Action bytes for a fees-only collect are `TBD(backend)`.**
- `(removed-on-cca)` Launchpad-only `lock(address token, address prophet, address protocolFeeRecipient, PoolKey key, uint256 tokenAmount)` that called `PoolManager.modifyLiquidity` directly. The NFT arrives from LBPStrategy, not from Launchpad.
- `TBD(backend):` how the locker learns `prophet` / `token` for a newly received `tokenId` (same-tx callback data vs Launchpad registry vs `getPoolAndPositionInfo(tokenId)`).
- `TBD(backend):` more than one NFT if `positionDefinitions` has several rows. Demo intent is one full-range position.

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
| 1 | `launchpad.auctionOf(token)` → `(address auction, bool poolOpened)` | `VITE_LAUNCHPAD_ADDRESS` |
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

First `submitBid` return / `BidSubmitted.id` is **0** ([PR #41](https://github.com/prism-toggle-ai/FakeNews/pull/41)).

```solidity
event BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount);
```

Bid revert names (official CCA): `AuctionNotStarted`, `TokensNotReceived`, `AuctionIsOver`, `BidAmountTooSmall`, `BidOwnerCannotBeZeroAddress`, `InvalidAmount`, `CurrencyIsNotNative`, `InvalidBidPriceTooHigh`, `BidMustBeAboveClearingPrice`, `AuctionSoldOut`, `InvalidBidUnableToClear`, `TickPreviousPriceInvalid`, `TickPriceNotIncreasing`, `TickPriceNotAtBoundary`, `TickNotInitialized`, `InvalidTickPrice`, `TickHintMustBeGreaterThanNextActiveTickPrice`.

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

Exit / refund revert names: `AuctionIsNotOver`, `BidAlreadyExited`, `CannotExitBid`, `CannotPartiallyExitBidBeforeGraduation`, `CannotPartiallyExitBidBeforeEndBlock`, `InvalidLastFullyFilledCheckpointHint`, `InvalidOutbidBlockCheckpointHint`, `BidIdDoesNotExist`.

Claim revert names: `NotClaimable`, `AuctionIsNotFinalized`, `NotGraduated`, `BidNotExited`, `BatchClaimDifferentOwner`, `BidIdDoesNotExist`.

Demo: prefer a bid strictly above final clearing so the UI can `exitBid` without partial-exit hints.

#### If the auction ends below 0.02 ETH (`requiredCurrencyRaised`)

**Yes — every bid is fully refunded. 0 tokens. No pool.** Official source, and observed on the Sepolia fork in [PR #41](https://github.com/prism-toggle-ai/FakeNews/pull/41) `d84aed4` `test_goalNotReached_refundAndTokenSink` (raised 0.01 ETH):

- Graduation rule: `currencyRaised >= requiredCurrencyRaised`. “If the auction never graduates, bidders can refund their full bid amount via `exitBid` and all tokens are returned to the tokens recipient.” ([TechnicalDocumentation.md — Protocol Overview](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#protocol-overview), pin `7d7602d`)
- Implementation: `exitBid` after `endBlock` — if `!_isGraduated()`, it `_processExit(_bidId, 0, 0)` (zero tokens filled, full currency back). Comment: “Fully refund the bid if the auction did not graduate, since it is over.” ([`ContinuousClearingAuction.sol` L495–L501](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L495-L501))
- Fork (#41): `exitBid` refunds the **full ETH**; bidder token balance stays **0**. `claimTokens` **reverts `NotGraduated`**. `sweepUnsoldTokens` sends the auction supply to protocol. `LBPStrategy.migrate` does **not** revert: `tryMigrate` fails `NotGraduated`, then the strategy recovers the LP reserve to `recipient` (`FundsRecovered` + `MigrationFailed`). **No v4 pool** is opened.
- `exitPartiallyFilledBid` after `endBlock` does the same full refund when not graduated ([L525–L529](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L525-L529)). Prefer `exitBid` in the UI (label: **Get back unused ETH**).

UI copy for this state: **Get back unused ETH** → `exitBid(bidId)` on the CCA.

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

If `tryMigrate` reverts, official `migrate` recovers currency + reserved tokens to `recipient` and does **not** create a pool. That `recipient` is protocol / Launchpad, not the prophet.

Migrate revert names (official): `MigrationNotYetAllowed`, `InitializerNotRegistered`, `PoolManagerAlreadyUnlocked`, plus the `tryMigrate` names (`CurrencyRaisedMismatch`, `NoPositionsCreated`, `OnlySelfCall`). A failed attempt emits `MigrationFailed` and `FundsRecovered` instead of reverting the outer `migrate`.

Pool key after success: native ETH (`address(0)`), `token`, fee `10000`, tickSpacing `200`, hooks = `ProphecyHook`. `poolId = keccak256(abi.encode(key))`.

### 4.7 v4 swap

Address: Universal Router 2.1.2 `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3`.

```solidity
function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
error ExecutionFailed(uint256 commandIndex, bytes message);
error TransactionDeadlinePassed();
error LengthMismatch();
```

`TBD(backend):` the exact `commands` byte and `inputs` encoding for a native-ETH ↔ token v4 swap on this router version. Do not invent `V4_SWAP` command ids in web until the contracts / web PR copies them from the official Universal Router `Commands.sol` at the 2.1.2 pin. Fork tests may use the official Sepolia `PoolSwapTest` `0x9b6b46e2c869aa39918db7f52f5557fe577b6eee` as a harness-only caller; that is not the product ABI.

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
4. `new LiquidityLocker(…)` — must be an ERC-721 receiver. `TBD(backend):` exact constructor args.
5. `launchpad.setUniswap(poolManager, hook, locker)` once.
6. `launchpad.setLbp(0x95434E898Af471945Cab33D5064d2aC1A6Ba2000, 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4)`. Require the views match.

`ENS_ADAPTER_ADDRESS` / `TEAM_WALLET` / parent-lock rules stay as on `main`. Parent lock is not part of this deploy.

## 6. Curve quote vectors `(removed-on-cca)`

Bonding-curve quote vectors (`contracts/test/Curve.vectors.json`, `web/src/lib/Curve.vectors.json`) are unused on this branch. Do not re-derive them. A later contracts PR deletes the callers; this file does not edit those files.

## 7. Auction UI states, designer copy, and revert names

CCA has no `getState()` enum. The UI derives a label from blocks + views. Departed (`now >= deadline` from ENS) is independent of these labels.

`block` is the chain’s block-numberish. Sepolia is 12s blocks. 25 blocks is five minutes at that pace.

Designer draft copy (use these strings; English; no returns / profit / prediction / “coin” / percent price change):

| Surface | Copy |
|---|---|
| Live countdown | `Auction live · ends in {blocks} blocks` |
| Price while live | `Current clearing price` |
| Price after `endBlock` | `Final clearing price` |
| Threshold progress | `{raised} of 0.02 ETH raised to open the market` |
| Bid budget field | `Budget (ETH)` → `submitBid` `amount` / `msg.value` |
| Bid max-price field | `Max price per token (ETH)` → `submitBid` `maxPriceQ96` (UI ETH × 2^96) |
| Bid submit | `Place bid` |
| Claim | `Claim tokens` → `claimTokens` |
| Leftover / failed-auction refund | `Get back unused ETH` → `exitBid` |
| Migrate | `Open market` → `LBPStrategy.migrate` |

| UI state | Detect on-chain | User can | Copy |
|---|---|---|---|
| **Not funded** | No `TokensReceived`; `submitBid` would revert `TokensNotReceived`. After a successful `launch` this should not appear (strategy calls `onTokensReceived`) | Nothing | — |
| **Not started** | Funded, `block < startBlock()` | Wait. Bid reverts `AuctionNotStarted` | — |
| **Live** | Funded, `startBlock() <= block < endBlock()` | `Place bid`. Price from `clearingPrice()` or CCALens `state(auction)` | `Auction live · ends in {endBlock - block} blocks`. `Current clearing price`. `{raised} of 0.02 ETH raised to open the market` |
| **Sold out (still live)** | `block < endBlock()` but next `submitBid` reverts `AuctionSoldOut` | Wait for end, then exit / claim if graduated | countdown still live |
| **Ended, not finalized** | `block >= endBlock()` and `lastCheckpointedBlock() != endBlock()` | Anyone `checkpoint()` | `Final clearing price` after checkpoint |
| **Ended, graduated** | `block >= endBlock()`, `isGraduated() == true` after a current checkpoint | `Get back unused ETH` / then `Claim tokens` | `Final clearing price`. `{raised} of 0.02 ETH raised to open the market` |
| **Ended, failed** | `block >= endBlock()` and `isGraduated() == false` after a final checkpoint | **Get back unused ETH** (`exitBid` — full refund, section 4.5). `claimTokens` reverts `NotGraduated`. `migrate` will not open a pool | `{raised} of 0.02 ETH raised to open the market` |
| **Claimable** | Graduated and `block >= claimBlock()` and `bid.exitedBlock != 0` | `Claim tokens` | — |
| **Claim blocked** | Graduated but `block < claimBlock()` | Exit after end; claim reverts `NotClaimable` | — |
| **Migratable** | Graduated and `block >= migrationBlock` and no `Migrated` yet | `Open market` | — |
| **Pool open** | `Migrated` for that initializer, or `auctionOf.poolOpened`, or `slot0 != 0` | v4 swap (section 4.7) | — |

Create-time revert names (factory / constructor, prophet sees these on `launch`): `InvalidTokenAmount`, `InvalidEndBlock`, `ClaimBlockIsBeforeEndBlock`, `InvalidAuctionDataLength`, `StepBlockDeltaCannotBeZero`, `InvalidStepDataMps`, `InvalidEndBlockGivenStepData`, `FloorPriceIsZero`, `FloorPriceTooLow`, `TickSpacingTooSmall`, `FloorPriceAndTickSpacingGreaterThanMaxBidPrice`, `FloorPriceAndTickSpacingTooLarge`, `TotalSupplyIsZero`, `TotalSupplyIsTooLarge`, `TokenIsAddressZero`, `TokenAndCurrencyCannotBeTheSame`, `FundsRecipientIsZero`, `TokensRecipientIsZero`.

## 8. Four fork-test steps (02:00 KST gate)

**Canonical sequence:** [PR #41](https://github.com/prism-toggle-ai/FakeNews/pull/41) `d84aed4` [`contracts/test/fork/CCAFork.t.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/d84aed4c327f8b2f169c92b2726f7a2d1c092fb8/contracts/test/fork/CCAFork.t.sol) `_runHappyPath` (25 and 10 blocks) plus `test_goalNotReached_refundAndTokenSink`. Pin `vm.createSelectFork(rpc, 11_784_960)`. Helpers: `CCAForkHelpers.sol`. That suite talks to official LBPStrategy / CCA directly (no Launchpad). A later Launchpad fork wraps step 1 with `launch`.

| # | Step | Calls (as in #41) | Pass when |
|---|---|---|---|
| 1 | Create auction | `initializeDistribution` → factory `create` + `onTokensReceived` | Auction code at the predicted address. `fundsRecipient == LBPStrategy`, `tokensRecipient` and `recipient` are protocol, not the prophet |
| 2 | Bid | 5-arg `submitBid{value: amount}(maxPrice, amount, owner, prevTick, "")`. First `bidId` is **0**. Hint: `maxPrice = floor + n * tick`, `prevTick = floor + (n-1) * tick` | `BidSubmitted`. Raised demand ≥ 0.02 ETH for the happy path |
| 3 | Settle + open market | `vm.roll` to `endBlock`, `checkpoint()`, `exitBid` (unused ETH), `claimTokens`. Then `vm.roll` to `endBlock + 1`, `LBPStrategy.migrate(auction)` | `isGraduated() == true`. `PoolManager.getSlot0(poolId)` non-zero. Fee 10000, tickSpacing 200 |
| 4 | Swap | After (3), one ETH→token swap (`PoolSwapTest` in #41; product may use Universal Router once command bytes are set) | Token balance of the trader moves |

Goal not reached is the same file, not a fifth happy-path step: `exitBid` full ETH / 0 tokens; `claimTokens` reverts `NotGraduated`; no pool (section 4.5).

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

Copy these into the contracts PR. Do not invent answers here.

1. `salt` derivation for `initializeDistribution` (unique per prophecy; included in `initializerSalt = keccak256(abi.encode(salt, migrationParams))`). #41’s harness salt is not the product salt.
2. ~~`floorPrice` / auction `tickSpacing`~~ → section 0.1 (`1000 << 96` / `100 << 96`) from #41.
3. ~~`auctionStepsData`~~ → section 0.1 (`abi.encodePacked(uint24(1e7/N), uint40(N))`) from #41.
4. ~~`startBlock`~~ → `block.number` from #41.
5. ~~`claimBlock` / `migrationBlock`~~ → `end` / `end + 1` from #41.
6. `reservedTokenAmountForLP` and therefore auction supply (`totalSupply - reserved`). Former SPEC split 206.9M / 793.1M is **not** decided for CCA (#7 is superseded). #41’s spike used `800e18` / `200e18` on a `1000e18` test token — not the 1B product mint.
7. Exact `positionDefinitions` / `lpAllocationSchedule` encodings. #41 used empty `PositionDefinition[]` (implicit full-range) and one bracket `{0, 1e7}`. Still confirm for the 1B Launchpad mint.
8. ~~`tokensRecipient` / `recipient`~~ → **protocol** (never the prophet) from #41.
9. Whether Launchpad wraps `migrate` (`openMarket`) or web always calls the strategy.
10. How `auctionOf(token).poolOpened` is set if web calls `migrate` directly.
11. New Launchpad custom-error names (`LbpNotSet` and the like).
12. `LiquidityLocker` constructor and how it binds `tokenId` → token / prophet.
13. PositionManager action bytes for fees-only `collect` (no liquidity decrease).
14. Universal Router 2.1.2 `V4_SWAP` command + inputs encoding.
15. Whether `receive()` must accept ETH from LBPStrategy / PositionManager when Launchpad is `recipient`.
16. Hook CREATE2 flags if any permission besides `BEFORE_INITIALIZE` is added.

## 11. Copy (user-facing)

English only. No wording about returns, profit, or prediction. No “coin”. No percent price change. The price says people are here, not that the sentence is true (DECISIONS #1).
