# Uniswap Foundation — developer feedback (Prophecy)

Fallback write-up for the Uniswap Foundation if V4 deployment integration is cut at the **22:00 KST** check. Fill rows as work happens. Do not invent findings.

Sources: [`docs/SPEC.md`](docs/SPEC.md), [`docs/DECISIONS.md`](docs/DECISIONS.md) #11. Implementation status is still the pre-SPEC `contracts/` skeleton unless a later note says otherwise.

## Project context

Prophecy is a Sepolia launchpad that turns one sentence into a token. Buying raises the price and selling lowers it. When the curve supply sells out, liquidity moves into a Uniswap V4 pool and is locked so later traders still have a market. The address book is the core feature (`ringo.prophecy.eth` → wallet, `lingo-2028.ringo.prophecy.eth` → token). There is no oracle and no True / False; after the deadline the only on-screen status is Departed.

## What we built / planned with Uniswap V4

**Status:** TODO — mark each item built, in progress, or still planned. Do not claim a Sepolia deploy unless the address is recorded.

| Piece | Spec (DECISIONS #11 / SPEC “Uniswap V4”) | Built? |
|---|---|---|
| Graduation | Last curve buy fills remaining supply, refunds excess ETH, sets `complete`, opens a V4 pool (native ETH / token, 1% = 10000 pips, tickSpacing 200, full-range liquidity), sends the position NFT to the locker, burns leftover tokens | TODO |
| `ProphecyHook` | `beforeInitialize` allows only the Launchpad. Hook address is part of the `PoolKey`. Deployed with a mined CREATE2 salt so the address bits carry the hook permission flags | TODO |
| `LiquidityLocker` | Holds the position. No withdraw. Anyone may call `collect`; fees go only to prophet 24 : protocol 76 | TODO |

Notes while implementing (addresses, salts, `PoolManager` used):

- TODO

## Running log — blockers and friction

Add a row when something slows V4 work. Leave unused rows blank. Times in KST.

| Date / time (KST) | Area | Issue | Workaround | Suggestion |
|---|---|---|---|---|
| TODO | TODO (Hook / Locker / graduation / docs / tooling) | TODO | TODO | TODO |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

## Docs / tooling gaps

TODO — cite the page, repo, or tool. No guesses.

- TODO

## What worked well

TODO — only what we actually used.

- TODO

## Test status

TODO — replace with the real command and result when tests exist. Until then this is a placeholder.

```text
cd contracts && forge build && forge test
# result: TODO
```

SPEC asks for three fuzz tests once the curve and pool exist: solvency; a fee-inclusive round trip never gains; graduation price vs pool start price gap under 0.0068%. Record pass/fail here only after those tests run.

- Solvency: TODO
- Round trip never gains: TODO
- Graduation vs pool start price: TODO
