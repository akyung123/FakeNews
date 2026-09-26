# ENS lookup (demo evidence)

Read-only viem query against Sepolia ENSv2. Use this for demo scenes 1 and 2 if a reviewer opens `app.ens.domains` or `sepolia.app.ens.domains` (those do **not** read v2 — see PLAN §0).

## Run

```bash
cd infra
bun install
bun ens-lookup.ts lingo-2028.ringo.prophecy.eth
```

RPC: `SEPOLIA_RPC_URL` if set, otherwise `https://ethereum-sepolia-rpc.publicnode.com` (no API key). No private keys.

Prints `getEnsAddress`, the resolver, and text records `prophecy`, `deadline`, `avatar`, `description` (INTERFACE section 1) through UniversalResolverV2 (`docs/ENSV2.md` section 0).

Until `prophecy.eth` is registered, the script still runs: address and texts are `null`.
