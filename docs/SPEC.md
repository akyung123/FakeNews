# Prophecy Launchpad — Spec

The product spec. When this file and [`DECISIONS.md`](DECISIONS.md) disagree, the latest row in DECISIONS wins. That is where changes found during implementation are recorded.

Everything runs on **Sepolia**. The ENSv2 beta only exists there, and these names never move to mainnet. [1]

## What it does

It turns one sentence into a token. People who find the sentence plausible buy it: buying raises the price and selling lowers it. When the curve supply sells out, liquidity moves into a Uniswap V4 pool and is locked.

The address book is the core feature. Type a name and you get an address.

| Name | Points to |
|---|---|
| `ringo.prophecy.eth` | the prophet's wallet |
| `lingo-2028.ringo.prophecy.eth` | that prophecy's token |

Locking is a rule layered on top of the address book so it cannot be abandoned. It does not replace the address book.

The contracts never judge whether a prophecy came true. There is no oracle, and no True or False. The price falls because many people sell, not because a contract marked the prophecy wrong. A correct prophecy falls if people sell it, and a wrong one holds if nobody sells. The only status on screen is **Departed**.

The price says "people are here", not "this sentence is true". We never describe the price as recording truth.

## System

```text
Person
  World ID          only when issuing. Buying and browsing are not verified
       │
       ▼
ENS address book
  prophet name   ──►  wallet
  prophecy name  ──►  token
       │
       ▼
Bonding curve      price is the ratio of two reserves. No judgment
       │
       ├─ deadline ──►  prophecy shows Departed. The name is never removed; it still points to the token
       │
       └─ curve supply sold out ──►  V4 pool ──►  position locked
                                                   liquidity cannot be withdrawn, only fees collected
```

A falling price and a passing deadline are separate events. The name stays alive when the price falls, and it keeps pointing to the token after the deadline.

## Constants

The virtual token amount is fixed. The only value the team picks before deploying is `VIRTUAL_ETH`. It cannot change after deployment, and prophets cannot pick it per prophecy: if they could, anyone could create a cheap curve for themselves.

```solidity
uint256 constant TOTAL_SUPPLY  = 1_000_000_000e18;
uint256 constant CURVE_SUPPLY  =   793_100_000e18;
uint256 constant LP_SUPPLY     =   206_900_000e18;
uint256 constant VIRTUAL_TOKEN = 1_073_000_000e18;

// Graduation at exactly 0.02 ETH. Demo scale.
uint256 constant VIRTUAL_ETH   = 7_058_378_514_689_194; // wei

uint256 constant FEE_BPS       = 125; // 1.25%, denominator 10_000
uint256 constant CREATOR_BPS   = 30;  // 0.30% of trade value
uint256 constant PROTOCOL_BPS  = 95;  // 0.95% of trade value
```

Changing only `VIRTUAL_ETH` scales the graduation amount proportionally. Token amounts and the price multiple stay the same. For a target graduation amount `G`: `VIRTUAL_ETH = G × 279_900_000 / 793_100_000`.

| | Draft 0.003529 ETH | Deployed value |
|---|---|---|
| Real ETH at graduation | 0.0099995 | 0.02 |
| Starting market cap | ~0.00329 ETH | ~0.00658 ETH |
| Share of curve supply bought by 0.001 ETH | ~30% | ~16.6% |
| Graduation price vs start | 14.70× | 14.70× |

At 0.01 ETH the first click is too big. At pump.fun's value (~3.5 ETH) nobody will see a graduation during a live demo. Deploy once with these numbers. Changing them later means redeploying the whole launchpad, and existing prophecies stay on the old curve.

Decimals are 18. Do not copy pump.fun's 6.

## Virtual reserves

Virtual reserves are never minted. They exist only in the formula. Mint 1,000,000,000 tokens, never 1,073,000,000.

Right after creation the real ETH is 0. Pricing from that state gives a price of 0, and the first buyer takes the supply. So the formula gets a floor that nobody paid for and nobody can withdraw.

