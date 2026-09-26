---
name: deploy-sepolia
description: Prepare a Sepolia deployment of the contracts — scripts, address bookkeeping, env files and a dry run. Use when deploying or redeploying Launchpad, hook, locker or the ENS setup. The agent prepares; a person broadcasts.
---

# Deploy to Sepolia

An agent prepares everything and runs a dry run. **A person runs the broadcast.** The Bash guard blocks `--broadcast` and `cast send`.

1. **Preconditions**
   - `forge build && forge test` pass in `contracts/`.
   - ENS addresses in `docs/ENSV2.md` section 0 were rechecked against docs.ens.domains/learn/deployments.
   - The Uniswap V4 `PoolManager` address on Sepolia is recorded.
2. **Hook and launchpad addresses**
   - Compute both before deploying (they depend on each other).
   - Mine a CREATE2 salt whose address carries the hook permission flags.
   - Write the salt and both addresses into the script.
3. **Constants:** `VIRTUAL_ETH` and the other constants match `docs/SPEC.md`. They cannot change after deployment.
4. **Dry run:** `forge script script/Deploy.s.sol --rpc-url $RPC_URL` (no `--broadcast`), then read the simulated addresses.
5. **Hand off to a person:** give them the exact broadcast command. They run it with their own `PRIVATE_KEY`.
6. **After the broadcast**
   - Record the addresses in `contracts/deployments/sepolia.json`.
   - Update `.env.example` (names only, never values) and `docs/INTERFACE.md` if any address variable changed.
7. **ENS setup** (first time only)
   - Follow `docs/PLAN.md` section 1.
   - The final lock (emancipation) is irreversible. Confirm with a person before preparing it.
