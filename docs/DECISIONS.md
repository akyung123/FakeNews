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
| 2 | 09-25 | UI: black background, desktop first, left sidebar, text only (no avatars), blue accent | A prophecy is text, so text is the hero |
| 3 | 09-25 | One network: **Sepolia** | ENSv2 (beta) is deployed only there |
| 4 | 09-25 | For ENSv2, **the official docs are the source of truth**. Use the deployment the docs reference (contracts-v2 `71a3b73`, deployed 09-15) | The beta changes. The older deployment listed on the contracts-v2 main branch (June) has different functions |
| 5 | 09-25 | The sentence lives **only in a text record of that prophecy's own PermissionedResolver**. It is written at initialization and nobody ever gets the role to write that key | One fact, one place, so it can never diverge. ENS is the data layer, not a copy |
| 6 | 09-25 | Record permissions are granted **per key** (e.g. the prophet may edit `avatar` only) | Only the display records stay editable; everything else is locked |
| 7 | 09-26 | Curve and fees use **the constants in SPEC.md exactly**: supply 1B, curve 793.1M, LP 206.9M, virtual token 1.073B, `VIRTUAL_ETH = 7_058_378_514_689_194` wei (graduation at 0.02 ETH), fee 1.25% = prophet 0.30 + protocol 0.95 | Recomputed and matched: graduation 0.02 ETH, 14.70× price, 0.001 ETH buys 16.6% of supply, round trip returns ~0.000975, LP gap 0.0068% |
| 8 | 09-26 | Names nest: **prophet name, then prophecy name**. `ringo.prophecy.eth` → wallet, `lingo-2028.ringo.prophecy.eth` → token | The address book is the core feature |
| 9 | 09-26 | ~~Prophecies have a **deadline**. After it, the screen shows **Departed**. Still no judging~~ → #16 | ~~A departed prophecy stays next to the next buy~~ |
| 10 | 09-26 | **World ID (Proof of Human) only when creating a prophet name.** Store the nullifier: one prophet name per person. Buying and browsing are not verified | Issuing creates a lasting public record; the same person must not be able to reset it |
| 11 | 09-26 | On graduation, open a Uniswap V4 pool (ETH/token, 1%, tickSpacing 200, `ProphecyHook`) and lock the position in `LiquidityLocker`. `collect` only pays prophet 24 : protocol 76 | Principal can never be withdrawn; fees keep flowing |
| 12 | 09-26 | ~~(Proposed) Prophecy names never expire in ENS either~~ → #14 | |
| 13 | 09-26 | ~~(Needs team confirmation) Holder talk and trade memos~~ → #15 | |
| 14 | 09-26 | **Prophecy names never expire in ENS** (`type(uint64).max`), like prophet names. ~~The deadline lives only in the `deadline` text record, and Departed is computed from it~~ → #16 | Review A: an expired name stops pointing at the token and its label could be registered again. A prophecy must keep its name and token |
| 15 | 09-26 | **Trade memos: yes.** `buy` and `sell` take an optional one-line `memo` (at most 140 bytes) that is emitted in the `Trade` event and shown on the prophecy detail screen next to the trade. **Holder talk (a separate board for holders): not now**, possibly later | A memo rides on a transaction the trader sends anyway: no extra wallet prompt, no server, and every note is backed by a real trade. A holder board would need its own server |
| 16 | 09-26 | **No deadline.** A prophecy has no end date and no Departed status. `launch` takes no deadline, and the prophecy resolver holds only the `prophecy` text record. Replaces #9 and the deadline part of #14 | Nothing is judged, so a deadline only added a label. Without it a prophecy simply keeps trading, and issuing asks for one thing less |

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
- **So:** prophecy names never expire~~, and the deadline lives in a text record~~ (→ #16).

### B. `expiry = 0`

- Registering with an owner and `expiry = 0` reverts with `CannotSetPastExpiry`.
- "Never expires" is `type(uint64).max`, the same approach the docs call "infinite-duration claims".

### C. Role bits for the sentence record

- The role is `ROLE_SET_TEXT = 1 << 4`. The per-key resource is `keccak256(bytes(key))`.
- The `calls` in the resolver's `initialize(grants, calls)` run **without role checks**.
- **So:** write the sentence during initialization and never grant roles for that key. There is no role to remove afterwards.
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

### F. ~~Counting Departed~~ → #16

- Registries cannot enumerate children.
- ~~Count from `LabelRegistered` events or launchpad storage. Read each deadline from its resolver's text record.~~ No longer needed: there is no deadline.

### G. Putting the World ID nullifier on chain

- IDKit 4 verifies on a server (Portal v4 verify, done before in PactShare).
- The server signs `(nullifier, wallet)`, and the launchpad checks the signature and whether the nullifier was used.
- If an on-chain verification path is available at build time, prefer it.
