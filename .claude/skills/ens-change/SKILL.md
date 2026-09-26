---
name: ens-change
description: Checklist for any change that touches ENSv2 — registries, resolvers, EAC roles, names, text records, or reading names in the web app. Use before writing ENS-related code in contracts/ or web/.
---

# ENS change checklist

1. **Source of truth**
   - Use the official ENSv2 docs (beta).
   - Take addresses and ABIs only from `docs/ENSV2.md` section 0 (contracts-v2 `71a3b73`).
   - If the docs and anything else disagree, follow the docs and note it in the PR.
2. **Data placement**
   - The sentence (`prophecy`) and `deadline` are written once, in the prophecy resolver's `initialize(grants, calls)`.
   - `deadline` is a legacy record: the web app always sends 0 and never reads or shows it (DECISIONS #18).
   - They are never stored anywhere else (DECISIONS #5).
3. **Roles**
   - Nobody gets `ROLE_SET_TEXT` for `prophecy` / `deadline`.
   - Only display keys (`avatar`, `description`) are granted to the prophet via `grantSetterRoles`.
   - No `ROLE_UNREGISTER`, `ROLE_SET_SUBREGISTRY`, root `ROLE_SET_RESOLVER`, `ROLE_LINK`, `ROLE_UPGRADE` or `ROLE_CAN_TRANSFER_ADMIN` for anyone.
   - Temporary roles are revoked in the same transaction, admin included.
4. **Expiry:** `type(uint64).max` (DECISIONS #14). Never 0; it reverts with `CannotSetPastExpiry`.
5. **Names**
   - Setters take DNS-encoded names (`bytes`).
   - Reads go through the Universal Resolver (`getEnsText`, `getEnsAddress`).
   - Label rules are in `docs/INTERFACE.md` section 1.
6. **Tests to add or run**
   - editing `prophecy` reverts (`EACUnauthorizedAccountRoles`)
   - transferring a name reverts (`TransferDisallowed`)
   - `setResolver` / `setSubregistry` revert
   - `hasAssignees(ROOT_RESOURCE, ROLE_UNREGISTER) == false`
   - `isEmancipated() == true` for prophet registries
7. **Web:** nothing hardcoded. Every sentence on screen comes from ENS. The web never reads `deadline`.
8. **Docs:** if a name, key or role changes, update `docs/INTERFACE.md` in the same PR. If a decision changes, add a row to `docs/DECISIONS.md`.
