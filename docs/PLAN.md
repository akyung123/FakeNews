# Plan

One checkbox = one task.

- **Starting:** add `@yourname` at the end of the line and create a branch.
- **Finishing:** tick the box in the same PR.
- **Sources:** design in [SPEC](SPEC.md), reasons in [DECISIONS](DECISIONS.md), contracts between folders in [INTERFACE](INTERFACE.md).

Lanes follow folders. One lane = one person (or one agent session).

## 0. Decide first (people)

- [x] Parent name: `prophecy.eth` is **available** (unregistered) on Sepolia @pm
  - **When:** 2026-09-26 00:44:45 UTC, Sepolia block `11782784` (chain id `11155111`)
  - **How (read-only, no transaction):** `cast call` on the ENSv2 Sepolia contracts from [`ENSV2.md`](ENSV2.md) section 0
    - `ETHRegistrar.isAvailable("prophecy")` → `true` at `0xAbe76F6C8DFcEd81AA5A2bB8034202A7136b94ca`
    - `ETHRegistry.getStatus(labelhash("prophecy"))` → `0` (AVAILABLE); `findOwner` → `0x000…000`
  - **RPC:** `https://ethereum-sepolia-rpc.publicnode.com` (no API key). Rechecked `isAvailable` → `true` on `https://sepolia.gateway.tenderly.co` at block `11782786`
  - **Labelhash:** `0xf87aa1f4cb920e28a5053843170f04ad57b375ed62a4bf90c08fc577e3631e44`
- [x] DECISIONS #14: prophecy names never expire
- [x] DECISIONS #15: trade memos yes, holder talk not now
- [x] Protocol fee recipient: **TBD** (person provides the address at deploy). Launchpad takes it as a constructor argument (DECISIONS #16, INTERFACE §2) @pm
- [x] Who owns which lane @pm

| Lane | Owns |
|------|------|
| PM | Scope, PLAN, DECISIONS, demo timing |
| Backend | `contracts/` and the `world/` verification server |
| Frontend | `web/` |
| Infra | CI, Sepolia deploy skeleton, static hosting |
| Designer | UI copy and the demo storyboard |

## 1. ENS setup (`contracts/script`, one team wallet)

- [ ] Get Sepolia ETH, `mint` MockUSDC
- [ ] Register `prophecy.eth`: `commit`, wait 60s, `register` ([ENSV2 section 6](ENSV2.md#6-building-a-subname-registrar))
- [ ] Deploy the parent UserRegistry, `setSubregistry`, `setParent`
- [ ] Grant the Launchpad `ROLE_REGISTRAR`
- [ ] Create one subname by hand and check that `getEnsAddress` resolves it
- [ ] (Last) Lock
  - revoke the dangerous roles on the parent registry
  - on the `.eth` side, revoke `SET_SUBREGISTRY` for `prophecy`

## 2. Contracts (`contracts/`)

- [ ] `forge install ensdomains/contracts-v2`, remappings
- [ ] `ProphecyToken`
- [ ] `Launchpad` curve
  - SPEC constants exactly
  - reserves in a struct
  - a separate fee ledger
  - rounding rules
- [ ] `Launchpad.registerProphet`: server signature and nullifier checks, then prophet name + prophet registry + prophet resolver
- [ ] `Launchpad.launch`: initialize the prophecy resolver (sentence, deadline, address), register the name, mint the token
- [ ] Graduation: fill only the remaining supply and refund, `complete`, V4 pool, `LiquidityLocker`
- [ ] `ProphecyHook`: `beforeInitialize` allows only the Launchpad. Mine the CREATE2 salt
- [ ] `LiquidityLocker.collect`: 24 : 76
- [ ] `memo` on `buy` / `sell`, emitted in `Trade`, reverts above 140 bytes
- [ ] Tests
  - [ ] Lock tests: editing the sentence reverts, transfer reverts, swapping the resolver reverts, `hasAssignees(ROOT, UNREGISTER) == false`
  - [ ] Three fuzz tests: solvency, a round trip never gains, graduation vs pool start price gap < 0.0068%
  - [ ] World: reusing a nullifier reverts, a bad signature reverts
- [ ] Sepolia deploy script (skill `deploy-sepolia`)

## 3. Web (`web/`)

- [ ] Replace the prototype curve constants with SPEC values (`src/lib/curve.ts`)
- [ ] wagmi + viem, Sepolia only
- [ ] Screen 1: prophecy list (name, sentence, price, Departed count)
- [ ] Screen 2: issue
  - the issue button turns on only after World verification
  - cancelling or failing disables it
- [ ] Screen 3: prophecy detail
  - find the token by name
  - buy and sell
  - no True / False
  - optional one-line memo on buy and sell; recent trades listed with their memos
  - replace the prototype's holder talk with trade memos
- [ ] Screen 4: prophet page. Departed prophecies next to the next buy, claimable fees, sell button
- [ ] Every sentence is read from ENS. Nothing hardcoded
- [ ] Republish the demo page (skill `demo-publish`)

## 4. World verification server (`world/`, new folder)

- [ ] IDKit 4 rp-context, Portal v4 verify (see PactShare `apps/back/src/lib/worldid.ts`)
- [ ] On success, sign in the format of INTERFACE section 3

## 5. Demo

- [ ] Create a prophecy with a 2-minute deadline beforehand so it is already Departed
- [ ] Record the five scenes in SPEC "Demo" (2–4 minutes)

## If there is time

- [ ] Holder talk: a holder-only board (DECISIONS #15 leaves it for later)
- [ ] Agent draft: an agent drafts, a person verifies again before the mint
- [ ] Fee distribution in `afterSwap`
