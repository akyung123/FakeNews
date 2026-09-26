# Interface

What `contracts/`, `web/` and `world/` rely on from each other. Only the contract between folders, not how to implement it.

- **Changing it:** edit this file first, in **the same PR** as the code change, and write "INTERFACE change" in the PR description.
- **Sources:** [`SPEC.md`](SPEC.md), [`DECISIONS.md`](DECISIONS.md)
- `(draft)` means the shape may still change during implementation. Remove the mark once it settles.

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

### `Launchpad` `(draft)`

```solidity
// Exact constructor order. Infra must update contracts/script/Deploy.s.sol.
constructor(
    address protocolFeeRecipient, // 1
    address worldSigner,          // 2
    address poolManager,          // 3
    address hook,                 // 4
    address locker                // 5
);

// Create a prophet name. Needs a World ID server signature. Once per nullifier.
function registerProphet(string label, uint256 nullifier, bytes serverSig) external;

// Issue a prophecy. Caller must own a prophet name. If msg.value > 0, also makes the first buy.
function launch(string slug, string prophecy, uint64 deadline, uint256 minTokensOut)
    external payable returns (address token);

// memo: optional one-line note shown next to the trade. Empty string for none. At most 140 bytes.
function buy(address token, uint256 minTokensOut, string memo) external payable;
function sell(address token, uint256 tokensIn, uint256 minEthOut, string memo) external;
function claimCreatorFee() external;

// views
function curve(address token) external view returns (
    uint256 vEth, uint256 vToken, uint256 realEth, uint256 sold, bool complete);
function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee);
function quoteSell(address token, uint256 tokensIn) external view returns (uint256 ethOut, uint256 fee);
function prophetOf(address wallet) external view returns (string label);
function creatorFeeOf(address wallet) external view returns (uint256);
function protocolFeeRecipient() external view returns (address);
function worldSigner() external view returns (address);
function poolManager() external view returns (address);
function hook() external view returns (address);
function locker() external view returns (address);
```

```solidity
event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
event Launched(address indexed token, address indexed prophet, string prophetLabel, string slug, uint64 deadline);
event Trade(address indexed token, address indexed trader, bool isBuy,
            uint256 ethAmount, uint256 tokenAmount, uint256 fee, uint256 vEthAfter, uint256 vTokenAfter, string memo);
event Graduated(
    address indexed token,
    bytes32 indexed poolId,
    uint256 ethToPool,
    uint256 tokensToPool,
    uint160 sqrtPriceX96,
    uint24 fee,
    int24 tickSpacing,
    address hooks
);
event CreatorFeeClaimed(address indexed prophet, uint256 amount);
```

- `Graduated` is emitted in the buy that sells the last curve tokens. `poolId` is the V4 `PoolId` (`keccak256` of the `PoolKey`). `currency0` is native ETH (`address(0)`); `currency1` is `token`. The frontend reconstructs the key from `token`, `fee`, `tickSpacing`, and `hooks`.
- Constructor circularity: `ProphecyHook` stores the Launchpad address; Launchpad stores the hook and locker. CREATE of Launchpad does not hash constructor args, so the deployer predicts that address from its nonce, mines the hook CREATE2 salt with it, deploys hook then locker, then deploys Launchpad at the predicted nonce. `receive()` accepts leftover seed ETH only from the locker and the PoolManager.

- The sentence is not in `Launched`. It is read from ENS (DECISIONS #5).
- Constants are exactly the "Constants" section of SPEC.md.
- `memo` is only emitted, never stored. `buy`/`sell` revert if it is longer than 140 bytes (DECISIONS #15).
- Rounding:
  - Buy: fee rounds up, tokens out round down.
  - Sell: fee rounds up, ETH out rounds down.

### `ProphecyToken`

- ERC-20, 18 decimals, 1,000,000,000 total. All minted to the Launchpad.
- `name` is the full prophecy name (`lingo-2028.ringo.prophecy.eth`).
- `symbol` is the slug in upper case, truncated to 11 chars `(draft)`.

### `LiquidityLocker`

- `lock(address token, address prophet, address protocolFeeRecipient, PoolKey key, uint256 tokenAmount)` is called only by the Launchpad at graduation. Recipients are fixed then.
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

## 4. How the web app reads

1. List: `Launched` logs.
2. Names, resolved through the Universal Resolver (`VITE_UNIVERSAL_RESOLVER`):
   - token: `getEnsAddress(name)`
   - sentence: `getEnsText(name, "prophecy")`
   - deadline: `getEnsText(name, "deadline")`
3. Price and progress: `curve(token)`.
4. Chart and trade memos: `Trade` logs.
5. Name next to a wallet: reverse lookup, falling back to `prophetOf(wallet)`.

## 5. Environment variables

| Name | Used by |
|---|---|
| `VITE_RPC_URL` | web |
| `VITE_LAUNCHPAD_ADDRESS` | web |
| `VITE_PARENT_NAME` | web (e.g. `prophecy.eth`) |
| `VITE_UNIVERSAL_RESOLVER` | web ([`ENSV2.md`](ENSV2.md) section 0) |
| `VITE_WORLD_APP_ID`, `VITE_WORLD_ACTION` | web |
| `VITE_WORLD_MOCK` | web (default on; set `0` to call the world server) |
| `VITE_WORLD_SERVER_URL` | web (world/ base URL; unused while mock) |
| `VITE_WALLETCONNECT_PROJECT_ID` | web (optional; injected wallets work without it) |
| `RPC_URL`, `PRIVATE_KEY` | contract deployment (people only) |
| `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_SIGNER_KEY` | World verification server |

Empty `VITE_LAUNCHPAD_ADDRESS` means the launchpad is not deployed yet. The web app must not invent a contract address. `VITE_UNIVERSAL_RESOLVER` is the ENSv2 address from [`ENSV2.md`](ENSV2.md) section 0.

## 6. Curve quote vectors

Canonical rows live in backend M1 PR #8 as `contracts/test/Curve.vectors.json`. Web keeps a byte-matching copy at `web/src/lib/Curve.vectors.json` so tests run before that PR merges. Do not re-derive the numbers. Do not edit `contracts/` from this lane.

- Web: `web/src/lib/curve.vectors.test.ts` imports the web copy.
- Contracts: forge tests read `contracts/test/Curve.vectors.json`.

In the fixture, sell `ethOut` is the seller payout. SPEC's pre-fee `ethOut` is the fixture's `rawOut`. Rounding matches section 2.
