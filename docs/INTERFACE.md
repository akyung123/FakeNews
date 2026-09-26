# Interface

> **PROPOSAL** (2026-09-26). This file is the proposed Launchpad-facing contract if bonding-curve trading is replaced by Uniswap CCA. It is **not** accepted until a person adds a DECISIONS row (this would supersede #7 and #11). Research and sources: [`CCA_RESEARCH.md`](CCA_RESEARCH.md). No `contracts/`, `web/`, script, or workflow code ships in the PR that first lands this text.
>
> **Path A (recommended):** official CCA factory on Sepolia + our Launchpad still initializes the v4 pool and locks LP in `LiquidityLocker`. Frontend talks to the CCA for bid / exit / claim.
> **Path B (not recommended for the hackathon):** official `LBPStrategy.migrate`. Cannot attach today's `ProphecyHook` / `LiquidityLocker` without rewriting both. See CCA_RESEARCH section 3.
>
> Team addenda (same no-guess rule): Frontend §4, Designer §8, Infra §9, PM §10. Sources: [`CCA_RESEARCH.md`](CCA_RESEARCH.md) §§6–9.

What `contracts/`, `web/` and `world/` rely on from each other. Only the contract between folders, not how to implement it.

- **Changing it:** edit this file first, in **the same PR** as the code change, and write "INTERFACE change" in the PR description.
- **Sources:** [`SPEC.md`](SPEC.md), [`DECISIONS.md`](DECISIONS.md), [`CCA_RESEARCH.md`](CCA_RESEARCH.md)
- `(draft)` means the shape may still change during implementation. Remove the mark once it settles.
- `(removed)` is the bonding-curve surface that Path A deletes. Do not call it from web after the contracts PR.

## 1. Names (ENS)

The parent is written as `prophecy.eth`. The real one comes from `VITE_PARENT_NAME` (see DECISIONS "Not decided yet").

| Name | Address record (coinType 60) | Text records | Who can write |
|---|---|---|---|
| `<prophet>.prophecy.eth` | prophet wallet | `avatar`, `description` | prophet only (per-key role) |
| `<slug>.<prophet>.prophecy.eth` | prophecy token | `prophecy` = sentence (1–140 chars) | **nobody** (written at init only) |
| | | `deadline` = unix seconds, decimal string | **nobody** |
| | | `avatar`, `description` | prophet only |

- **Label rules** `(draft)`
  - Prophet: 3–16 chars, `[a-z0-9]`
  - Prophecy: 3–32 chars, `[a-z0-9-]`, no leading or trailing hyphen
- **Expiry:** `type(uint64).max` for every name, so names never expire (DECISIONS #14).
- **Transfer:** not allowed. The owner's role bitmap is 0.
- **Departed:** `now >= deadline`. Computed by the UI; there is no on-chain status.

## 2. Contracts

### `Launchpad` `(draft)` `(PROPOSAL — Path A)`

Constructor stays `(protocolFeeRecipient, worldSigner, ens)`. Uniswap addresses stay on `setUniswap`. A deployer-only `setCcaFactory` records the official Sepolia CCA factory. Graduation does not add constructor arguments.

Official factory (Sepolia, verified bytecode): `0x000000001F26a0044BaA66024e7b6599c61963F8` (CCA v2.1.0). See [`CCA_RESEARCH.md`](CCA_RESEARCH.md) section 1.

```solidity
constructor(address protocolFeeRecipient, address worldSigner, address ens);

// Deployer-only, once. After Launchpad, Hook (CREATE2), and Locker exist.
function setUniswap(address poolManager, address hook, address locker) external;

// Deployer-only, once. Official ContinuousClearingAuctionFactory on Sepolia.
function setCcaFactory(address factory) external;

// Unchanged. Create a prophet name. Needs a World ID server signature. Once per nullifier.
function registerProphet(string label, uint256 nullifier, bytes serverSig) external;

// Issue a prophecy. Caller must own a prophet name.
// Mints ProphecyToken to the Launchpad, writes ENS, deploys a CCA via factory.create,
// transfers `auctionSupply` to the auction, calls onTokensReceived.
// Does NOT take ETH for a first buy.
function launch(string slug, string prophecy, uint64 deadline, AuctionLaunchParams params)
    external
    returns (address token, address auction);

struct AuctionLaunchParams {
    uint64 startBlock;
    uint64 endBlock;
    uint64 claimBlock;
    uint256 floorPriceQ96;
    uint256 tickSpacingQ96;
    uint128 requiredCurrencyRaised; // 0 = always graduate
    uint128 auctionSupply;          // tokens sent to CCA; rest stays for LP
    bytes auctionStepsData;         // packed MPS + block deltas
}

// After auction endBlock, auction.isGraduated(), and Uniswap is set:
// sweepCurrency + sweepUnsoldTokens, initialize the v4 pool with ProphecyHook,
// locker.lock the LP reserve + swept ETH. Anyone may call.
function graduate(address token) external;

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
function ccaFactory() external view returns (address);
```

```solidity
event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
event Launched(
    address indexed token,
    address indexed prophet,
    address indexed auction,
    string prophetLabel,
    string slug
);
event Graduated(
    address indexed token,
    address indexed auction,
    bytes32 indexed poolId,
    uint256 ethToPool,
    uint256 tokensToPool,
    uint160 sqrtPriceX96,
    uint24 fee,
    int24 tickSpacing,
    address hooks
);
event UniswapSet(address poolManager, address hook, address locker);
event CcaFactorySet(address factory);
```

#### What the frontend calls (bid / claim / exit)

The Launchpad is **not** the trading contract during the auction. Web calls the CCA at `auctionOf(token).auction` (official interface, CCA v2.1.0). Currency is native ETH (`address(0)`).

| User action | Contract | Function |
|---|---|---|
| Bid ETH at a max price | CCA | `submitBid(maxPriceQ96, amount, owner, prevTickPriceQ96, hookData)` payable; `msg.value == amount`. Empty `hookData` if `validationHook == 0`. The 4-arg overload scans from the floor and is gas-heavy — do not use it in the demo unless the tick is already initialized |
| Refresh clearing price | CCA | `checkpoint()` (also runs inside `submitBid`) |
| Leave a fully-above-clearing bid after end | CCA | `exitBid(bidId)` — refunds leftover ETH immediately |
| Leave a partial fill | CCA | `exitPartiallyFilledBid(bidId, lastFullyFilledCheckpointBlock, outbidBlock)` |
| Take tokens after `claimBlock` | CCA | `claimTokens(bidId)` or `claimTokensBatch(owner, bidIds)` — anyone may call; tokens go to the bid owner |
| Open the v4 pool | Launchpad | `graduate(token)` after `endBlock` and `isGraduated()` |

CCA events to watch: `BidSubmitted`, `BidExited`, `TokensClaimed`, `CheckpointUpdated`, `ClearingPriceUpdated`, `TokensReceived`. Signatures are in [`CCA_RESEARCH.md`](CCA_RESEARCH.md) section 2.

Read-only on the CCA (and/or CCALens `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53`): `clearingPrice()`, `isGraduated()`, `startBlock()`, `endBlock()`, `claimBlock()`, `currency()`, `token()`, `totalSupply()`.

There is **no sell** during the auction. After `Graduated`, trading is the Uniswap v4 pool (same as today).

#### What stays

- `registerProphet`, World ID signature, one nullifier, prophet ENS name (section 3).
- ENS adapter: prophecy sentence and deadline live only on the prophecy resolver (DECISIONS #5). `Launched` still does not contain them.
- `setUniswap` + CREATE2 `ProphecyHook` + `LiquidityLocker`. Hook `beforeInitialize` still allows only the Launchpad. Locker still holds a PoolManager position (not a PositionManager NFT).
- `LiquidityLocker.collect` / `withdrawAccrued` after the pool exists. Prophet 24 : protocol 76.
- Constructor `(protocolFeeRecipient, worldSigner, ens)`.
- Deploy order: Launchpad, Hook, Locker, `setUniswap`, `setCcaFactory`. Graduation reverts if either is unset.
- `receive()` leftover seed ETH only from the locker and the PoolManager.
- Label / slug / prophecy length rules. Names never expire.

#### What is removed `(removed)`

Bonding-curve trading. Do not keep these on Launchpad after the contracts PR:

```solidity
function launch(..., uint256 minTokensOut) external payable returns (address token); // old
function buy(address token, uint256 minTokensOut, string memo) external payable;
function sell(address token, uint256 tokensIn, uint256 minEthOut, string memo) external;
function claimCreatorFee() external;
function curve(address token) external view returns (uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete);
function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee);
function quoteSell(address token, uint256 tokensIn) external view returns (uint256 ethOut, uint256 fee);
function creatorFeeOf(address wallet) external view returns (uint256);

event Trade(address indexed token, address indexed trader, bool isBuy,
            uint256 ethAmount, uint256 tokenAmount, uint256 fee, uint256 vEthAfter, uint256 vTokenAfter, string memo);
event CreatorFeeClaimed(address indexed prophet, uint256 amount);
```

Reasons:

- CCA has no instant buy/sell and no virtual reserves. Price is the auction clearing price, then the v4 pool.
- Official Sepolia CCA factory `protocolFeeController()` is `address(0)`, so CCA itself takes no protocol fee ([CCA_RESEARCH.md](CCA_RESEARCH.md) section 1). The 1.25% curve split (DECISIONS #7) does not exist on this path. Prophet fees after the pool remain `LiquidityLocker.collect`.
- DECISIONS #15 memos rode on `buy`/`sell`. CCA `BidSubmitted` has no memo field. Memo-on-bid is a later product choice, not part of this proposal.

#### Notes that stay true

- `registerProphet` recovers EIP-191 `personal_sign` of `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))` (section 3). `chainId` must be `block.chainid` and `launchpad` must be this contract; the signed wallet must be `msg.sender`. Label is chosen by the caller and is not in the signed payload.
- `Graduated.poolId` is the V4 `PoolId` (`keccak256` of the `PoolKey`). `currency0` is native ETH (`address(0)`); `currency1` is `token`. The frontend reconstructs the key from `token`, `fee`, `tickSpacing`, and `hooks`.
- `graduate` is a separate transaction after the auction, not the last curve buy.
- Official LBPStrategy (`0x95434E898Af471945Cab33D5064d2aC1A6Ba2000` on Sepolia) is **out of this Launchpad interface**. Path B would replace `graduate` with `LBPStrategy.migrate` and cannot use our hook/locker.

### `ProphecyToken`

- ERC-20, 18 decimals, 1,000,000,000 total. All minted to the Launchpad.
- `name` is the full prophecy name (`lingo-2028.ringo.prophecy.eth`).
- `symbol` is the slug in upper case, truncated to 11 chars `(draft)`.

### `LiquidityLocker`

- `lock(address token, address prophet, address protocolFeeRecipient, PoolKey key, uint256 tokenAmount)` is called only by the Launchpad from `graduate` (Path A). Recipients are fixed then. Official LBPStrategy NFT mint is not used.
- `collect(address token)` can be called by anyone. Collected fees go **only** to prophet 24 : protocol 76.
- No withdraw of principal. Liquidity cannot be decreased or burned.
- If sending ETH to the prophet fails, `collect` still pays the protocol and accrues the prophet share. The prophet later calls `withdrawAccrued()`. Seed leftovers must not sweep `accruedEth`.
- `withdrawAccrued()` sends only accrued ETH, never pool principal.
- Leftover seed tokens after lock are sent to `0x…dEaD` (the token rejects `address(0)`).

## 3. World server → Launchpad `(draft)`

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

## 4. How the web app reads `(PROPOSAL)` — Frontend

Sources for every CCA name and view: [`CCA_RESEARCH.md`](CCA_RESEARCH.md) sections 8–9. Do not guess extra events or getters.

### 4.1 Home list — `Launched` is not replaced

No new list event. Path A **extends** the existing Launchpad `Launched` with `auction` as the third indexed topic. Home still queries `fromBlock = VITE_LAUNCHPAD_DEPLOY_BLOCK`.

Today (`Launchpad.sol`): `event Launched(address indexed token, address indexed prophet, string prophetLabel, string slug);`

Proposed:

```solidity
event Launched(
    address indexed token,
    address indexed prophet,
    address indexed auction,
    string prophetLabel,
    string slug
);
```

Sentence and deadline are still **not** in this event (DECISIONS #5). Read them from ENS.

### 4.2 Auction address from a token

| Order | Call | Notes |
|---|---|---|
| 1 | `launchpad.auctionOf(token)` → `(address auction, bool poolOpened)` | Proposed view. Prefer this. |
| 2 | Decode `Launched` where `token` matches | Same log as the home list |
| 3 | Factory `getAddress(token, amount, configData, salt, sender)` | Only if the UI already has the exact `create` args. Do not use as the default |

### 4.3 Views: auction state and clearing price

CCA has no `getState()` enum. Derive the designer labels in section 8 from these views.

| Need | Call |
|---|---|
| Auction + pool flag | `launchpad.auctionOf(token)` |
| Schedule | `auction.startBlock()`, `endBlock()`, `claimBlock()` |
| Clearing price (Q96, ETH per token) | `auction.clearingPrice()` — stale until `checkpoint()`; prefer this over the checkpoint field |
| Fresh checkpoint + raised + cleared + graduated | CCALens `state(auction)` via `eth_call` (official Sepolia `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53`) |
| Graduated? | `auction.isGraduated()` after a current checkpoint (may be stale) |
| Finalized? | `auction.lastCheckpointedBlock() == auction.endBlock()` |
| Floor / tick | `auction.floorPrice()`, `auction.tickSpacing()` |
| One bid | `auction.bids(bidId)` |

Display price: `clearingPrice / 2^96` ETH per token. Do not call `curve()`.

### 4.4 Bid, claim after clearing, refund / exit

All on the **CCA** at `auctionOf(token).auction`, not Launchpad. Currency is native ETH (`address(0)`). Empty `hookData` when `validationHook == 0`.

```solidity
function submitBid(uint256 maxPriceQ96, uint128 amount, address owner, uint256 prevTickPriceQ96, bytes calldata hookData)
    external payable returns (uint256 bidId);
// 4-arg overload omits prevTickPriceQ96 and scans from the floor — do not use in the demo

function exitBid(uint256 bidId) external;
function exitPartiallyFilledBid(uint256 bidId, uint64 lastFullyFilledCheckpointBlock, uint64 outbidBlock) external;

function claimTokens(uint256 bidId) external;
function claimTokensBatch(address owner, uint256[] calldata bidIds) external;
```

| Action | ETH / tokens | User-facing revert names (official CCA) |
|---|---|---|
| Bid | `msg.value == amount`; `owner` = bidder | `AuctionNotStarted`, `TokensNotReceived`, `AuctionIsOver`, `BidAmountTooSmall`, `BidOwnerCannotBeZeroAddress`, `InvalidAmount`, `CurrencyIsNotNative`, `InvalidBidPriceTooHigh`, `BidMustBeAboveClearingPrice`, `AuctionSoldOut`, `InvalidBidUnableToClear`, `TickPreviousPriceInvalid`, `TickPriceNotIncreasing`, `TickPriceNotAtBoundary`, `TickNotInitialized`, `InvalidTickPrice`, `TickHintMustBeGreaterThanNextActiveTickPrice` |
| Refund / exit | leftover ETH in `BidExited` | `AuctionIsNotOver`, `BidAlreadyExited`, `CannotExitBid`, `CannotPartiallyExitBidBeforeGraduation`, `CannotPartiallyExitBidBeforeEndBlock`, `InvalidLastFullyFilledCheckpointHint`, `InvalidOutbidBlockCheckpointHint`, `BidIdDoesNotExist` |
| Claim after clearing | tokens to `bid.owner` after `claimBlock`; must exit first | `NotClaimable`, `AuctionIsNotFinalized`, `NotGraduated`, `BidNotExited`, `BatchClaimDifferentOwner`, `BidIdDoesNotExist` |

Events: `BidSubmitted(id, owner, priceQ96, amount)`, `BidExited(bidId, owner, tokensFilled, currencyRefunded)`, `TokensClaimed(bidId, owner, tokensFilled)`, `CheckpointUpdated`, `ClearingPriceUpdated`, `TokensReceived`.

### 4.5 Post-pool trading

**Uniswap link, not an in-app v4 swap.** Same as today: hide Buy/Sell and show “View pool on Uniswap” (`GRADUATED_LINK` in `web/src/lib/graduation.ts`). URL: `https://app.uniswap.org/explore/pools/ethereum_sepolia/<poolId>` (verified against a live Sepolia v4 pool). `ProphecyHook` only implements `beforeInitialize` — an in-app swap would be a generic Universal Router call, not “via our hook”. Building that UI is extra work after Path A; the 22:00 checkpoint is CCA working, not an in-app AMM.

Use `Graduated.poolId`. If the event is not in hand: native ETH (`address(0)`), `token`, fee `10000`, tickSpacing `200`, `hooks` from the event or `launchpad.hook()`.

Also: name next to a wallet = reverse lookup, falling back to `prophetOf(wallet)`. Issue = World ID → `registerProphet` → `launch` (no `msg.value` first buy). Bid list replaces `(removed)` `Trade` logs.

## 5. Environment variables

| Name | Used by |
|---|---|
| `VITE_RPC_URL` | web |
| `VITE_LAUNCHPAD_ADDRESS` | web |
| `VITE_LAUNCHPAD_DEPLOY_BLOCK` | web (`fromBlock` for `Launched` logs) |
| `VITE_HOOK_ADDRESS`, `VITE_LOCKER_ADDRESS` | web (optional) |
| `VITE_CCA_FACTORY` | web (optional; empty = `launchpad.ccaFactory()` / official Sepolia factory `0x000000001F26a0044BaA66024e7b6599c61963F8`) |
| `VITE_CCA_LENS` | web (optional; empty = official Sepolia CCALens `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53`, or skip the lens) |
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
| `UNISWAP_V4_POOL_MANAGER` | deploy script (optional). Empty = official Uniswap v4 Sepolia PoolManager (`SepoliaConfig.POOL_MANAGER`) |
| `HOOK_SALT` | deploy script (optional). Empty = mine a CREATE2 salt whose address has `beforeInitialize` flags |
| `PARENT_LABEL`, `ENS_REGISTRATION_SECRET`, `ENS_DURATION_SECONDS` | parent `.eth` register (`infra/scripts/deploy-sepolia.sh`) |
| `MOCK_USDC_MINT_AMOUNT` | optional MockUSDC `mint` amount (6 decimals). Empty = script mints enough for the fee |
| `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_SIGNER_KEY` | World verification server |

Empty `VITE_LAUNCHPAD_ADDRESS` means the launchpad is not deployed yet. The web app must not invent a contract address. `VITE_UNIVERSAL_RESOLVER` is the ENSv2 address from [`ENSV2.md`](ENSV2.md) section 0. The web app does not read `ENS_ADAPTER_ADDRESS`; if it needs the adapter it calls `launchpad.ens()`.

After a successful send, infra writes a machine-readable record (no secrets) to `deployments/sepolia.json`, or `deployments/anvil.json` on a local / fork run (gitignored). Format: [`infra/README.md`](../infra/README.md) “Deployment record”. Web copies `launchpad` into `VITE_LAUNCHPAD_ADDRESS` and `launchpadBlock` into `VITE_LAUNCHPAD_DEPLOY_BLOCK` (optional; empty means the web uses a recent block range). `hook` / `locker` / `poolManager` are recorded after `setUniswap`; optional `VITE_HOOK_ADDRESS` / `VITE_LOCKER_ADDRESS` copy the first two. Path A adds `ccaFactory` / `ccaLens` (section 9). `VITE_CHAIN_ID` stays `11155111` on Sepolia.

`Deploy.s.sol` order is in section 9. This proposal does not edit the script; a later contracts PR does.

`ENS_ADAPTER_ADDRESS` is the `ProphecyEns` address. **Default: output.** `Deploy.s.sol` creates the adapter (predicted Launchpad CREATE address) and the Launchpad in one broadcast, then the CREATE2 Hook, Locker, and `setUniswap`, then logs `ENS_ADAPTER_ADDRESS`. **Optional input override:** if the env var is set, the script does not CREATE an adapter and passes that address as Launchpad `ens`. Off anvil, a set value cannot be `address(0)` or placeholder `0xe05` — the same `#24` guard as `PROTOCOL_FEE_RECIPIENT` / `0xfee` and `worldSigner` / `0x51e`. Anvil dry-run (`chainid == 31337`) fills `0xe05` when unset (Launchpad reverts on zero). The hook / locker / `setUniswap` steps still run.

`TEAM_WALLET` defaults to the address of `DEPLOYER_PRIVATE_KEY`. A different `TEAM_WALLET` reverts: `setSubregistry` and `ROLE_REGISTRAR` grants need the same key that registered the parent name.

Parent lock (revoke `SET_SUBREGISTRY` on `.eth` for `prophecy`) is not part of this deploy. A later PR adds that irreversible step after a person confirms.

## 6. Curve quote vectors `(removed)`

Bonding-curve quote vectors (`contracts/test/Curve.vectors.json`, `web/src/lib/Curve.vectors.json`) are unused on Path A. Do not re-derive them. A later contracts PR deletes the callers; this proposal does not edit those files.

## 7. Implementation plan (short)

Full research: [`CCA_RESEARCH.md`](CCA_RESEARCH.md) section 5.

1. Person accepts this INTERFACE (DECISIONS row). Contracts PR implements Path A only.
2. Launchpad rewrite + web auction panel. World / ENS unchanged.
3. Effort: same order as the existing curve + graduation stack (one contracts rewrite, one web trade-panel rewrite). Exact hours **UNVERIFIED**.
4. **Fallback if CCA is not working by 22:00 KST:** keep the bonding-curve Launchpad already on `main` (section 10). Do not merge Path A contracts. Record blockers in `FEEDBACK.md`.

## 8. Designer: auction states and revert names `(PROPOSAL)`

CCA has no `getState()` enum. The UI derives a label from blocks + views ([`CCA_RESEARCH.md`](CCA_RESEARCH.md) section 8). `$_tokensReceived` is internal — there is no public `tokensReceived()` getter. Departed (`now >= deadline` from ENS) is independent of these labels.

`block` is the chain’s block-numberish (`startBlock` / `endBlock` / `claimBlock`). Sepolia is 12s blocks.

| UI state | Detect on-chain | User can |
|---|---|---|
| **Not funded** | No `TokensReceived` log; `token.balanceOf(auction) < totalSupply()` or `submitBid` would revert `TokensNotReceived`. After Path A `launch` this should not appear (same tx calls `onTokensReceived`) | Nothing |
| **Not started** | Funded, and `block < startBlock()` | Wait. Bid reverts `AuctionNotStarted` |
| **Live** | Funded, `startBlock() <= block < endBlock()`, remaining supply / MPS > 0 | `submitBid`. Price from `clearingPrice()` or CCALens `state(auction)` |
| **Sold out (still live)** | `block < endBlock()` but next `submitBid` reverts `AuctionSoldOut` | Wait for end, then exit/claim if graduated |
| **Ended, not finalized** | `block >= endBlock()` and `lastCheckpointedBlock() != endBlock()` | Anyone `checkpoint()` |
| **Ended, graduated** | `block >= endBlock()`, `isGraduated() == true` after a current checkpoint | `exitBid` / `exitPartiallyFilledBid`. Launchpad `graduate` once Uniswap is set |
| **Ended, failed** | `block >= endBlock()` and `isGraduated() == false` after a final checkpoint | Full refund via `exitBid`. `claimTokens` reverts `NotGraduated` |
| **Claimable** | Graduated and `block >= claimBlock()` and the bid has `exitedBlock != 0` | `claimTokens` / `claimTokensBatch` |
| **Claim blocked** | Graduated but `block < claimBlock()` | Exit after end; claim reverts `NotClaimable` |
| **Pool open** | `auctionOf(token).poolOpened == true` or a `Graduated` log for that token | Uniswap v4 link (section 4.5). Auction bid is over |

### User-facing revert names

Bid / exit / claim names are the official CCA errors in section 4.4 (do not invent aliases).

Launchpad names that **already exist** and still apply (`Launchpad.sol`):

| Surface | Names |
|---|---|
| `registerProphet` | `InvalidSignature`, `NullifierUsed`, `LabelTaken`, `AlreadyProphet`, `BadLabel`, `ZeroAddress` |
| `launch` (ENS / prophet) | `NotProphet`, `BadSlug`, `BadProphecy`, `SlugTaken` |
| `setUniswap` / proposed `setCcaFactory` | `NotDeployer`, `UniswapAlreadySet`, `ZeroAddress` |
| `graduate` | `UnknownToken`, `UniswapNotSet` |

`launch` / `graduate` also bubble official CCA create / sweep names ([`CCA_RESEARCH.md`](CCA_RESEARCH.md) section 8): `InvalidTokenAmount`, `InvalidTokenAmountReceived`, `InvalidEndBlock`, `ClaimBlockIsBeforeEndBlock`, `NotAuthorized`, `CannotSweepCurrency`, `CannotSweepTokens`, `AuctionIsNotOver`, `AuctionIsNotFinalized`, `NotGraduated`, plus the constructor list there.

This proposal does **not** invent new Launchpad custom-error names. The contracts PR names any extra guards (`ccaFactory` unset, auction already opened a pool).

`(removed)` curve names the UI must stop mapping: `CurveComplete`, `ZeroAmount`, `Slippage`, `MemoTooLong`, `ExceedsSold`.

## 9. Infra: deploy, addresses, gas `(PROPOSAL)`

This section does **not** edit `script/`. Full sources: [`CCA_RESEARCH.md`](CCA_RESEARCH.md) section 7.

### Must we deploy CCA contracts ourselves?

**No** — not the factory, lens, PoolManager, or PositionManager. Those are already on Sepolia (bytecode verified 2026-09-26). Path A only **creates per-prophecy auction clones** through the official factory inside `launch`. We still deploy Launchpad, Hook, Locker, ENS adapter.

| Contract | Deploy ourselves? |
|---|---|
| ContinuousClearingAuctionFactory v2.1.0 `0x000000001F26a0044BaA66024e7b6599c61963F8` | No |
| Each `ContinuousClearingAuction` | Yes, via `factory.create` at `launch` — not a deploy-script CREATE |
| CCALens `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | No |
| LiquidityLauncher / LBPStrategy | No (Path A does not use them) |
| Uniswap v4 PoolManager / PositionManager | No |
| Launchpad, ProphecyHook, LiquidityLocker, ProphecyEns | Yes — same as today |

### Proposed `Deploy.s.sol` order (Path A)

Keep today’s one-broadcast order, then wire the official factory. Do not CREATE a factory. v4 **pool** wiring is **not** deploy-time: each prophecy’s pool is created later by `graduate(token)`.

1. Predict Launchpad CREATE address.
2. `new ProphecyEns(predictedPad, …)` then `new Launchpad(protocolFeeRecipient, worldSigner, ens)`.
3. Mine CREATE2 salt; `new ProphecyHook{salt}(poolManager, launchpad)`.
4. `new LiquidityLocker(poolManager, launchpad, hook)`.
5. `launchpad.setUniswap(poolManager, hook, locker)` once. Require hook / locker / poolManager match.
6. **New:** `launchpad.setCcaFactory(0x000000001F26a0044BaA66024e7b6599c61963F8)`. Require `launchpad.ccaFactory()` matches.

PoolManager stays `SepoliaConfig.POOL_MANAGER`. Optional `UNISWAP_V4_POOL_MANAGER` unchanged. `ENS_ADAPTER_ADDRESS` / `TEAM_WALLET` rules above stay.

### `deployments/sepolia.json` and `VITE_*`

Current record ([infra/README.md “Deployment record”](../infra/README.md#deployment-record)): `chainId`, `launchpad`, `launchpadBlock`, `adapter`, `parentUserRegistry`, `hook`, `locker`, `poolManager`, `deployer`, `commit`.

**Proposed additions** (later infra PR; this file does not edit the writer):

| JSON field | Value | Vite / web |
|---|---|---|
| `ccaFactory` | `0x000000001F26a0044BaA66024e7b6599c61963F8` | optional `VITE_CCA_FACTORY`; empty = `launchpad.ccaFactory()` |
| `ccaLens` | `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | optional `VITE_CCA_LENS`; empty = official lens or skip |
| *(existing)* `launchpad` | our CREATE | `VITE_LAUNCHPAD_ADDRESS` |
| *(existing)* `launchpadBlock` | Launchpad CREATE block | `VITE_LAUNCHPAD_DEPLOY_BLOCK` |
| *(existing)* `hook` / `locker` | our CREATE2 / CREATE | optional `VITE_HOOK_ADDRESS` / `VITE_LOCKER_ADDRESS` |
| *(do not add per auction)* | auction / pool addresses | `Launched.auction` / `auctionOf(token)` / `Graduated.poolId` — not the deploy record |

### Gas (measured vs estimate vs UNVERIFIED)

| Op | Kind | Number |
|---|---|---|
| Current Sepolia stack (14 txs, including Hook + Locker + `setUniswap`) | **Measured** (fork) | ~6.82M gas ([infra/README.md](../infra/README.md)) |
| Extra `setCcaFactory` | **Estimate** | tens of thousands; **not measured** |
| Deploy our own CCA factory | **UNVERIFIED** / unnecessary | official factory exists |
| `factory.create` / `submitBid` / `checkpoint` / `exitBid` / `claimTokens` / Path A `graduate` / Path B `migrate` | **UNVERIFIED** | no official `.forge-snapshots` at v2.1.0. Docs warn the no-hint `submitBid` is gas-intensive; `forceIterateOverTicks` can OOG |

ETH cost for the current 6.82M deploy is in infra/README (0.0068 / 0.034 / 0.136 ETH at 1 / 5 / 20 gwei). One `setCcaFactory` does not change that order of magnitude.

## 10. PM: `main` fallback and fork-test gate `(PROPOSAL)`

Sources: [`CCA_RESEARCH.md`](CCA_RESEARCH.md) section 6.

**Until the 22:00 KST checkpoint passes, the bonding-curve code on `main` stays.** Do not merge Path A into `main`. CCA implementation (Launchpad rewrite + web auction panel) is a **later, separate branch** after a person adds a DECISIONS row.

A Sepolia **fork spike** can verify official CCA + our hook **without** editing Launchpad on `main`. Pattern: `ForkE2EHelpers._maybeFork` (`SEPOLIA_RPC_URL` + `vm.createSelectFork` + `vm.skip` when unset). Fork PRs do not get the Actions secret; a person runs the spike locally.

| Step | Fork-verifiable? | Addresses / contracts on the fork | ESTIMATE hours (UNVERIFIED) |
|---|---|---|---|
| (1) Create auction | Yes | Official factory `0x000000001F26a0044BaA66024e7b6599c61963F8`; test-deployed ERC-20 / `ProphecyToken`. Optional CCALens `0xc3C65F5453A3674aDb693cbdA3C842545cD30f53` | **3** |
| (2) Bid | Yes (needs 1) | Auction from (1); bidder with ETH | **2** |
| (3) Clear / settle + claim | Yes (needs 1–2) | Same auction. `checkpoint` → `exitBid` → `claimTokens` (`vm.roll`) | **3** |
| (4) Open v4 pool + our hook | Yes, with `vm.prank(launchpad)` (needs 1–3) | Official PoolManager `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`; **local-on-fork** Launchpad + `ProphecyHook` + `LiquidityLocker` (`ForkE2EHelpers._deployLocalOnFork`). Not LBPStrategy. Hook / locker still require the Launchpad as caller | **3** |
| **Total spike** | | | **11** |

Clock at write: 2026-09-26 ~16:40 KST → 22:00 KST is about **5 hours 20 minutes**. **11h does not fit.** (1)+(2) alone is 5h ESTIMATE with no buffer — treat as not reliable. Path A implementation is later and also does not fit today.
