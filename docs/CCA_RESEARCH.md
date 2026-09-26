# CCA research (Sepolia)

Research-only. No contracts, web, scripts, or workflows were changed.

**Network:** Ethereum Sepolia, chain id `11155111` (`0xaa36a7`).
**Read on:** 2026-09-26.
**Rule:** every claim cites a source. If it cannot be verified, it says `UNVERIFIED`.

Official starting points:

- [Uniswap/continuous-clearing-auction](https://github.com/Uniswap/continuous-clearing-auction)
- [Uniswap/liquidity-launcher](https://github.com/Uniswap/liquidity-launcher)
- [docs.uniswap.org — Continuous Clearing Auction](https://docs.uniswap.org/contracts/liquidity-launchpad/CCA)
- [developers.uniswap.org — Liquidity Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments)
- [docs.uniswap.org — Uniswap v4 deployments](https://docs.uniswap.org/contracts/v4/deployments)

Recommended integration path for Prophecy is **Path A** in section 3: use the official CCA factory as a standalone auction, then let our Launchpad initialize the v4 pool and lock LP in our `LiquidityLocker`. Do not send the official `LBPStrategy` a `ProphecyHook` address.

---

## 1. Is an official CCA factory deployed on Sepolia?

**Yes.** The official Continuous Clearing Auction factory **v2.1.0** is deployed on Sepolia at a canonical address, and runtime bytecode is present.

| Version | Address | Commit | Source | Sepolia bytecode (2026-09-26) |
|---|---|---|---|---|
| **v2.1.0 (recommended)** | `0x000000001F26a0044BaA66024e7b6599c61963F8` | `7d7602d257733315434570f2a0c2f94f1c7b207a` | [CCA README Deployments](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/README.md#continuousclearingauctionfactory); [Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments) | `eth_getCode` on `https://ethereum-sepolia-rpc.publicnode.com` returned **24,215 bytes** (`len=48430` hex chars). `eth_chainId` = `0xaa36a7` |
| v2.0.0 | `0x00cCa200BF124dBfA848937c553864f4B4CE0632` | `aee9bca51c92c24eb24a00d75ad98e678bac61d3` | same README / docs table | bytecode present (`len=48250`) |
| v1.1.0 (do not integrate) | `0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5` | `8508f332c3daf330b189290b335fd9da4e95f3f0` | [v1.1.0 changelog table](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/CHANGELOG.md#deployment-addresses) | bytecode present (`len=44630`) |
| v1.0.0-candidate (do not integrate) | `0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D` | `154fd189022858707837112943c09346869c964f` | same changelog | bytecode present (`len=49062`) |

Related Sepolia contracts that also have bytecode:

| Contract | Address | Source | Bytecode |
|---|---|---|---|
| CCALens v2.0.0 | `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | [CCA README CCALens](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/README.md#ccalens) | present (`len=7488`) |
| LiquidityLauncher v3.2.0 | `0x0000FffFBE8efE702c8703aE3477FF5dE3d319C0` | [Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments) | present (`len=8256`) |
| LBPStrategy v3.3.0 (Sepolia) | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` | same page, LBPStrategy / Current | present (`len=42484`) |
| InitializerHook v3.3.0 (Sepolia) | `0x1600059B95A80d500fC42400ea9a88A9C29D2000` | same page, InitializerHook | present (`len=6210`) |
| Uniswap v4 PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | [v4 deployments — Sepolia](https://docs.uniswap.org/contracts/v4/deployments); our [`SepoliaConfig.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/script/SepoliaConfig.sol#L19-L22) | present (`len=48020`) |
| Uniswap v4 PositionManager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` | [v4 deployments — Sepolia](https://docs.uniswap.org/contracts/v4/deployments) | present (`len=47756`) |

Official docs say versions before v2.0.0 should not be used ([Launchpad deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments)). v2.1.0 is the recommended production factory ([CCA README](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/README.md#continuousclearingauctionfactory)).

Etherscan address pages (HTML was Cloudflare-blocked from this environment, so **contract-name verification on Etherscan is UNVERIFIED**; bytecode existence is from the public RPC above):

- https://sepolia.etherscan.io/address/0x000000001F26a0044BaA66024e7b6599c61963F8
- https://sepolia.etherscan.io/address/0x95434E898Af471945Cab33D5064d2aC1A6Ba2000
- https://sepolia.etherscan.io/address/0xE03A1074c86CFeDd5C142C4F04F1a1536e203543
- https://sepolia.etherscan.io/address/0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4

### On-chain wiring we read (not guessed)

`eth_call` on Sepolia (`ethereum-sepolia-rpc.publicnode.com`, `eth_chainId` = `0xaa36a7`):

| Call | Result | Meaning |
|---|---|---|
| CCA factory v2.1 `protocolFeeController()` | `address(0)` | Official factory was deployed with a zero controller. Fees are off. Matches the deploy script default `vm.envOr('PROTOCOL_FEE_CONTROLLER', address(0))` ([DeployContinuousAuctionFactory.s.sol L15](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/script/deploy/DeployContinuousAuctionFactory.s.sol#L15)) and the docs note that `address(0)` disables fees ([TechnicalDocumentation — Protocol Fees](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#protocol-fees)) |
| LBPStrategy v3.3 `initializerFactory()` | `0x000000001F26a0044BaA66024e7b6599c61963F8` | Official Sepolia LBP strategy creates auctions through CCA factory v2.1.0 |
| LBPStrategy v3.3 `poolManager()` | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Same PoolManager as v4 docs and our `SepoliaConfig` |
| LBPStrategy v3.3 `positionManager()` | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` | Same PositionManager as v4 docs |
| InitializerHook v3.3 `authorized()` | `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` | Official hook only lets LBPStrategy initialize |
| InitializerHook v3.3 `poolManager()` | official Sepolia PoolManager | Same manager |

Selector sources: `protocolFeeController()` = `0xf02de3b2`, `initializerFactory()` = `0x06d9d915`, `positionManager()` = `0x791b98bc`, `poolManager()` = `0xdc4c90d3`, `authorized()` = `0x456cb7c6` (keccak of the Solidity signatures).

### Can we deploy the factory ourselves?

**Yes, but we do not need to** for Sepolia. The official v2.1.0 factory is already there and is what LBPStrategy v3.3.0 points at.

If a person still wanted a private factory (different fee controller):

| Item | Value | Source |
|---|---|---|
| License | MIT | [LICENSE](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/LICENSE); README “All contracts are MIT licensed” |
| solc | `0.8.26` | [foundry.toml](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/foundry.toml#L8) |
| Factory via-IR | `ContinuousClearingAuctionFactory.sol` is restricted to `via_ir = true` | [foundry.toml compilation_restrictions](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/foundry.toml#L34-L36) |
| Constructor | `constructor(address _protocolFeeController)` | [ContinuousClearingAuctionFactory.sol L20-L22](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol#L20-L22) |
| Script | `PROTOCOL_FEE_CONTROLLER=… forge script script/deploy/DeployContinuousAuctionFactory.s.sol` | [DeploymentGuide.md](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/DeploymentGuide.md#factory-deployment) |
| Dependencies | forge-std, OpenZeppelin, solady, permit2, v4-periphery, liquidity-launcher, blocknumberish | [foundry.toml remappings](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/foundry.toml#L17-L29) |
| CREATE2 salt in the official script | `0x7cda7b6c72c517bc1804d9125be10523051a786205580a090d6bb55697b8acf1` | [DeployContinuousAuctionFactory.s.sol L24](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/script/deploy/DeployContinuousAuctionFactory.s.sol#L24) |
| Rough gas | **UNVERIFIED** — no official gas snapshot was found for factory deploy. Runtime size of the official v2.1 factory is 24,215 bytes (RPC above). A person would dry-run with Foundry; agents do not `--broadcast` ([AGENTS.md](../AGENTS.md)) | |

Docs mismatch (do not follow the stale page for the function name or constructor):

- [developers.uniswap.org deployments](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments) still says the factory “has no constructor parameters”.
- v2.0.0+ source **does** take `_protocolFeeController` ([CHANGELOG v2.0.0](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/CHANGELOG.md#changed), [factory L20-L22](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol#L20-L22)).
- Same-address-across-chains still works: the official script deploys with CREATE2 and defaults the controller to `address(0)`.

---

## 2. Exact signatures: create, bid, settle, migrate

### 2.1 Create an auction

**v2.1.0 factory name is `create`, not `initializeDistribution`.** The rename is a breaking v2 change ([CHANGELOG #356](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/CHANGELOG.md#changed)). The v2.1 DeploymentGuide snippet that still shows `initializeDistribution` is stale relative to the source.

```solidity
function create(address token, uint256 amount, bytes calldata configData, bytes32 salt)
    external
    returns (IDistributor distributor);

function getAddress(address token, uint256 amount, bytes calldata configData, bytes32 salt, address sender)
    external
    view
    returns (IDistributor distributor);

event AuctionCreated(address indexed auction, address indexed token, uint256 amount, bytes configData);
```

Sources: [IDistributorFactory.sol L15-L29](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IDistributorFactory.sol#L15-L29); [ContinuousClearingAuctionFactory.sol L25-L46](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol#L25-L46); [IContinuousClearingAuctionFactory.sol](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuctionFactory.sol).

`configData` is `abi.encode(AuctionParameters)` ([DeploymentGuide](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/DeploymentGuide.md#deploying-via-factory); [factory L31](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol#L31)):

```solidity
struct AuctionParameters {
    address currency;                 // address(0) = ETH
    address tokensRecipient;          // leftover / unsold tokens
    address fundsRecipient;           // raised currency (net of protocol fee)
    uint64 startBlock;
    uint64 endBlock;
    uint64 claimBlock;
    uint256 tickSpacing;              // Q96 price granularity
    address validationHook;           // optional; address(0) = none
    uint256 floorPrice;               // Q96
    uint128 requiredCurrencyRaised;   // graduation threshold
    bytes auctionStepsData;           // packed issuance schedule
}
```

Source: [IContinuousClearingAuction.sol L17-L29](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L17-L29).

`token` and `amount` (`uint128` max, else `InvalidTokenAmount`) are constructor arguments, not struct fields ([factory L29](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol#L29); auction constructor [ContinuousClearingAuction.sol L63-L68](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L63-L68)).

`address(1)` for `tokensRecipient` or `fundsRecipient` is rewritten to `msg.sender` ([factory L32-L35](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol#L32-L35)).

**The factory does not pull tokens.** It only CREATE2-deploys the auction. The caller must then transfer `amount` of `token` to the auction and call `onTokensReceived()` ([IDistributor.sol L6-L19](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IDistributor.sol#L6-L19); [DeploymentGuide — Post deployment](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/DeploymentGuide.md#post-deployment); [ContinuousClearingAuction.sol L119-L129](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L119-L129)). Bids revert with `TokensNotReceived` until that happens ([L106-L108](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L106-L108)).

Auction steps: each step is a packed `uint64` — 24 bits MPS (1e7 = 100% of auction supply) + 40 bits block count ([TechnicalDocumentation — Auction steps](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#auction-steps-supply-issuance-schedule)).

Direct constructor (no factory) is also supported ([DeploymentGuide — Deploying via Constructor](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/DeploymentGuide.md#deploying-via-constructor)):

```solidity
constructor(address token, uint128 amount, AuctionParameters memory parameters, address protocolFeeController);
```

### 2.2 Bidding

```solidity
function submitBid(
    uint256 maxPriceQ96,
    uint128 amount,
    address owner,
    uint256 prevTickPriceQ96,
    bytes calldata hookData
) external payable returns (uint256 bidId);

function submitBid(uint256 maxPriceQ96, uint128 amount, address owner, bytes calldata hookData)
    external payable returns (uint256 bidId); // scans from floor; gas-heavy
```

Sources: [IContinuousClearingAuction.sol L137-L157](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L137-L157); implementation [ContinuousClearingAuction.sol L466-L496](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L466-L496).

| Currency | How the bid is paid | Source |
|---|---|---|
| ETH (`currency == address(0)`) | `msg.value` must equal `amount` | [L479-L480](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L479-L480) |
| ERC-20 | `msg.value` must be 0; tokens pulled with **Permit2** `permit2TransferFrom` | [L481-L483](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L481-L483) |

Rules: auction must be active (`block >= startBlock`, tokens received); `block < endBlock`; `amount > 0`; `owner != 0`; `maxPriceQ96` strictly above current clearing price and `<= MAX_BID_PRICE`; optional validation hook must not revert ([L466-L496](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L466-L496), [L343-L395](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L343-L395)).

```solidity
event BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount);
```

[IContinuousClearingAuction.sol L99-L104](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L99-L104).

There is **no sell** during the auction. To leave, the bidder **exits** (refund leftover currency; record tokens filled) then **claims** tokens after `claimBlock`.

### 2.3 Checkpoint, exit, claim, sweep

```solidity
function checkpoint() external returns (Checkpoint memory);
function forceIterateOverTicks(uint256 untilTickPriceQ96) external returns (uint256);
function clearingPrice() external view returns (uint256);
function isGraduated() external view returns (bool); // currencyRaised >= requiredCurrencyRaised

function exitBid(uint256 bidId) external;
function exitPartiallyFilledBid(uint256 bidId, uint64 lastFullyFilledCheckpointBlock, uint64 outbidBlock) external;

function claimTokens(uint256 bidId) external;
function claimTokensBatch(address owner, uint256[] calldata bidIds) external;

function sweepCurrency() external;      // only fundsRecipient, after end
function sweepUnsoldTokens() external;  // only tokensRecipient, after end

function lbpInitializationParams() external view returns (LBPInitializationParams memory);
```

Sources: [IContinuousClearingAuction.sol L163-L244](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L163-L244); [TechnicalDocumentation — Contract Entrypoints](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#auction-entrypoints).

Events:

```solidity
event TokensReceived(uint128 totalSupply);
event CheckpointUpdated(uint256 blockNumber, uint256 clearingPriceQ96, uint24 cumulativeMps);
event ClearingPriceUpdated(uint256 blockNumber, uint256 clearingPriceQ96);
event BidExited(uint256 indexed bidId, address indexed owner, uint256 tokensFilled, uint256 currencyRefunded);
event TokensClaimed(uint256 indexed bidId, address indexed owner, uint256 tokensFilled);
```

[IContinuousClearingAuction.sol L96-L128](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L96-L128).

Exit / claim rules (same technical doc + implementation):

- No exit before graduation, except a full refund after a failed auction ([L502-L514](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L502-L514), [L528-L536](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L528-L536)).
- `exitBid`: after end; bid max price strictly **above** final clearing price. Refunds unspent currency immediately ([L502-L519](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L502-L519)).
- `exitPartiallyFilledBid`: needs checkpoint hints. `outbidBlock = 0` means “still at the clearing price at the end” ([L521-L604](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L521-L604)).
- `claimTokens` / `claimTokensBatch`: after `claimBlock`, auction graduated, bid already exited. Anyone may call; tokens go to the bid owner ([L607-L646](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L607-L646)).
- `sweepCurrency`: only `fundsRecipient`. Sends protocol fee (0 on the official Sepolia factory) then net proceeds. One-shot ([L663-L687](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L663-L687)).
- `sweepUnsoldTokens`: only `tokensRecipient`. Graduated → remaining supply; not graduated → full `totalSupply` ([L690-L704](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L690-L704)).
- `lbpInitializationParams()`: requires end-block checkpoint and graduation; returns `{initialPriceX96, tokensSold, currencyRaised}` with `currencyRaised` **net of protocol fee** ([L135-L150](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L135-L150); [ILBPInitializer.sol L12-L16](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/ILBPInitializer.sol#L12-L16)).

### 2.4 Official LBP / liquidity-launcher migration

Yes. Official path is **LBPStrategy**, not a separate “CCA migrator”.

Flow ([TechnicalReference — LBPStrategy](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/docs/TechnicalReference.md#lbpstrategy) and [Typical Launch Flow](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/docs/TechnicalReference.md#typical-launch-flow)):

1. `LiquidityLauncher.distributeToken` → `LBPStrategy.initializeDistribution(token, totalSupply, configData, salt)`.
2. `configData` = `abi.encode(MigratorParameters, bytes initializerParams)` where `initializerParams` is the CCA `AuctionParameters`.
3. Strategy deploys the auction via `initializerFactory.create(...)`, pulls tokens, sends auction supply to the CCA, keeps `reservedTokenAmountForLP`, calls `onTokensReceived()` ([LBPStrategy.sol L68-L148](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L68-L148)).
4. After `migrationBlock` (must be **after** `endBlock`), anyone calls `migrate(initializer)` ([ILBPStrategy.sol L142-L143](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/ILBPStrategy.sol#L138-L143); [LBPStrategy.sol L217-L274](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L217-L274)).
5. `tryMigrate` sweeps currency from the auction (strategy **must** be `fundsRecipient`), reads `lbpInitializationParams()`, initializes the v4 pool at the clearing price, mints positions through **PositionManager.modifyLiquidities**, transfers each LP **NFT** to `positionRecipient` (or per-position `overridePositionRecipient`) ([L152-L214](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L152-L214), [L346-L363](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L346-L363); [MigratorParameters.positionRecipient](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol#L21-L31)).

```solidity
function initializeDistribution(address token, uint256 totalSupply, bytes calldata configData, bytes32 salt) external;
function migrate(ILBPInitializer initializer) external;

event InitializerCreated(ILBPInitializer indexed initializer, MigratorParameters migrationParams);
event Migrated(ILBPInitializer indexed initializer, PoolKey indexed key, uint160 initialSqrtPriceX96, bytes plan);
```

[IStrategy.sol L29-L30](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IStrategy.sol#L29-L30); [ILBPStrategy.sol L18-L25, L142-L143](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/ILBPStrategy.sol#L18-L25).

**Who owns the LP?** The PositionManager NFT holder: default `MigratorParameters.positionRecipient`. The strategy does **not** keep the position. Unused currency / unused reserved tokens go to `recipient`. Unsold auction tokens stay in the CCA until `tokensRecipient` calls `sweepUnsoldTokens` ([TechnicalReference step 3](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/docs/TechnicalReference.md#3-migration-to-uniswap-v4); [LBPStrategy L373-L384](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L373-L384)).

If `tryMigrate` reverts, `migrate` recovers currency + reserved tokens to `recipient` and does **not** create a pool ([L260-L273](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L260-L273)).

Hook rule for official LBP: any nonzero `poolParameters.hook` **must** inherit `InitializerHook`, implement `IInitializerHook` (ERC165), have `authorized() == LBPStrategy`, and include the `BEFORE_INITIALIZE` flag ([MigratorParams.validateHook](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol#L143-L158); [TechnicalReference — LBP Hook Requirement](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/docs/TechnicalReference.md#lbp-hook-requirement); [InitializerHook.sol](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/periphery/hooks/InitializerHook.sol)). `hook = address(0)` is allowed only for static-fee pools and may fall back to the strategy address as the hook.

---

## 3. Can our Hook and Locker attach?

**Not as a drop-in to official LBPStrategy.** They can stay if we migrate ourselves (Path A).

### How graduation works today

On the last bonding-curve buy, `Launchpad._graduate`:

1. Builds `PoolKey{currency0: ETH, currency1: token, fee: 10000, tickSpacing: 200, hooks: ProphecyHook}`.
2. Calls `poolManager.initialize` (so the hook sees `sender == Launchpad`).
3. Approves the locker and `locker.lock{value: realEth}(token, prophet, protocolFeeRecipient, key, LP_SUPPLY)`.
4. Burns leftover tokens to `0x…dEaD`.

Sources: [Launchpad.sol L399-L425](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/Launchpad.sol#L399-L425); [Graduation.sol L34-L51](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/Graduation.sol#L34-L51).

`ProphecyHook.beforeInitialize` allows only the Launchpad ([ProphecyHook.sol L45-L48](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/ProphecyHook.sol#L45-L48)). Permissions are `beforeInitialize` only ([L26-L43](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/ProphecyHook.sol#L26-L43)). No ERC165, no `authorized()`, no `IInitializerHook`.

`LiquidityLocker.lock` is Launchpad-only. It does **not** use PositionManager. It `modifyLiquidity` on PoolManager and stores the position by salt. `collect` also uses `modifyLiquidity` with `liquidityDelta = 0` ([LiquidityLocker.sol L98-L134, L185-L194, L205-L214](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/LiquidityLocker.sol#L98-L134)). No `onERC721Received`. Leftover seed ETH is refunded to the Launchpad ([L266-L276](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/LiquidityLocker.sol#L266-L276)).

### Path A — recommended: standalone CCA + our graduate

| Step | Who | What must change |
|---|---|---|
| Mint token | Launchpad (already) | Still mint 1e9 × 1e18 to Launchpad ([ProphecyToken.sol L21-L26](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/ProphecyToken.sol#L21-L26)) |
| Create auction | Launchpad calls official factory `create` | New. `fundsRecipient` and `tokensRecipient` = Launchpad (or `address(1)` so the factory rewrites to the caller) |
| Fund auction | Launchpad `transfer` + `onTokensReceived` | New. Send auction supply (today’s `CURVE_SUPPLY` or another split). Keep LP reserve on Launchpad |
| Bid / exit / claim | Frontend → CCA | New UI. Launchpad does not need wrappers |
| After `endBlock` | Launchpad `sweepCurrency` + `sweepUnsoldTokens` | New. Only Launchpad can sweep |
| Open pool | Launchpad `initialize` + `locker.lock` | Keep Hook + Locker. Price source becomes `lbpInitializationParams().initialPriceX96` (currency per token, Q96), **not** virtual-reserve `vEth/vToken`. `Graduation.sqrtPriceX96FromVirtualReserves` must be replaced or wrapped |
| Hook | unchanged | Still requires `sender == Launchpad`. Path A preserves that |
| Locker | unchanged call shape | Still Launchpad-only `lock`. Position is **not** a PositionManager NFT |

What must change in code (later PR, not this one): remove `buy` / `sell` / quotes / `Curve` storage; `launch` starts an auction instead of a curve; add `graduate(token)` (or equivalent) after the auction; web reads `auctionOf` + CCA events instead of `curve` / `Trade`.

### Path B — official LBPStrategy

This path **cannot** keep today’s Hook and Locker without rewriting both.

| Constraint | Why it breaks us | Source |
|---|---|---|
| Hook must inherit `InitializerHook` | `ProphecyHook` does not, has no ERC165 / `authorized()` | [MigratorParams.validateHook](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/libraries/MigratorParams.sol#L143-L158) |
| `authorized()` must be LBPStrategy | Our hook authorizes Launchpad | [InitializerHook.sol L20-L55](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/periphery/hooks/InitializerHook.sol#L20-L55); live Sepolia hook `authorized()` = LBPStrategy (RPC above) |
| Strategy initializes the pool | Hook would see `sender == LBPStrategy` and revert `NotLaunchpad` | [LBPStrategy._initializePool](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L331-L337); [ProphecyHook L47](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/ProphecyHook.sol#L47) |
| `fundsRecipient` must be the strategy | Path A wants Launchpad to sweep | [LBPStrategy L373-L380](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L373-L380) |
| LP is a PositionManager NFT | Locker has no ERC-721 receiver and `collect` is PoolManager-native | [LBPStrategy L346-L363](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L346-L363); [LiquidityLocker L185-L214](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/LiquidityLocker.sol#L185-L214) |
| Setting `positionRecipient = Locker` does not lock principal | Locker never takes the NFT; anyone who received it could transfer it unless we rewrite Locker | same |

Using the official Sepolia `InitializerHook` (`0x1600…2000`) would initialize a pool with **that** hook, not `ProphecyHook`, and only LBPStrategy may initialize it (RPC `authorized()`).

---

## 4. Compatibility constraints

### Token

| Constraint | Our token | Source |
|---|---|---|
| Standard ERC-20; fee-on-transfer and rebasing unsupported | `ProphecyToken` is a plain 18-decimal ERC-20 | [TechnicalDocumentation — FOT](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#limitations-with-low-decimal-tokens-or-fee-on-transfer-tokens); [ProphecyToken.sol](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/ProphecyToken.sol) |
| Do not use decimals &lt; 6 | 18 | same technical doc |
| Auction `amount` ≤ `type(uint128).max` | 1e9 × 1e18 = 1e27 &lt; 2^128−1 | [factory L29](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuctionFactory.sol#L29) |
| Max sellable supply `2^100` wei (~1e30) | 1e27 is inside | [TechnicalDocumentation — Bounds](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#bounds-on-maximum-bid-prices); [MaxBidPriceLib.sol L64](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/libraries/MaxBidPriceLib.sol#L64) |
| Mint / approve | Factory: transfer to auction, then `onTokensReceived`. LBPStrategy: approve strategy for full `totalSupply`; it pulls | [IDistributor](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IDistributor.sol); [LBPStrategy L68-L116](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/strategies/lbp/LBPStrategy.sol#L68-L116) |
| Extra tokens sent to the auction are not recoverable | Do not transfer more than `amount` | [TechnicalDocumentation — Extra funds](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#extra-funds-sent-to-the-auction-are-not-recoverable) |
| `token` rejects `address(0)` | Our burn sink is `0x…dEaD`, already | [ProphecyToken.sol L50-L51](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/ProphecyToken.sol#L50-L51) |

### Prices and schedule

| Constraint | Source |
|---|---|
| Floor price ≥ `2^32 + 1` (Q96) | [CHANGELOG #336](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/CHANGELOG.md#changed); technical doc “minimum floor price” |
| Tick spacing ≥ 2 | [TechnicalDocumentation — Tick spacing](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#tick-spacing) |
| Last step should sell a meaningful share (final price is the pool price) | [TechnicalDocumentation — Auction steps](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#auction-steps) |
| `requiredCurrencyRaised` too high → auction never graduates, all bids refund, all tokens return to `tokensRecipient` | [TechnicalDocumentation — Graduation](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#protocol-overview) |
| ETH as currency is first-class (`address(0)`) | [AuctionParameters.currency](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L18) |

Exact demo numbers for floor / tick / steps / `requiredCurrencyRaised` are **UNVERIFIED** until a person picks them. They are a product choice, not a CCA constant. Today’s 0.02 ETH graduation is a curve constant ([SPEC.md](SPEC.md); [DECISIONS #7](DECISIONS.md)), not a CCA parameter.

### Hook permissions (Path A vs B)

| Path | Hook | Flags | Who may `initialize` |
|---|---|---|---|
| A (ours) | `ProphecyHook` | `beforeInitialize` only | Launchpad |
| B (official LBP) | must inherit `InitializerHook` | `BEFORE_INITIALIZE` plus ERC165 `IInitializerHook` | `authorized()` = LBPStrategy |

[ProphecyHook L26-L48](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/ProphecyHook.sol#L26-L48); [InitializerHook L27-L61](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/periphery/hooks/InitializerHook.sol#L27-L61).

### Sepolia Uniswap v4 addresses

From [docs.uniswap.org v4 deployments — Sepolia: 11155111](https://docs.uniswap.org/contracts/v4/deployments):

| Contract | Address |
|---|---|
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| PositionManager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` |
| StateView | `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c` |
| Quoter | `0x61b3f2011a92d183c7dbadbda940a7555ccf9227` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Universal Router 2.1.2 | `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3` |

PoolManager matches [`SepoliaConfig.POOL_MANAGER`](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/script/SepoliaConfig.sol#L22). PositionManager is unused by our locker today.

---

## 5. Implementation plan (docs only)

This would reverse DECISIONS #7 (curve constants) and #11 (graduation is the last curve buy) if a person adopts it. Agents do not add that row. A person should add DECISIONS #16+ before any contracts PR.

### Recommended path (A)

1. INTERFACE first (this PR is the proposal).
2. Launchpad: keep `registerProphet`, ENS, World ID, `setUniswap`, token mint. Replace curve with factory `create` + transfer + `onTokensReceived`.
3. Frontend: bid / exit / claim against the CCA at `auctionOf(token)`. Watch `BidSubmitted`, `BidExited`, `TokensClaimed`, `CheckpointUpdated`. Drop `curve` / `quoteBuy` / `quoteSell` / `Trade`.
4. After `endBlock` and graduation: Launchpad sweeps, initializes the pool with our hook, `locker.lock`.
5. Tests: replace curve vectors with CCA create/bid/exit/claim + graduate. Keep lock tests (sentence / transfer).
6. Check: `cd contracts && forge build && forge test`; `cd web && bun run build`. Run `contract-reviewer` on the contracts PR.

### Effort

This is a **full replacement of the trading surface**, not a small Launchpad patch.

| Area | Size |
|---|---|
| Contracts | Rewrite `Launchpad` trading + graduate price math. Hook/Locker stay if Path A. New CCA param encoding tests. Curve fuzz / `Curve.vectors.json` become unused |
| Web | Issue still talks to Launchpad. Detail page becomes auction (blocks, max price, bid id, exit/claim) then a v4 panel |
| World / ENS | No INTERFACE change |
| Risk | Auction UX (Q96 prices, checkpoint hints for partial exit, block-based schedule) is new for the demo. A bad `requiredCurrencyRaised` or step schedule bricks graduation |

Exact person-hours are **UNVERIFIED**. Compared with the current curve+graduation stack, Path A is the same order of work (one Launchpad rewrite + one web trade-panel rewrite). Path B is larger (rewrite Hook + Locker onto PositionManager NFTs and `InitializerHook`).

### Fallback if CCA is not demo-ready by 22:00 KST

Keep the **shipping bonding curve** (already on `main`, DECISIONS #7 / #11). See section 6. Do not use official LBPStrategy as the 22:00 fallback: it cannot attach `ProphecyHook` / `LiquidityLocker` without a rewrite.

---

## 6. PM: fallback on `main`, fork-test gate, clock

Folder contract: [`INTERFACE.md`](INTERFACE.md) section 10.

### Bonding curve on `main` stays

Until a person marks the 22:00 KST checkpoint as passed, **do not replace the bonding-curve Launchpad on `main`**. `buy` / `sell` / `curve` / last-buy `_graduate` stay as they are on `main` (DECISIONS #7 / #11; [`Launchpad.sol` L257, L399-L425](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/Launchpad.sol#L257)). This research PR does not edit `contracts/`.

CCA Path A (Launchpad `create` + `graduate(token)` + web auction panel) is a **later, separate branch** after a person accepts this INTERFACE (DECISIONS row). It is not today’s merge.

Record CCA blockers in `FEEDBACK.md` ([PLAN.md](PLAN.md) section 5).

### Can a Sepolia fork test verify the four steps?

**Yes, as a spike on a later contracts branch** — same pattern as existing ForkE2E, **without** rewriting Launchpad on `main`.

Harness we already have ([`ForkE2EHelpers.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/test/ForkE2EHelpers.sol#L62-L83), [`ForkE2E.t.sol`](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/test/ForkE2E.t.sol#L41-L44)):

- `rpc = vm.envOr("SEPOLIA_RPC_URL", "")`; empty → do not fork
- else `vm.createSelectFork(rpc)` (optional pin; archive-less RPC falls back to latest)
- `onFork`: `if (!forked) vm.skip(true)` so default CI stays green
- CI already injects the secret ([`.github/workflows/ci.yml`](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/.github/workflows/ci.yml#L37-L40)). **Fork PRs do not receive Actions secrets** ([infra/README.md](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/infra/README.md#L266)), so a person must run `SEPOLIA_RPC_URL=… forge test` locally for the spike to actually hit Sepolia.

Official CCA tests that the spike can copy (in-process factory, not a Sepolia fork — the **calls** are the same): [`AuctionFactory.t.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/test/AuctionFactory.t.sol) (`create` + mint + `onTokensReceived`), [`Auction.submitBid.t.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/test/Auction.submitBid.t.sol), [`Auction.graduation.t.sol`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/test/Auction.graduation.t.sol) (22,218 bytes). Helpers: [`AuctionParamsBuilder`](https://github.com/Uniswap/continuous-clearing-auction/tree/7d7602d257733315434570f2a0c2f94f1c7b207a/test/utils), [`AuctionStepsBuilder`](https://github.com/Uniswap/continuous-clearing-auction/tree/7d7602d257733315434570f2a0c2f94f1c7b207a/test/utils). Step packing: [TechnicalDocumentation — Auction steps](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#auction-steps) (`uint64(mps) | (uint64(blockDelta) << 24)`). Official factory tests assert `startBlock() == block.number` ([AuctionFactory.t.sol](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/test/AuctionFactory.t.sol)); on Sepolia (L1) `vm.roll` is the schedule control.

Do **not** add the CCA repo as a Foundry lib on `main`. The spike talks to the **already-deployed** factory (bytecode present, section 1) through a local interface.

| Step | Fork-verifiable? | On the fork (must have code) | What the test does |
|---|---|---|---|
| **(1) Create auction** | **Yes** | Factory `0x000000001F26a0044BaA66024e7b6599c61963F8`. Token: deploy `ProphecyToken` or a mintable ERC-20 in the test (no live token required). | `factory.create(token, amount, abi.encode(AuctionParameters), salt)` → transfer `amount` → `onTokensReceived`. Assert `AuctionCreated` / `TokensReceived`. Optional: CCALens `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53`. Set `requiredCurrencyRaised = 0` so graduation is not blocked (section 2). |
| **(2) Bid** | **Yes** (needs 1) | Same factory + the auction from (1). Bidder EOA with `vm.deal`. | `vm.roll` to `startBlock`. `submitBid{value: amount}(maxPriceQ96, amount, owner, prevTick, "")` with `currency = address(0)`. Prefer a price on a tick boundary and `prevTick = floorPrice`. Assert `BidSubmitted`. |
| **(3) Clear / settle + claim** | **Yes** (needs 1–2) | Same auction. Optional lens for `state()`. | `vm.roll` to `endBlock`, `checkpoint()`, `isGraduated()`. `exitBid` on a bid **strictly above** final clearing (avoid `exitPartiallyFilledBid` hints in the spike). `vm.roll` to `claimBlock`, `claimTokens`. Assert `BidExited` / `TokensClaimed`. |
| **(4) Open v4 pool + our hook** | **Yes, with a prank** (needs 1–3) | Official PoolManager `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` (ForkE2E already requires code). **Local-on-fork** Launchpad + CREATE2 `ProphecyHook` + `LiquidityLocker` + `setUniswap` ([`_deployLocalOnFork`](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/test/ForkE2EHelpers.sol#L237-L264)). Not LBPStrategy / InitializerHook / PositionManager. | `sweepCurrency` / `sweepUnsoldTokens` (test is `fundsRecipient` / `tokensRecipient`). Read `lbpInitializationParams()`. `vm.prank(launchpad)` for `poolManager.initialize` (`ProphecyHook.beforeInitialize` requires `sender == launchpad` — [ProphecyHook.sol L45-L48](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/ProphecyHook.sol#L45-L48)) and `locker.lock` (`msg.sender == launchpad` — [LiquidityLocker.sol L105](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/LiquidityLocker.sol#L105)). Assert `slot0` and hook address. This is **not** `Launchpad.graduate` (that function does not exist yet). |

### Hours (ESTIMATE — not measured)

No timer in this repo or in official CCA CI gives person-hours. Numbers below are **ESTIMATE / UNVERIFIED**. Basis: our ForkE2E surface is already written (`ForkE2E.t.sol` + `ForkE2EHelpers.sol`); official create+fund is a short test once params pack; official graduation file is 22 KB; the spike does **not** rewrite Launchpad.

| Step | ESTIMATE hours | Why this size |
|---|---|---|
| (1) Create | **3** | New fork file + CCA interfaces + valid `auctionStepsData` (wrong MPS reverts `InvalidStepDataMps`). Includes the shared harness. |
| (2) Bid | **2** | Q96 tick + hint. Official `submitBid` tests exist. |
| (3) Settle + claim | **3** | Block rolls + checkpoint + simple `exitBid`. Partial-exit hints are out of the spike. |
| (4) v4 + hook | **3** | Reuse `_deployLocalOnFork`. Price from `lbpInitializationParams` instead of `vEth/vToken`. Prank approve/lock. |
| **Total (spike only)** | **11** | Sum of the four rows |

**Clock at write:** 2026-09-26 ~16:40 KST. 22:00 KST is about **5 hours 20 minutes** later.

**Does the four-step spike fit before 22:00 KST today?** **No.** 11h ESTIMATE > 5h 20m remaining. Even (1)+(2) alone (5h ESTIMATE) has no buffer for a bad step pack or a flaky RPC — treat as **does not reliably fit**.

**Does Path A implementation fit before 22:00 KST today?** **No.** That is a Launchpad + web rewrite on a **later branch** (section 5). Exact hours **UNVERIFIED**; same order of work as the existing curve + graduation stack.

The 22:00 checkpoint is therefore: keep the curve on `main`. A green local fork spike, if someone still writes it, is evidence — not a reason to merge Path A today.

## 7. Infra (deploy order, addresses, gas)

Folder contract for the same facts: [`INTERFACE.md`](INTERFACE.md) section 9.

This section does **not** edit `script/`. It is the proposed later change to `Deploy.s.sol` and `deployments/sepolia.json`.

### Must we deploy CCA contracts ourselves?

**No, not the factory, lens, PoolManager, or PositionManager.** Those are already on Sepolia (section 1). Path A only **creates per-prophecy auction clones** through the official factory at issue time (`factory.create` inside `launch`). We still deploy our own Launchpad, Hook, Locker, ENS adapter.

| Contract | Deploy ourselves? | Why |
|---|---|---|
| ContinuousClearingAuctionFactory v2.1.0 | No | Canonical address, bytecode present |
| Each `ContinuousClearingAuction` | Yes, via factory `create` at `launch` | One auction per prophecy. Not a Launchpad constructor deploy |
| CCALens | No | Optional read helper, already on Sepolia |
| LiquidityLauncher / LBPStrategy | No | Path A does not use them |
| Uniswap v4 PoolManager / PositionManager | No | Official Sepolia table |
| Launchpad, ProphecyHook, LiquidityLocker, ProphecyEns | Yes | Same as today ([`Deploy.s.sol` header](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/script/Deploy.s.sol#L17-L38)) |

### Proposed `Deploy.s.sol` order (Path A)

Keep today’s one-broadcast order, then wire the official factory. Do not CREATE a factory.

1. Predict Launchpad CREATE address.
2. `new ProphecyEns(predictedPad, …)` then `new Launchpad(protocolFeeRecipient, worldSigner, ens)` — unchanged ([Deploy.s.sol L23-L29](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/script/Deploy.s.sol#L23-L29)).
3. Mine CREATE2 salt; `new ProphecyHook{salt}(poolManager, launchpad)`.
4. `new LiquidityLocker(poolManager, launchpad, hook)`.
5. `launchpad.setUniswap(poolManager, hook, locker)` once.
6. **New:** `launchpad.setCcaFactory(0x000000001F26a0044BaA66024e7b6599c61963F8)` (official v2.1.0). Require `launchpad.ccaFactory()` matches.

PoolManager stays `SepoliaConfig.POOL_MANAGER` / [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments). Optional `UNISWAP_V4_POOL_MANAGER` unchanged.

v4 **pool** wiring is **not** a deploy-time CREATE. Each prophecy’s pool is created later by `graduate(token)` (`poolManager.initialize` + `locker.lock`), same moment as today’s last-buy graduate ([Launchpad.sol L399-L409](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/Launchpad.sol#L399-L409)).

Auctions are also **not** deploy-time. `launch` calls `factory.create` per prophecy.

### `deployments/sepolia.json` and `VITE_*`

Current record after a send ([infra/README.md “Deployment record”](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/infra/README.md#deployment-record)):

```json
{
  "chainId": 11155111,
  "launchpad": "0x…",
  "launchpadBlock": 12345678,
  "adapter": "0x…",
  "parentUserRegistry": "0x…",
  "hook": "0x…",
  "locker": "0x…",
  "poolManager": "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
  "deployer": "0x…",
  "commit": "<git sha>"
}
```

**Proposed additions** (later infra PR; this research PR does not edit the writer script):

| JSON field | Value | Vite / web |
|---|---|---|
| `ccaFactory` | `0x000000001F26a0044BaA66024e7b6599c61963F8` | optional `VITE_CCA_FACTORY`; empty = `launchpad.ccaFactory()` |
| `ccaLens` | `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | optional `VITE_CCA_LENS`; empty = official lens or skip |
| *(existing)* `launchpad` | our CREATE | `VITE_LAUNCHPAD_ADDRESS` (required for the home `Launched` list) |
| *(existing)* `launchpadBlock` | Launchpad CREATE block | `VITE_LAUNCHPAD_DEPLOY_BLOCK` (`fromBlock` for `Launched`) |
| *(existing)* `hook` / `locker` | our CREATE2 / CREATE | optional `VITE_HOOK_ADDRESS` / `VITE_LOCKER_ADDRESS` |
| *(existing)* `poolManager` | official v4 | not a Vite var today |
| *(do not add per auction)* | auction addresses | come from `Launched.auction` / `auctionOf(token)`, not the deploy record |

`VITE_CHAIN_ID` stays `11155111`. Per-prophecy auction and pool addresses must not be hardcoded ([AGENTS.md](../AGENTS.md): UI reads names from ENS; list from logs).

### Gas (measured vs estimate vs UNVERIFIED)

No official CCA `.forge-snapshots` tree exists at tag v2.1.0 (GitHub directory listing returned not found). Do not treat the numbers below as CCA-team measurements.

| Op | Kind | Number | Source |
|---|---|---|---|
| Our current Sepolia stack (14 txs: MockUSDC + adapter + Launchpad + Hook + Locker + `setUniswap`) | **Measured** (fork) | ~6.82M gas total | [infra/README.md L104](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/infra/README.md#L104) |
| Extra `setCcaFactory` (one SSTORE + event) | **Estimate** | tens of thousands of gas | typical one-time setter; **not measured** |
| Deploy our own CCA factory | **UNVERIFIED** | — | Official factory already exists; do not deploy |
| `factory.create` (one auction) | **UNVERIFIED** | — | Large CREATE2 of `ContinuousClearingAuction` (factory itself is 24,215 bytes runtime; auction size **UNVERIFIED**). A person should `forge snapshot` after the contracts PR |
| `submitBid` (ETH, existing tick) | **UNVERIFIED** | — | Docs warn the no-hint overload “will be gas intensive” ([TechnicalDocumentation — submitBid](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md#submitbid)); first bid in a block also writes a checkpoint |
| `checkpoint` / `forceIterateOverTicks` | **UNVERIFIED**; can OOG | — | Implementation comment: iterating many ticks “can revert with out of gas” ([ContinuousClearingAuction.sol L351-L352](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/ContinuousClearingAuction.sol#L351-L352)) |
| `exitBid` / `claimTokens` | **UNVERIFIED** | — | O(1) after hints / exit; not snapshotted in the official repo |
| Path A `graduate` (`sweep*` + `initialize` + `locker.lock`) | **UNVERIFIED** as a CCA flow | — | Same shape as today’s `_graduate` + two CCA sweeps. Today’s graduate gas is **UNVERIFIED** in-repo (no snapshot file cited) |
| Path B `LBPStrategy.migrate` | **UNVERIFIED** | — | Not recommended |

ETH cost at 1 / 5 / 20 gwei for the **current** 6.82M deploy is in infra/README (0.0068 / 0.034 / 0.136 ETH). Adding CCA factory CREATE is unnecessary. Adding one `setCcaFactory` does not change that order of magnitude.

---

## 8. Designer: auction states and revert names

Folder contract: [`INTERFACE.md`](INTERFACE.md) section 8.

CCA has **no** `getState()` enum ([IContinuousClearingAuction.sol](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol)). The UI derives a label from blocks + views. `$_tokensReceived` is **internal** ([AuctionStorage](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/AuctionStorage.sol)); there is no public `tokensReceived()` getter.

`block` below is the chain’s block-numberish (`START_BLOCK` / `END_BLOCK` / `CLAIM_BLOCK` getters). Sepolia is 12s blocks.

| UI state | Detect on-chain | User can |
|---|---|---|
| **Not funded** | No `TokensReceived` log; `token.balanceOf(auction) < totalSupply()` *or* `submitBid` would revert `TokensNotReceived`. After Path A `launch`, this should not appear (same tx calls `onTokensReceived`) | Nothing |
| **Not started** | Funded, and `block < startBlock()` | Wait. Bid reverts `AuctionNotStarted` |
| **Live** | Funded, `startBlock() <= block < endBlock()`, and remaining supply / MPS > 0 | `submitBid`. Clearing price from `clearingPrice()` or CCALens `state(auction)` |
| **Sold out (still live)** | `block < endBlock()` but next `submitBid` reverts `AuctionSoldOut` | Wait for end, then exit/claim if graduated |
| **Ended, not finalized** | `block >= endBlock()` and `lastCheckpointedBlock() != endBlock()` | Anyone `checkpoint()` to write the final checkpoint ([ICheckpointStorage.lastCheckpointedBlock](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/ICheckpointStorage.sol#L21)) |
| **Ended, graduated** | `block >= endBlock()`, `isGraduated() == true` (needs an up-to-date checkpoint; `isGraduated` “relies on the latest checkpoint which may be out of date” — [interface L172-L176](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L172-L176)) | `exitBid` / `exitPartiallyFilledBid`. Launchpad `graduate` once Uniswap is set |
| **Ended, failed** | `block >= endBlock()` and `isGraduated() == false` after a final checkpoint | Full refund via `exitBid` (tokensFilled = 0). `claimTokens` reverts `NotGraduated`. `sweepUnsoldTokens` returns the whole supply to `tokensRecipient` |
| **Claimable** | Graduated and `block >= claimBlock()` and the bid has `exitedBlock != 0` | `claimTokens` / `claimTokensBatch` |
| **Claim blocked** | Graduated but `block < claimBlock()` | Exit is allowed after end; claim reverts `NotClaimable` |
| **Pool open** | Launchpad `auctionOf(token).poolOpened == true` or a `Graduated` log for that token | Trade on Uniswap v4 (section 9.4). Auction bid/sell is over |

CCALens `state(auction)` (off-chain `eth_call`) runs `checkpoint()` and returns `{checkpoint, currencyRaised, totalCleared, isGraduated}` without a user tx ([AuctionStateLens.sol L9-L30](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/lens/AuctionStateLens.sol#L9-L30)). Address: `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53`.

Departed (`now >= deadline` from ENS) is **independent** of these auction states ([INTERFACE §1](INTERFACE.md), DECISIONS #9).

### User-facing revert names

**Bid (`submitBid`)** — [IContinuousClearingAuction.sol L40-L93](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L40-L93), [IStepStorage.sol L13](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IStepStorage.sol#L13), [ITickStorage.sol](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/ITickStorage.sol):

`AuctionNotStarted`, `TokensNotReceived`, `AuctionIsOver`, `BidAmountTooSmall`, `BidOwnerCannotBeZeroAddress`, `InvalidAmount` (ETH `msg.value != amount`), `CurrencyIsNotNative` (ERC-20 bid sent ETH), `InvalidBidPriceTooHigh`, `BidMustBeAboveClearingPrice`, `AuctionSoldOut`, `InvalidBidUnableToClear`, `TickPreviousPriceInvalid`, `TickPriceNotIncreasing`, `TickPriceNotAtBoundary`, `TickNotInitialized`, `InvalidTickPrice`, `TickHintMustBeGreaterThanNextActiveTickPrice`.

**Exit / refund (`exitBid`, `exitPartiallyFilledBid`)** — same interface + [IBidStorage.sol L9](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IBidStorage.sol#L9):

`AuctionIsNotOver` (`exitBid` before end), `BidAlreadyExited`, `CannotExitBid` (max price not strictly above final clearing — use partial exit), `CannotPartiallyExitBidBeforeGraduation`, `CannotPartiallyExitBidBeforeEndBlock`, `InvalidLastFullyFilledCheckpointHint`, `InvalidOutbidBlockCheckpointHint`, `BidIdDoesNotExist`.

**Claim (`claimTokens`, `claimTokensBatch`)** — [IStepStorage `NotClaimable`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IStepStorage.sol#L17), [IAuctionStorage `NotGraduated`](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IAuctionStorage.sol#L25):

`NotClaimable` (before `claimBlock`), `AuctionIsNotFinalized` (end block not checkpointed), `NotGraduated`, `BidNotExited`, `BatchClaimDifferentOwner`, `BidIdDoesNotExist`.

**Sweep / Launchpad `graduate` (CCA side):** `NotAuthorized`, `CannotSweepCurrency`, `CannotSweepTokens`, `AuctionIsNotOver`, `AuctionIsNotFinalized`, `NotGraduated` (`lbpInitializationParams`).

**Create-time (factory / constructor, prophet sees these on `launch`):** factory `InvalidTokenAmount` ([IContinuousClearingAuctionFactory.sol L12](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuctionFactory.sol#L12)); constructor / storage: `InvalidEndBlock`, `ClaimBlockIsBeforeEndBlock`, `InvalidAuctionDataLength`, `StepBlockDeltaCannotBeZero`, `InvalidStepDataMps`, `InvalidEndBlockGivenStepData`, `FloorPriceIsZero`, `FloorPriceTooLow`, `TickSpacingTooSmall`, `FloorPriceAndTickSpacingGreaterThanMaxBidPrice`, `FloorPriceAndTickSpacingTooLarge`, `TotalSupplyIsZero`, `TotalSupplyIsTooLarge`, `TokenIsAddressZero`, `TokenAndCurrencyCannotBeTheSame`, `FundsRecipientIsZero`, `TokensRecipientIsZero`. Funding after CREATE: `InvalidTokenAmountReceived` (`onTokensReceived`).

Path A does **not** invent new Launchpad custom-error names here (`Launchpad.sol` still has the curve surface). Existing Launchpad names that still apply, plus the official CCA names above, are the INTERFACE contract (INTERFACE §§4, 8, 9). New Launchpad-only names (`CcaFactoryNotSet` and the like) are left to the contracts PR.

---

## 9. Frontend

Folder contract: [`INTERFACE.md`](INTERFACE.md) section 4.

### 9.1 Home list event and auction address

**Keep `Launched`.** Do not invent a second list event. Path A **extends** it with `auction` as the third indexed topic so the home list still uses `fromBlock = VITE_LAUNCHPAD_DEPLOY_BLOCK` ([web `fetchLaunchedLogs`](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/web/src/lib/launchpad.ts); [INTERFACE §4](INTERFACE.md)).

```solidity
event Launched(
    address indexed token,
    address indexed prophet,
    address indexed auction,
    string prophetLabel,
    string slug
);
```

How to get the auction from a token:

1. `launchpad.auctionOf(token)` → `(auction, poolOpened)` (proposed view).
2. Or decode `Launched` where `token` matches.
3. Factory `getAddress(token, amount, configData, salt, sender)` only if the UI already has the exact create args ([IDistributorFactory.getAddress](https://github.com/Uniswap/liquidity-launcher/blob/1c5904912aefceaceb89c24528cd5e25d0b61597/src/interfaces/IDistributorFactory.sol#L26-L29)). Prefer (1).

Sentence / deadline still come from ENS, never from `Launched` (DECISIONS #5).

### 9.2 Views: state and clearing price

| Need | Call | Notes |
|---|---|---|
| Auction address + pool flag | `launchpad.auctionOf(token)` | Proposed |
| Start / end / claim blocks | `auction.startBlock()`, `endBlock()`, `claimBlock()` | [IContinuousClearingAuction L230-L236](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L230-L236) |
| Clearing price (Q96, ETH per token) | `auction.clearingPrice()` | Stale until `checkpoint()`; docs say prefer this over the checkpoint field ([L166-L171](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L166-L171)) |
| Fresh checkpoint + raised + cleared + graduated | CCALens `state(auction)` via `eth_call` | [AuctionStateLens.sol L25-L30](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/lens/AuctionStateLens.sol#L25-L30) |
| Graduated? | `auction.isGraduated()` after a current checkpoint | May be stale |
| Finalized? | `auction.lastCheckpointedBlock() == auction.endBlock()` | |
| Floor / tick | `auction.floorPrice()`, `auction.tickSpacing()` | [ITickStorage](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/ITickStorage.sol#L48-L52) |
| One bid | `auction.bids(bidId)` → `Bid{startBlock, exitedBlock, maxPrice, owner, amountQ96, tokensFilled, …}` | [BidLib.sol L6-L14](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/libraries/BidLib.sol#L6-L14); missing id → `BidIdDoesNotExist` |

Display price: `clearingPrice / 2^96` ETH per token (Q96). Do not use `curve()`.

### 9.3 Bid, claim, exit — signatures and errors

All on the **CCA**, not Launchpad. ETH currency: `address(0)`.

```solidity
function submitBid(uint256 maxPriceQ96, uint128 amount, address owner, uint256 prevTickPriceQ96, bytes calldata hookData)
    external payable returns (uint256 bidId);
// 4-arg overload: same without prevTickPriceQ96 (scans from floor — avoid in the demo)

function exitBid(uint256 bidId) external;
function exitPartiallyFilledBid(uint256 bidId, uint64 lastFullyFilledCheckpointBlock, uint64 outbidBlock) external;

function claimTokens(uint256 bidId) external;
function claimTokensBatch(address owner, uint256[] calldata bidIds) external;
```

[IContinuousClearingAuction.sol L137-L201](https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/src/interfaces/IContinuousClearingAuction.sol#L137-L201).

| Action | ETH / tokens | Reverts the user should see |
|---|---|---|
| Bid | `msg.value == amount`; `owner` = bidder | §8 Bid list. Empty `hookData` if no validation hook |
| Refund / exit | leftover ETH paid in `BidExited` | §8 Exit list. Failed auction: `exitBid` refunds 100% |
| Claim after clearing | tokens to `bid.owner` after `claimBlock` | §8 Claim list. Must exit first |

Events: `BidSubmitted(id, owner, priceQ96, amount)`, `BidExited(bidId, owner, tokensFilled, currencyRefunded)`, `TokensClaimed(bidId, owner, tokensFilled)`.

### 9.4 Post-pool trading: in-app swap vs Uniswap link

**Recommendation: Uniswap link, not an in-app v4 swap.** Same as today.

Reasons (product + what the code already does):

- After graduation the web **already hides Buy/Sell** and shows “View pool on Uniswap” ([CoinPage.tsx](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/web/src/pages/CoinPage.tsx); copy `GRADUATED_BODY` / `GRADUATED_LINK` in [graduation.ts L11-L13](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/web/src/lib/graduation.ts#L11-L13)).
- The live URL shape is verified against a Sepolia v4 pool: `https://app.uniswap.org/explore/pools/ethereum_sepolia/<poolId>` ([graduation.ts L19-L26](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/web/src/lib/graduation.ts#L19-L26)).
- `ProphecyHook` only implements `beforeInitialize`. It does **not** implement `beforeSwap` / `afterSwap` ([ProphecyHook.sol L26-L43](https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/uniswap/ProphecyHook.sol#L26-L43)). An in-app swap would be a generic v4 swap (Universal Router `0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3` on Sepolia — [v4 deployments](https://docs.uniswap.org/contracts/v4/deployments)), not “via our hook”.
- Building a router swap UI is extra contracts/web work after Path A auction + `graduate`. The 22:00 checkpoint is CCA working, not an in-app AMM.
- Hook still gates **who opens** the pool (Launchpad only). It does not gate who swaps once the pool exists.

Use `Graduated.poolId` (or reconstruct ETH/`token`/fee 10000/tick 200/`hook()`). Do not point at LBPStrategy pools.

---

## 10. Source index

| What | Link |
|---|---|
| CCA repo @ v2.1.0 | https://github.com/Uniswap/continuous-clearing-auction/tree/7d7602d257733315434570f2a0c2f94f1c7b207a |
| CCA technical doc | https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md |
| Liquidity launcher @ `1c590491` (docs commit for LBPStrategy v3.3.0) | https://github.com/Uniswap/liquidity-launcher/tree/1c5904912aefceaceb89c24528cd5e25d0b61597 |
| Official CCA concept page | https://docs.uniswap.org/contracts/liquidity-launchpad/CCA |
| Launchpad + CCA + LBP addresses | https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments |
| v4 Sepolia addresses | https://docs.uniswap.org/contracts/v4/deployments |
| Our Launchpad graduate | https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/Launchpad.sol#L399-L425 |