| | Formula reserve | Virtual part | Real part |
|---|---|---|---|
| ETH | `V` = 0.007058… | all of `V` | 0 at start |
| Token | 1,073,000,000 | 279,900,000. Cannot be bought | 793,100,000. The supply for sale |

The difference never changes, because each trade moves the virtual and real parts together. A sell only pays out real ETH. If everyone sells, real ETH returns to 0 and virtual ETH returns to `V`.

A larger `V` raises the starting price, reduces price impact for the same amount, and increases the ETH needed to graduate. The price multiple comes from token amounts, so it does not depend on `V`. Changing the virtual token amount changes the multiple and breaks the link between the last curve price and the pool's starting price, which is why that number is fixed.

## Price

There is no order book. The two reserves just before a trade are the price.

```text
k = vETH × vToken        P_curve = vETH / vToken
```

| Name | Meaning |
|---|---|
| vETH | ETH reserve just before this trade: virtual `V` + ETH that came in and has not left |
| vToken | Token reserve just before this trade: unsold supply + the 279,900,000 virtual tokens |
| k | Product of the two reserves. Must be equal before and after a trade (excluding fees). No meaningful unit |
| P | ETH per token. The unit price of a tiny purchase |
| ethNet | The ETH this buyer sends, minus fee. This one trade only, not a running total |
| tokensOut | Tokens received as a result |
| tokensIn | Tokens sent back when selling. No fee is taken from them first |
| ethOut | ETH the curve computes for those tokens, before fee |

The running total already lives in vETH. ethNet is this trade's money that has not entered the reserve yet. After the trade it is added to vETH, and the next trader sees that as "before". Putting the total into ethNet counts it twice.

Never divide by the number already sold. Sold tokens sit in wallets; they are not inventory that sets the next price. At the start, sold is 0, so it cannot produce a price anyway. Selling returns tokens to the reserve and removes ETH, so for the price to fall you must look at what is left in the reserves.

```text
tokensOut = vToken × ethNet / (vETH + ethNet)
ethOut    = vETH × tokensIn / (vToken + tokensIn)
```

The buy formula is the remaining inventory times this trade's share of the new ETH reserve. This trade's money is added to the denominator because the price rises while you buy. If the old price held, a small amount could empty the inventory. Because this trade also grows the reserve, the ratio never reaches 1, and the formula reserve can never be drained.

Graduation does not empty the formula reserve. It is the moment the 793,100,000 tokens for sale run out. At that point 279,900,000 virtual tokens remain; they never existed and do not go to the pool. The real ETH required is about 2.833512 × `V`. Not infinity.

Do not precompute k and divide later; large-integer remainders differ. Multiply first and divide once. Drop the remainder.

Check with small integers: ETH reserve 10, token reserve 100, deposit 10.

```text
100 × 10 / (10 + 10) = 50
```

The buyer's share of the new reserve (20) is half, so they take half the inventory. 20 is not money paid: it is the virtual 10 plus this 10. The contract actually holds 10. The product is 1,000 before and after. The price goes from 0.1 to 0.4, four times.

If the next person also deposits 10, vETH is 20 and ethNet is 10.

```text
50 × 10 / (20 + 10) ≈ 16.67
```

Same money: the first buyer gets 50, the second gets 16.67.

A large purchase pushes P up while it fills, so the average price paid is higher than P. A small purchase pays about P.

## Fees

Every curve buy or sell takes 1.25% of trade value: 0.30% to the prophet, 0.95% to the protocol. The internal split is 24:76.

- A buy takes the fee from incoming ETH first, then prices the rest. The rest is ethNet.
- A sell takes the fee after pricing. The user receives less than ethOut.
- Fees round up. Buy cost rounds up, sell payout rounds down.
- Fees accumulate in variables separate from the curve reserves. Mixing them in would move the price.
- The prophet withdraws only their own share with `claimCreatorFee()`.

