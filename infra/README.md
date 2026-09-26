# Infra

Sepolia deploy, GitHub Pages, and the values a person must provide. Agents dry-run. A person sends.

Allowed files for this lane: `.github/`, `contracts/script/`, hosting workflows, this folder, `.env.example`, and this lane's PLAN lines.

## Preview (`web/`)

GitHub Pages workflow is a **separate PR**. Expected URL: `https://akyung123.github.io/Prophecy/`

A person must enable Settings → Pages → source **GitHub Actions**. Until that is on, the deploy job fails. Zero extra secrets. Public `VITE_*` go in Actions variables.

## Sepolia (dry-run default)

From `contracts/`, with `contracts/.env` filled:

```bash
./script/run-sepolia.sh script/Deploy.s.sol
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
# wait 60 seconds
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "registerName()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployUserRegistry()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "linkParent()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "grantLaunchpadRegistrar()"
```

Sending is opt-in (`--broadcast` on the wrapper) and needs `DEPLOYER_PRIVATE_KEY` in the environment, never on argv.

`Deploy.s.sol` deploys the current `ProphecyFactory` stub. When Launchpad lands, swap that one line and pass `PROTOCOL_FEE_RECIPIENT` / `WORLD_SIGNER` into the constructor.

## Human inputs (names only)

| Need | Env name |
|------|----------|
| Team wallet + Sepolia ETH | `TEAM_WALLET` |
| Sepolia RPC (no API key in git) | `SEPOLIA_RPC_URL`, `VITE_RPC_URL` |
| Deployer key (person, local) | `DEPLOYER_PRIVATE_KEY` |
| Protocol fee recipient (TBD) | `PROTOCOL_FEE_RECIPIENT` |
| World Portal app / action / RP id | `VITE_WORLD_APP_ID`, `VITE_WORLD_ACTION`, `VITE_WORLD_RP_ID`, `WORLD_APP_ID`, `WORLD_ACTION`, `WORLD_RP_ID` |
| World server URL (web) | `VITE_WORLD_SERVER_URL` |
| World server keys (local) | `WORLD_RP_SIGNING_KEY`, `WORLD_SIGNER_KEY` |
| World server optional | `WORLD_ENVIRONMENT`, `WORLD_PORTAL_URL`, `PORT` |
| Launchpad signer address | `WORLD_SIGNER` |
| Parent label + commit secret | `PARENT_LABEL`, `ENS_REGISTRATION_SECRET`, `ENS_DURATION_SECONDS` |
| After Launchpad exists | `LAUNCHPAD_ADDRESS`, `PARENT_USER_REGISTRY` |
| Upcoming web contracts / wallet | `VITE_HOOK_ADDRESS`, `VITE_LOCKER_ADDRESS`, `VITE_WALLETCONNECT_PROJECT_ID` |

This repo has one `.env.example` (this lane). Do not add `world/.env.example`. Other lanes list new names in their PR bodies and infra collects them here.

## `prophecy.eth` runbook

1. Confirm the label is still free (`isAvailable`). PLAN §0 last checked it available on 2026-09-26.
2. `mint` MockUSDC on the team wallet (5+ chars ≈ $8 / year).
3. `commit()` → wait **60 seconds** → `registerName()`.
4. `deployUserRegistry()` — VerifiableFactory proxy of `UserRegistryImpl`.
5. `linkParent()` — `setSubregistry` on ETHRegistry, `setParent` on the new registry.
6. `grantLaunchpadRegistrar()` — `ROLE_REGISTRAR` to `LAUNCHPAD_ADDRESS` only.
7. Final lock is irreversible. A person confirms before anyone prepares it.

## CI

`ci.yml`: `forge build` + `forge test`; web `bun install` / `tsc` / `build`; world `bun test` (the only script `world/package.json` defines for checks).
