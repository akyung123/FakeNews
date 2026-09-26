# Decisions

One row per decision, with the reason.

- **Changing a decision:** never delete a row. Add a new row, strike through the old one (~~like this~~) and point to the new number (→ #N).
- **Agents** never reverse a decision here on their own. If one looks wrong, ask a person.
- **Precedence:** [`SPEC.md`](SPEC.md) is the product spec. When the two disagree, the latest row here wins, because this is where findings from the code land.
- **Reasons are about the product:** what a choice does for users or for the system.

## Decisions

| # | Date | Decision | Reason |
|---|------|----------|--------|
| 1 | 09-25 | A memecoin-style launchpad, **not a prediction market**. No judging, oracle or payout | Keep it simple and fun. The price says "people are here", not "this is true" |
| 2 | 09-25 | ~~UI: black background, desktop first, left sidebar, text only (no avatars), blue accent~~ → #17 | A prophecy is text, so text is the hero |
| 3 | 09-25 | One network: **Sepolia** | ENSv2 (beta) is deployed only there |
| 4 | 09-25 | For ENSv2, **the official docs are the source of truth**. Use the deployment the docs reference (contracts-v2 `71a3b73`, deployed 09-15) | The beta changes. The older deployment listed on the contracts-v2 main branch (June) has different functions |
| 5 | 09-25 | The sentence lives **only in a text record of that prophecy's own PermissionedResolver**. It is written at initialization and nobody ever gets the role to write that key | One fact, one place, so it can never diverge. ENS is the data layer, not a copy |
| 6 | 09-25 | Record permissions are granted **per key** (e.g. the prophet may edit `avatar` only) | Only the display records stay editable; everything else is locked |
| 7 | 09-26 | Curve and fees use **the constants in SPEC.md exactly**: supply 1B, curve 793.1M, LP 206.9M, virtual token 1.073B, `VIRTUAL_ETH = 7_058_378_514_689_194` wei (graduation at 0.02 ETH), fee 1.25% = prophet 0.30 + protocol 0.95 | Recomputed and matched: graduation 0.02 ETH, 14.70× price, 0.001 ETH buys 16.6% of supply, round trip returns ~0.000975, LP gap 0.0068% |
| 8 | 09-26 | Names nest: **prophet name, then prophecy name**. `ringo.prophecy.eth` → wallet, `lingo-2028.ringo.prophecy.eth` → token | The address book is the core feature |
| 9 | 09-26 | Prophecies have a **deadline**. After it, the screen shows **Departed**. Still no judging | A departed prophecy stays next to the next buy |
| 10 | 09-26 | **World ID (Proof of Human) only when creating a prophet name.** Store the nullifier: one prophet name per person. Buying and browsing are not verified | Issuing creates a lasting public record; the same person must not be able to reset it |
| 11 | 09-26 | On graduation, open a Uniswap V4 pool (ETH/token, 1%, tickSpacing 200, `ProphecyHook`) and lock the position in `LiquidityLocker`. `collect` only pays prophet 24 : protocol 76 | Principal can never be withdrawn; fees keep flowing |
| 12 | 09-26 | ~~(Proposed) Prophecy names never expire in ENS either~~ → #14 | |
| 13 | 09-26 | ~~(Needs team confirmation) Holder talk and trade memos~~ → #15 | |
| 14 | 09-26 | **Prophecy names never expire in ENS** (`type(uint64).max`), like prophet names. The deadline lives only in the `deadline` text record, and Departed is computed from it | Review A: an expired name stops pointing at the token and its label could be registered again. A departed prophecy must keep its name and token |
| 15 | 09-26 | **Trade memos: yes.** `buy` and `sell` take an optional one-line `memo` (at most 140 bytes) that is emitted in the `Trade` event and shown on the prophecy detail screen next to the trade. **Holder talk (a separate board for holders): not now**, possibly later | A memo rides on a transaction the trader sends anyway: no extra wallet prompt, no server, and every note is backed by a real trade. A holder board would need its own server |
| 17 | 2026-09-26 10:38 KST | **UI v2** (user approved; supersedes #2): home grid with a Closest to graduation featured slot; gold Buy / navy Sell and no red on the trade screen; no Prophet tag or badge; no holder share %. Sample data badge only in mock mode. | The board has to scan like a live list people can click through, and Sell must not look like a warning. Holder share and a Prophet badge add status the product does not judge. |
| 18 | 2026-09-26 | Applies on `cca`; supersedes #7 when `cca` merges to main. **CCA replaces the bonding curve** (option B2). Launchpad drops `buy` / `sell` / virtual reserves and calls official LBPStrategy `initializeDistribution`. Currency is ETH, auction is 25 blocks, graduation threshold is 0.02 ETH. Token still mints 1,000,000,000. `main` keeps #7 until that merge | The auction is how people show up for a new prophecy. A curve and an auction on the same token would be two prices. One path keeps the demo readable |
| 19 | 2026-09-26 | Applies on `cca`; supersedes #11 when `cca` merges to main. **Open market is official `LBPStrategy.migrate`.** Pool is ETH/token, fee 1% (`10000`), tickSpacing 200. `ProphecyHook` inherits `InitializerHook` with `authorized()` = LBPStrategy `0x95434E898Af471945Cab33D5064d2aC1A6Ba2000`. The PositionManager NFT goes to `LiquidityLocker`. `collect` still pays only prophet 24 : protocol 76. `recipient` and `tokensRecipient` are the protocol or Launchpad — never the prophet. `fundsRecipient` is the strategy | Principal must stay in the pool so later traders still have a market. Official migrate will not attach today’s Launchpad-only hook or a PoolManager-native locker, so the hook inherits the official gate and the locker holds the NFT |
| 20 | 2026-09-26 | Applies on `cca`; supersedes #15 when `cca` merges to main. **No trade memo on the CCA path.** Official `BidSubmitted` has no memo field. Holder talk is still not now | A memo needs a field the auction already emits. Adding one would mean a wrapper the official CCA does not have |
| 21 | 2026-09-26 | Applies on `cca`. **Deadline and auction are not linked.** ENS sentence / deadline and World ID stay exactly as on `main`. Departed is still `now >= deadline` in the UI. Auction blocks do not read the deadline | A departed prophecy can still be mid-auction or already in the pool. Mixing the two clocks would hide a live auction behind a date |
| 22 | 2026-09-26 | Applies on `cca`. **CCA implementation lives on the `cca` branch family** and reaches `main` only after the final gate. Gates (KST): 22:00 INTERFACE_CCA + contract skeleton; 02:00 Sepolia-fork four steps green (launch+create auction, bid, migrate opens v4 pool, swap); 03:30 web + deploy script wired. Miss any gate → submit the curve version on `main` | The curve on `main` is a working fallback. Landing a half-finished auction on `main` would leave the demo with no trade path |
| 23 | 2026-09-27 | **After the pool opens, trading happens in this app**, not on Uniswap's site. The detail screen swaps against the v4 pool through Universal Router 2.1.2 (INTERFACE_CCA §4.7 / §7.10) and the price line and chart read the pool's `slot0`. `View pool on Uniswap` stays as a link under the swap, not as the only way to trade | A launchpad that stops at graduation hands its traders to another site at the moment the market gets interesting. The pool is the product's own market, so the screen that shows the price should also take the trade |

## Not decided yet

- Parent name (`prophecy.eth`?)
- Protocol fee recipient address
- Whether to run the final lock (emancipation) before or during the demo

## Spec review (checked against code, 09-26)

Checked against `PermissionedRegistry.sol` and `PermissionedResolver.sol` at `71a3b73`, the Sepolia deployment the docs reference.

### A. An expired name stops pointing at the token → #14

- Once expired, `getResolver(label)` and `getSubregistry(label)` return `address(0)` (`_isExpired`: `block.timestamp >= expiry`).
- Resolution then falls back to the nearest ancestor's resolver. `lingo-2028.ringo...` could resolve through the prophet's resolver and return **the wrong address**.
- An expired label becomes `AVAILABLE`. The launchpad, which holds `ROLE_REGISTRAR`, could register the same label again.
- The 28-day grace period is a rule of the `.eth` registrar (second-level names). Our UserRegistry has no grace period; expiry is immediate.
- **So:** prophecy names never expire, and the deadline lives in a text record.

### B. `expiry = 0`

- Registering with an owner and `expiry = 0` reverts with `CannotSetPastExpiry`.
- "Never expires" is `type(uint64).max`, the same approach the docs call "infinite-duration claims".

### C. Role bits for the sentence record

- The role is `ROLE_SET_TEXT = 1 << 4`. The per-key resource is `keccak256(bytes(key))`.
- The `calls` in the resolver's `initialize(grants, calls)` run **without role checks**.
- **So:** write the sentence and deadline during initialization and never grant roles for those keys. There is no role to remove afterwards.
- Display records (`avatar`, `description`) go to the prophet via `grantSetterRoles`.
- In the demo, editing the sentence reverts with `EACUnauthorizedAccountRoles`.
- Resolver roles cannot be scoped per name (only per argument). That is why **each prophecy gets its own resolver**.

### D. Unregister paths

- Only accounts holding `ROLE_UNREGISTER` (on the root or on that name) can call `unregister`.
- If no registry's init grants and no `register` role bitmap include it, no path exists.
- Test it: `hasAssignees(ROOT, ROLE_UNREGISTER) == false`.
- **Remaining hole:** re-registering an expired label. Closed by #14. The launchpad also rejects labels it has already used.

### E. Each prophet needs a registry

- For `lingo-2028.ringo.prophecy.eth` to exist, `ringo` needs its own UserRegistry (subregistry).
- Deploy it with VerifiableFactory when the prophet name is created.
- Init grants give the launchpad only `ROLE_REGISTRAR`. The `setParent` roles are granted briefly and revoked right away.
- The registry is then `isEmancipated() == true` from birth.
- The prophet owns `ringo` with a role bitmap of 0: they cannot change the subregistry or resolver, and cannot transfer it.

### F. Counting Departed

- Registries cannot enumerate children.
- Count from `LabelRegistered` events or launchpad storage. Read each deadline from its resolver's text record.

### G. Putting the World ID nullifier on chain

- IDKit 4 verifies on a server (Portal v4 verify, done before in PactShare).
- The server signs `(nullifier, wallet)`, and the launchpad checks the signature and whether the nullifier was used.
- If an on-chain verification path is available at build time, prefer it.