Buying with 0.001 ETH takes a 0.0000125 fee and puts 0.0009875 into the curve. Selling right back, the curve computes that 0.0009875 and takes 1.25% again, so the user receives about 0.000975. The difference is the round-trip fee, not money the curve kept.

Never price from `address(this).balance`: fees and refunds would leak into the price. Track reserves per token in a struct.

## Graduation

Graduation is triggered by quantity, not amount. It completes inside the buy transaction that sells the last of the 793,100,000 curve tokens.

1. Fill only the remaining supply and refund the excess ETH.
2. Set `complete = true`. After that, `buy` and `sell` are blocked. This check lives only in the buy function.
3. Open a V4 pool with the collected ETH and the LP reserve.
4. Send the position NFT to `LiquidityLocker` and burn leftover tokens.

Reserves at that moment:

| | Virtual ETH | Virtual token | Real ETH |
|---|---|---|---|
| Start | `V` | 1,073,000,000 | 0 |
| Graduation | 3.833512 × `V` | 279,900,000 | 2.833512 × `V` |

The price is 14.70× the start. Not 15×.

The last curve price and `collected ETH / LP reserve` are nearly but not exactly equal. Because amounts are rounded to millions, they differ by about 0.0068% per ETH. Invisible in a demo. For an exact match the LP reserve would be 206,886,011 instead of 206,900,000. We keep the original amount for now.

## Uniswap V4

V4 has no pair contracts. One `PoolManager` manages every pool, and a pool is identified by its `PoolKey`. [2]

| Field | Value |
|---|---|
| currency0 | Native ETH, `address(0)`. Always this side |
| currency1 | The prophecy token |
| Pool fee | 1% = 10000 (in pips, 3000 is 0.30%) |
| tickSpacing | 200 |
| Hook | `ProphecyHook` |
| Liquidity range | Full range aligned to tickSpacing |
| Position owner | `LiquidityLocker` |

Because ETH is currency0, V4 takes the price in the opposite direction from the curve's P: token1 / token0, i.e. tokens per ETH. [2]

```text
sqrtPriceX96 = floor( sqrt(LP_SUPPLY / ethForLP) × 2^96 )
```

Passing the curve's `vETH / vToken` directly opens the pool inverted.

The hook's `beforeInitialize` checks that the caller is the launchpad. The hook address is part of the `PoolKey`, so nobody else can initialize the same key first. It does not block pools with a different fee or hook. The hook address must encode permission flags in its bits, so it is deployed with a mined CREATE2 salt.

The launchpad needs the hook address and the hook needs the launchpad address. Compute both before deploying, or each will wait on the other.

Moving fee distribution into `afterSwap` is an extension for later, not part of the core scope.

## Fees after graduation

After graduation the 1.25% curve fee stops, because buy and sell are blocked. Fees themselves do not stop.

From then on, 1% of each trade accrues in the pool. The locker collects it and splits it with the same 24:76: about 0.24% of trade value to the prophet and 0.76% to the protocol. That is the same ratio as on the curve, not the same percentage points.

Popularity turns into fees through trading, not price. As long as people trade after graduation, the prophet keeps earning. A high price with no trades earns nothing, before or after graduation.

What cannot be taken out is the principal in the pool. If the prophet could withdraw that ETH and those tokens, later buyers would have nowhere to sell. The locker is a contract with no withdraw function. It gives the same trust as pump.fun burning the LP; we lock instead of burning so fees keep flowing after graduation.

There are two ways to receive fees:

- The curve share: `claimCreatorFee()`.
- The pool share: the locker's `collect`. Without it, fees stay trapped in the position. It is required.

Whoever calls it, the prophet's share goes only to the prophet and the protocol's share only to the protocol. The caller never receives it.

This is unrelated to whether the prophecy comes true. Popularity produces trading fees; whether the sentence was right stays outside the price.

## ENS

ENS is the Ethereum Name Service: readable names that point to addresses. A name under a name is a subname, and the parent sets the rules.

