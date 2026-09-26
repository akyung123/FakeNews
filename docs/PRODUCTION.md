# Demo vs production

This page explains how the hackathon demo differs from a real service. The demo runs on Sepolia with demo-sized constants. Nothing here changes code or contracts; it only describes them.

Sources: [`PRD.md`](PRD.md), [`SPEC.md`](SPEC.md), [`DECISIONS.md`](DECISIONS.md), [`INTERFACE_CCA.md`](INTERFACE_CCA.md), [`../FEEDBACK.md`](../FEEDBACK.md), [`../infra/README.md`](../infra/README.md) and `contracts/src/`. Anything the repo does not answer is marked **Open question**.

## 1. Demo vs production

| | Demo (live on Sepolia) | Contract default | Production |
|---|---|---|---|
| Auction length | 10 blocks (~2 min) | 25 blocks (~5 min), `CcaLib.DEFAULT_AUCTION_BLOCKS` | 12–24 hours. **Proposed, Open question** |
| Graduation line | 0.02 ETH raised (`CcaLib.REQUIRED_CURRENCY_RAISED`, "demo scale" in SPEC) | same | **Open question** |
| Supply split | 500M auction / 500M LP (`AUCTION_SUPPLY`, `LP_SUPPLY`) | same | Same split assumed. **Open question** |
| Pool fee | 1% (`POOL_FEE = 10_000`), tickSpacing 200 | same | Same assumed. **Open question** |
| Chain | Sepolia only (DECISIONS #3) | — | Mainnet or an L2. **Open question** |

All of these values except the auction length are Solidity constants. Changing them means redeploying the Launchpad; prophecies already launched keep the old values.

### Why the auction should be longer

a. **Price discovery.** The CCA sells its supply in equal slices over the auction. That only works when many people bid across that time. A two-minute auction lets only the first viewers and bots take part, so a few wallets take most of the supply and the clearing price says little.

b. **Time to read and share.** A prophecy has to be shared, read and thought about before someone decides to bid. That takes hours, not minutes.

c. **Set it in hours, then convert to blocks.** The length should be decided as a time and converted using the chain's block time:

| Chain block time | 12 hours | 24 hours |
|---|---|---|
| 12 s (Ethereum, Sepolia) | ~3,600 blocks | ~7,200 blocks |
| 2 s (an L2 such as Base) | ~21,600 blocks | ~43,200 blocks |

   Note from the code: `CcaLib.packSteps` requires the block count to divide 10,000,000 exactly (uniform issuance, `mps × N = 1e7`). 3,600 and 7,200 do not, so today the nearest valid values on a 12 s chain are 3,125 (~10.4 h) or 4,000 (~13.3 h), and 6,250 (~20.8 h) or 8,000 (~26.7 h). Exact hour targets would need a different step schedule. **Open question.**

d. **Who can change it.** `setAuctionBlocks` can only be called by the deployer (FEEDBACK.md, `Launchpad.setAuctionBlocks`). The live value was set to 10 for the demo. It applies to prophecies launched after the change. Whether production keeps a single deployer key for this, or moves it to a multisig or a fixed constant, is an **Open question**.

## 2. Who does what

| Role | What they do | World ID? |
|---|---|---|
| **Prophet** | Verifies once and gets one prophet name (`ringo.prophecy.eth` → wallet). Then issues any number of prophecies under it with `launch`. Each prophecy gets its own token and name | Once, at `registerProphet` |
| **Investor** | Bids in the auction, claims tokens or a refund after it ends, and swaps on the pool after `migrate`. Anyone can call `migrate` | Never |
| **Protocol** | Receives its fee share and any auction leftovers. Does not judge prophecies | — |

Where money goes:

- **During the auction** nobody is paid. The CCA protocol fee is off on the official Sepolia factory (README, FEEDBACK).
- **If the auction does not reach the line**, bidders get refunds through `exitBid`, and `migrate` returns the LP reserve to the protocol; no pool opens (`Launchpad.isGraduated` comment).
- **After graduation**, the pool position NFT sits in `LiquidityLocker`, which has no withdraw function. `collect(token, tokenId)` can be called by anyone. It sends 24% of the collected fees to the prophet wallet stored at `launch` and 76% to `protocolFeeRecipient`. The caller receives nothing. If the ETH payment to the prophet fails, it is kept for them and they pull it with `withdrawAccrued`.
- `protocolFeeRecipient` is set in the Launchpad constructor and cannot change. Which wallet it should be in production (for example a multisig) is an **Open question** (PRD open question 6).

## 3. ENSv2

The address book runs on the ENSv2 beta, which is deployed only on Sepolia (DECISIONS #3, #4). SPEC states that these names do not move to mainnet.

A production service needs ENSv2 on its chain. How and when to move prophet and prophecy names after ENSv2 launches on mainnet is an **Open question**. Any move has to keep the rule that a written sentence can never be changed (DECISIONS #5).

## 4. World ID

One World ID nullifier gives one prophet name, bound to the wallet that registered it. The Launchpad marks the nullifier as used and never frees it.

Known problem: **if a prophet loses their wallet, they cannot register again.** Their nullifier is already used, and names cannot be transferred (SPEC, Permissions). The locker would also keep paying fees to the lost wallet.

Future work: let a prophet move their name to a new wallet by proving the same World ID again. This touches ENS roles, so it would go through the lock tests and the `contract-reviewer` agent (AGENTS.md rule 5).

## 5. Operating infrastructure

| Piece | Demo | Production need |
|---|---|---|
| World signing server (`world/`) | Render free web service. It sleeps when idle and a cold start takes tens of seconds (infra/README.md) | An always-on paid host with monitoring. Provider: **Open question** |
| Signing key (`WORLD_SIGNER_KEY`) | Generated locally by a person and pasted onto Render as a secret. Never committed | A managed key store or HSM. The Launchpad stores `worldSigner` as immutable, so rotating the key means redeploying the Launchpad. A rotation path is an **Open question** |
| RPC | A public, rate-limited endpoint for the web app (`VITE_RPC_URL`), and a separate private one for deploys | Paid RPC for the web app and any indexer. Real traffic will hit public rate limits. Provider: **Open question** |

## 6. Future work

From PRD "Later, if there is time":

- A holder-only discussion board (DECISIONS #15).
- An agent that drafts a prophecy, with the person verifying again before it is created.
- Paying out fees automatically on every pool trade. Today someone must call the locker's `collect`; SPEC lists moving distribution into the hook's `afterSwap` as a later extension.

Also:

- Moving a prophet name to a new wallet with World ID (section 4).

## 7. Known limits

- **`deadline` is not enforced.** `launch(slug, prophecy, deadline)` still takes a `deadline`. It is only written to the prophecy's `deadline` ENS text record. No contract reads it and nothing happens when it passes. The web app always sends 0 and never shows it (DECISIONS #18).
- **Constants need a redeploy.** Graduation line, supply split and pool fee are constants (section 1).
- **Stale graduation view.** After the auction's end block, `isGraduated` can be stale until someone calls `checkpoint` (Launchpad comment).
