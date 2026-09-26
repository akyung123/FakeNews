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

Keep the **shipping bonding curve** (already on `main`, DECISIONS #7 / #11). Graduation into our v4 pool + locker is implemented and tested. Record CCA blockers in `FEEDBACK.md` (already listed in [PLAN.md](PLAN.md) section 5). Do not delete curve code until a person accepts the INTERFACE proposal.

Do not use official LBPStrategy as the 22:00 fallback: it cannot attach `ProphecyHook` / `LiquidityLocker` without a rewrite.

---

## 6. Source index

| What | Link |
|---|---|
| CCA repo @ v2.1.0 | https://github.com/Uniswap/continuous-clearing-auction/tree/7d7602d257733315434570f2a0c2f94f1c7b207a |
| CCA technical doc | https://github.com/Uniswap/continuous-clearing-auction/blob/7d7602d257733315434570f2a0c2f94f1c7b207a/docs/TechnicalDocumentation.md |
| Liquidity launcher @ `1c590491` (docs commit for LBPStrategy v3.3.0) | https://github.com/Uniswap/liquidity-launcher/tree/1c5904912aefceaceb89c24528cd5e25d0b61597 |
| Official CCA concept page | https://docs.uniswap.org/contracts/liquidity-launchpad/CCA |
| Launchpad + CCA + LBP addresses | https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/deployments |
| v4 Sepolia addresses | https://docs.uniswap.org/contracts/v4/deployments |
| Our Launchpad graduate | https://github.com/prism-toggle-ai/FakeNews/blob/70430a5cc72acd27ebb7ec6cfb13898a591ca474/contracts/src/Launchpad.sol#L399-L425 |