We use ENSv2. Each name can have its own registry and roles, and permissions are roles you grant and revoke rather than fuses you burn. We use the Sepolia deployment. [1]

The team registers the parent `prophecy.eth` first. If that fails, we use a name the team already owns. Examples below use `prophecy.eth`.

```text
eth
└── prophecy.eth                         our registry. Only the launchpad can issue
    │
    ├── ringo                            prophet. A person in the address book
    │     points to: wallet
    │     expiry: none
    │     transfer: not allowed
    │     │
    │     ├── lingo-2028                 prophecy. A coin in the address book
    │     │     points to: token
    │     │     text: sentence, deadline
    │     │     expiry: none (deadline is a text record)
    │     │     transfer: not allowed
    │     │     edit sentence: not allowed
    │     │
    │     └── eth-10k
    │
    └── mina                             someone else. Requires a different World ID
```

Names are looked up in three places:

| Lookup | Result | Used for |
|---|---|---|
| `ringo.prophecy.eth` | prophet wallet | who issued it, where fees go |
| `lingo-2028.ringo.prophecy.eth` | token address | buying without pasting a contract address |
| reverse lookup of a wallet | `ringo.prophecy.eth` | a name next to each wallet |

Curve balances, price and graduation live in the contracts. ENS only points at them.

No name expires. A prophet name that expired would leave fees with nowhere to go, and a prophecy name that expired would stop pointing at its token (DECISIONS #14). Every name uses `type(uint64).max`; `expiry = 0` reverts (DECISIONS review B).

The screen does not rely on ENS expiry for Departed. It reads the `deadline` text record. ENS expiry is about ownership.

Names are never unregistered after the deadline. Unregistering would let another sentence claim the label. The name keeps pointing at the token, and the child stays under its parent so the next prophecy screen can count it.

### Permissions

Only the launchpad creates names. A prophet owns their name but cannot delete records or sell the name.

A transfer only succeeds when the current owner holds `ROLE_CAN_TRANSFER_ADMIN`; otherwise it reverts with `TransferDisallowed`. [3] Prophet and prophecy names never get this role. Switching wallets does not move the name.

`ROLE_UNREGISTER` deletes names. On the root it could delete every name, so prophets never get it and the launchpad has no function that uses it. [3] `ROLE_SET_SUBREGISTRY` and root `ROLE_SET_RESOLVER` are not granted either: swapping the registry or resolver would bypass the lock.

Only the sentence record is locked at issue. Display records such as `avatar` stay editable by the prophet. ENSv2 resolvers can scope roles per record key. The demo shows that a transaction editing the sentence reverts.

| Action | Launchpad | Prophet | Buyer |
|---|---|---|---|
| Create prophet name | after World ID | no | no |
| Create prophecy name | inside the issue transaction | no | no |
| Transfer a name | no role | no role | no |
| Edit sentence | never granted | no | no |
| Display records | yes | yes | no |
| Delete a departed prophecy | no function | no role | no |
| Resolve name to address | anyone | anyone | anyone |

Names must be minted on Sepolia for real. Nothing on screen is hardcoded.

## World ID

The moment that needs trust is issuing, not logging in or buying. Issuing creates a public record that outlives a wallet. We do not need to know who issued it; we need the same person to be unable to reset their record.

The only credential is Proof of Human. A passport is more than this needs.

- The proof is verified on a server or on chain.
- The nullifier is stored in the contract, so one person cannot create two prophet names.
- If verification is cancelled or fails, only issuing is blocked. Browsing and buying still work.

An optional extension: an agent drafts a sentence, and the name is minted only after a person verifies again on the spot. Cancelling means no mint. A draft button that never stops a person is no different from a login screen.

## Issue flow

```text
World ID success
  stop if this person's nullifier already exists
        │
        ▼
ringo.prophecy.eth
  record the wallet address on the name
  no transfer role
        │
        ▼
Issue a sentence
  create the child name
  write sentence and deadline as text records
  nobody can write those records afterwards
  mint 1,000,000,000 tokens
  record the token address on the name
        │
        ▼
Bonding curve buy / sell
        │
        ├─ deadline ──► screen shows Departed. The name is not unregistered
        └─ supply sold out ──► initialize pool, add liquidity, lock position
```

Nobody should wait for a deadline during the demo. Create a 2-minute prophecy beforehand, let it pass, and show that transaction. If an admin fast-forward is used, say it is for the demo.

## Contracts

| Contract | Role |
|---|---|
| `ProphecyToken` | ERC-20, 18 decimals, supply 1,000,000,000. One per prophecy |
| `Launchpad` | Curve, fee ledger, graduation. Reserves in a struct |
| `ProphecyHook` | `beforeInitialize` allows only the launchpad |
| `LiquidityLocker` | Holds positions. No withdraw. Only `collect`, split 24:76 |
| ENS adapter | Registers subnames, sets address records, locks records |
| World verification | Checks the proof before issuing, stores the nullifier |

Checklist:

- Per-token reserves in a struct. Never `address(this).balance`.
- Round in the protocol's favor: buy cost up, sell payout down, fees up.
- Buy takes `minTokensOut`, sell takes `minEthOut`. Both take an optional `memo` (≤ 140 bytes) that is emitted in `Trade` and never stored.
- The last buy fills only the remaining supply and refunds excess ETH.
- Graduation check only in the buy function. Block buy and sell after graduation.
- Update state before transfers. ETH transfers last. `nonReentrant`.
- Hook via CREATE2. Compute both addresses before deploying.
- Three fuzz tests: solvency, a fee-inclusive round trip never gains, and the gap between graduation price and pool starting price stays under 0.0068%.

## Screens

Four screens:

1. **Prophecy list.** Name, sentence, price, number of Departed.
2. **Issue.** World verification; cancelling disables the issue button.
3. **Prophecy detail.** Find the token by name; buy and sell. No True or False. Recent trades are listed with their memos: a buyer or seller can attach one line to the trade ("0.1 ETH in · here we go", "sold at −42% · why is it dropping again"). The memo is part of the trade transaction, so every note is backed by a real trade. A separate holder-only board may come later.
4. **Prophet page.** Wallet address, prophecies held, departed prophecies, sell button, claimable fees.

The prophet page is not a balance screen. It keeps departed prophecies next to the next buy so you decide whether to sell or buy the next one. A chart alone is not enough.

## Demo

Two to four minutes, five scenes:

1. Verification succeeds and a prophet name is minted. The name points to the wallet.
2. A sentence is issued. The prophecy name points to the token.
3. Another wallet buys by name; selling lowers the price.
4. An already departed prophecy sits under the name, and the next issue screen shows departed 1.
5. Switching wallets does not allow issuing. Editing the sentence reverts. Cancelling verification blocks issuing.

## Out of scope

- Right / wrong oracle.
- Paying out curve balance to the side that was right.
- Different curves per prophecy.
- Minting virtual tokens.
- Withdrawing liquidity after graduation.
- Mainnet deployment.

## Check before implementing

- Which expiry value means "never" on Sepolia ENSv2 → answered in DECISIONS review B.
- The exact role bits for the sentence record → answered in DECISIONS review C.
- That no code path lets a parent unregister a subname → DECISIONS review D.
- The `PoolManager` address on Sepolia, and whether CREATE2 can produce an address with the hook flags.
- That the locker's `collect` sends only to the prophet and the protocol, whoever calls it.

---

1. [docs.ens.domains/ensv2/overview](https://docs.ens.domains/ensv2/overview/)
2. [developers.uniswap.org — create pool](https://developers.uniswap.org/docs/protocols/v4/guides/create-pool)
3. [docs.ens.domains/ensv2/permissioned-registry](https://docs.ens.domains/ensv2/permissioned-registry)
