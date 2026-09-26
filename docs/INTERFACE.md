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
```

```solidity
event ProphetRegistered(address indexed wallet, string label, uint256 nullifier);
event Launched(address indexed token, address indexed prophet, string prophetLabel, string slug, uint64 deadline);
event Trade(address indexed token, address indexed trader, bool isBuy,
            uint256 ethAmount, uint256 tokenAmount, uint256 fee, uint256 vEthAfter, uint256 vTokenAfter, string memo);
event Graduated(address indexed token, uint256 ethToPool, uint256 tokensToPool);
event CreatorFeeClaimed(address indexed prophet, uint256 amount);
```

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

- `collect(address token)` can be called by anyone. Collected fees go **only** to prophet 24 : protocol 76.
- No withdraw function.

## 3. World server → Launchpad `(draft)`

- The server verifies an IDKit 4 Proof of Human with Portal v4.
- On success it signs `keccak256(abi.encode(chainId, launchpad, wallet, nullifier))` with EIP-191.
- The Launchpad checks that the signer is `WORLD_SIGNER` and that the nullifier is unused.

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

Names only. Values live in a local `.env` (never committed). How to obtain each value is in [`INFRA.md`](INFRA.md).

| Name | Used by |
|---|---|
| `VITE_RPC_URL` | web (Sepolia JSON-RPC, no API key in git) |
| `VITE_LAUNCHPAD_ADDRESS` | web |
| `VITE_PARENT_NAME` | web (e.g. `prophecy.eth`) |
| `VITE_UNIVERSAL_RESOLVER` | web ([`ENSV2.md`](ENSV2.md) section 0) |
| `VITE_WORLD_APP_ID`, `VITE_WORLD_ACTION` | web (World Developer Portal) |
| `VITE_WORLD_RP_ID` | web (IDKit 4 relying-party id, if the Portal action requires it) |
| `VITE_BASE` | web build only (`/Prophecy/` on GitHub Pages; `/` locally) |
| `SEPOLIA_RPC_URL` | Foundry dry-run / broadcast (`--rpc-url`) |
| `DEPLOYER_PRIVATE_KEY` | Foundry broadcast only (person; never an agent) |
| `TEAM_WALLET` | Team address that registers `prophecy.eth` and deploys |
| `PROTOCOL_FEE_RECIPIENT` | Launchpad deploy |
| `WORLD_SIGNER` | Launchpad deploy (address that signs World server payloads) |
| `UNISWAP_V4_POOL_MANAGER` | Launchpad / hook deploy (override; default is the official Sepolia PoolManager) |
| `HOOK_SALT` | `ProphecyHook` CREATE2 salt, once mined |
| `PARENT_LABEL` | ENS parent registration (`prophecy`) |
| `ENS_REGISTRATION_SECRET` | ENS commit → register (bytes32; local only) |
| `ENS_DURATION_SECONDS` | ENS registration duration |
| `WORLD_APP_ID`, `WORLD_ACTION`, `WORLD_RP_ID` | World verification server |
| `WORLD_RP_SIGNING_KEY`, `WORLD_SIGNER_KEY` | World verification server |
