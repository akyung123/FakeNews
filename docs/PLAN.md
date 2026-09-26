# Plan

One checkbox = one task.

- **Starting:** add `@yourname` at the end of the line and create a branch.
- **Finishing:** tick the box in the same PR.
- **Sources:** design in [SPEC](SPEC.md), reasons in [DECISIONS](DECISIONS.md), contracts between folders in [INTERFACE](INTERFACE.md).

Lanes follow folders. One lane = one person (or one agent session).

## 0. Decide first (people)

- [ ] Parent name: check that `prophecy.eth` is free on Sepolia
- [x] DECISIONS #14: prophecy names never expire
- [x] DECISIONS #15: trade memos yes, holder talk not now
- [ ] Protocol fee recipient
- [ ] Who owns which lane (write names here)

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

- [x] `forge install ensdomains/contracts-v2`, remappings @cursor
- [x] `ProphecyToken` @cursor-agent
- [x] `Launchpad` curve @cursor-agent
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
  - [x] Lock tests: editing the sentence reverts, transfer reverts, swapping the resolver reverts, `hasAssignees(ROOT, UNREGISTER) == false` @cursor
  - [ ] Three fuzz tests: solvency (done @cursor-agent), a round trip never gains (done @cursor-agent), graduation vs pool start price gap < 0.0068%
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
- [x] Screen 4: prophet page. Departed prophecies next to the next buy, claimable fees, sell button @cursor
- [ ] Every sentence is read from ENS. Nothing hardcoded
- [ ] Republish the demo page (skill `demo-publish`)

## 4. World verification server (`world/`, new folder)

- [x] IDKit 4 rp-context, Portal v4 verify (see PactShare `apps/back/src/lib/worldid.ts`) @cursor-agent
- [x] On success, sign in the format of INTERFACE section 3 @cursor-agent

## 5. Demo

- [ ] Rehearse scene 1 (prophet name registration with World ID) end to end on a local or forked chain first. On Sepolia scene 1 is one shot: one World ID gives one name.
- [ ] Record scene 1 on Sepolia (register `ringo.prophecy.eth`).
  - If it fails: record it again with another person's World ID and a different name.
  - Redeploying the contracts is the last resort only.
- [ ] Right after scene 1, off camera: issue a prophecy under `ringo` with a 2-minute deadline so it is already Departed for the later scenes.
- [ ] Record the remaining scenes in SPEC "Demo" (total 2–4 minutes, success and failure paths).
- [ ] If the ENS app cannot read Sepolia ENSv2 names: use the viem lookup script in `infra/` (`getEnsAddress` and text record) output as the external lookup evidence for scenes 1 and 2.
- [ ] `FEEDBACK.md` (Uniswap): keep notes of blockers during development; it is the fallback deliverable if Uniswap graduation is cut.

## If there is time

- [ ] Holder talk: a holder-only board (DECISIONS #15 leaves it for later)
- [ ] Agent draft: an agent drafts, a person verifies again before the mint
- [ ] Fee distribution in `afterSwap`
