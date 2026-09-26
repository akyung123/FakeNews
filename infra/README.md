# Infra

Sepolia deploy, GitHub Pages, and the values a person must provide. Agents dry-run. A person sends.

Allowed files for this lane: `.github/`, `contracts/script/`, hosting workflows, this folder, `.env.example`, and this lane's PLAN lines.

## Preview (`web/`)

GitHub Pages workflow is a **separate PR**. Expected URL: `https://akyung123.github.io/Prophecy/`

A person must enable Settings → Pages → source **GitHub Actions**. Until that is on, the deploy job fails. Zero extra secrets. Public `VITE_*` go in Actions variables.

Preview/demo builds hard-code `VITE_WORLD_MOCK=0` (OFF). Mock is ON unless the value is exactly `0` or `false` (PR #20). The Pages workflow fails if mock resolves to ON. Recording with mock ON is not valid World ID evidence.

## World server hosting (Render)

`world/` is a Bun service. It cannot go on GitHub Pages. **One candidate: [Render](https://render.com) free Web Service.**

Blueprint: [`infra/render.yaml`](render.yaml) (not the repo root — a root `render.yaml` would collide with other lanes). In the dashboard: New Blueprint → connect this GitHub repo → set the Blueprint path to `infra/render.yaml`. Render builds from `world/` (`bun start`, health check `/health`). It installs Bun in the build step. Listen on the `PORT` Render injects (local default is `8787`).

A **human needs a Render account connected to GitHub**. Infra does not create the account. The account is provided with the **17:00 KST user-value bundle** (the four Portal values below). Env names in the blueprint are `sync: false` with **no values** — a person pastes them in the dashboard. Never commit secrets.

After the service is up, set `VITE_WORLD_SERVER_URL` to the `https://….onrender.com` origin. Not a blocker for contract dry-run or the static web preview.

`context_mismatch` is a world/ error code (backend follow-up). No extra env names.

### Demo

Render's free plan sleeps when idle. A cold start takes tens of seconds.

1. Before recording, confirm the local `WORLD_SIGNER_KEY` matches on-chain `Launchpad.worldSigner()` (exits non-zero if they differ):

```bash
./infra/check-world-signer.sh
```

2. Confirm the Pages preview has mock OFF (no "Simulate failure" / "Mock World ID" notice). Then re-run Pages if the Actions variables just changed.

3. Right before recording, call `GET <world-url>/health` once to wake the server:

```bash
curl -sS https://<world-url>/health
```

### Fallback (no Render account in time)

For the demo recording, run the world server locally and expose it with a Cloudflare quick tunnel:

```bash
cd world && bun start
# other terminal
cloudflared tunnel --url http://localhost:8787
```

Point `VITE_WORLD_SERVER_URL` at the `https://….trycloudflare.com` origin.

### Submission README

If the fallback is used, the ETHGlobal submission README must state:

> The World verification server ran locally and was exposed with a Cloudflare quick tunnel (`cloudflared tunnel --url http://localhost:8787`) for the demo recording.

After a person sets the Actions secret `SEPOLIA_RPC_URL` and re-runs CI on `main`, paste that Actions run URL into the submission README as evidence that the four `LockReal` tests ran without skip.

## Sepolia (dry-run default)

From `contracts/`, with `contracts/.env` filled:

```bash
# once, locally — generates WORLD_SIGNER_KEY + WORLD_SIGNER_ADDRESS (do not commit)
../infra/new-world-signer.sh

./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
# wait 60 seconds
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "registerName()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployUserRegistry()"
./script/run-sepolia.sh script/Deploy.s.sol
# TODO(#17): deploy adapter — launchpad, parentRegistry, parent DNS name,
# factory, UserRegistryImpl, PermissionedResolverImpl
./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployAdapter()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "linkParent()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "grantLaunchpadRegistrar()"
```

Sending is opt-in and needs `DEPLOYER_PRIVATE_KEY` in the environment, never on argv.

`Deploy.s.sol` deploys the current `ProphecyFactory` stub. When PR #8 merges, call `new Launchpad(protocolFeeRecipient, worldSigner)`. Both args are immutable; zero address reverts. There is no setter. `worldSigner` is derived from `WORLD_SIGNER_KEY` (generated at deploy, never committed). `protocolFeeRecipient` is `PROTOCOL_FEE_RECIPIENT`.

Adapter wiring (`ProphecyEns` constructor) is TODO until #17 and #8 merge.

The script prints paste-ready lines for a visual check: `WORLD_CHAIN_ID=11155111`, `WORLD_LAUNCHPAD_ADDRESS=<deployed Launchpad>`, and `worldSigner address: 0x…` (address only, never the private key).

**Mandatory after Launchpad deploy.** Set these on Render and restart the world service. Empty `WORLD_CHAIN_ID` / `WORLD_LAUNCHPAD_ADDRESS` turns the server-side context check off (PR #16).

The key whose address becomes Launchpad `worldSigner` **must** be the same key the world server signs with.

```
WORLD_CHAIN_ID=11155111
WORLD_LAUNCHPAD_ADDRESS=<deployed Launchpad>
WORLD_SIGNER_KEY=<paste from the local infra/new-world-signer.sh output only>
```

Never commit `WORLD_SIGNER_KEY`. Never print it in CI logs. A person pastes it from the local generation output onto Render as a secret.

**Then set GitHub Actions variables** (Settings → Secrets and variables → Actions → Variables — public, not secrets) and re-run the Pages deploy:

| Variable | Value |
|----------|--------|
| `VITE_WORLD_SERVER_URL` | Render `https://….onrender.com` origin |
| `VITE_LAUNCHPAD_ADDRESS` | Deployed Launchpad |
| `VITE_CHAIN_ID` | `11155111` |

Before recording, open https://akyung123.github.io/Prophecy/ and confirm mock is OFF: no "Simulate failure" button and no "Mock World ID" notice. Recording with mock ON is not valid World ID evidence.

## Human-input checklist (names only)

### From the user (via lead, by 17:00 KST)

Exactly these four World Developer Portal values:

| Env name | What it is |
|----------|------------|
| `WORLD_APP_ID` | Portal app id |
| `WORLD_ACTION` | IDKit action name |
| `WORLD_RP_ID` | Relying-party id (IDKit 4) |
| `WORLD_RP_SIGNING_KEY` | RP signing key |

Also needed from a person (not World Portal):

| Env name | What it is |
|----------|------------|
| `TEAM_WALLET` | Team address + Sepolia ETH |
| `SEPOLIA_RPC_URL` / `VITE_RPC_URL` | Sepolia JSON-RPC (no API key in git). Deploy scripts and PR #19 fork lock tests read `SEPOLIA_RPC_URL`. Web reads `VITE_RPC_URL`. Same RPC value. |
| `DEPLOYER_PRIVATE_KEY` | Deploy key (local only) |
| `PROTOCOL_FEE_RECIPIENT` | TBD wallet |

### Generated by infra at deploy (never from the user, never committed)

| Env name | How |
|----------|-----|
| `WORLD_SIGNER_KEY` | `infra/new-world-signer.sh` (`cast wallet new`) |
| `WORLD_SIGNER_ADDRESS` | Printed by that helper; deploy also derives it from the key |

### Mandatory after Launchpad deploy (paste onto Render and restart)

Empty `WORLD_CHAIN_ID` / `WORLD_LAUNCHPAD_ADDRESS` turns the server-side context check **off** (PR #16). The deploy script prints the first two lines and the `worldSigner` **address**. Paste `WORLD_SIGNER_KEY` from the local `new-world-signer.sh` output only — never from CI.

| Env name | Value |
|----------|--------|
| `WORLD_CHAIN_ID` | `11155111` |
| `WORLD_LAUNCHPAD_ADDRESS` | Deployed Launchpad (today: factory stub address) |
| `WORLD_SIGNER_KEY` | Same private key used as Launchpad `worldSigner` (Render secret) |

### GitHub Actions secret (after the 17:00 bundle)

A person adds repo **Settings → Secrets and variables → Actions** → `SEPOLIA_RPC_URL` with the Sepolia RPC from the 17:00 bundle. Then re-run CI on `main` so the four `LockReal` tests (PR #19) run without skip.

Fork pull requests do not receive Actions secrets. Those runs stay skipped and must still pass.

Link that `main` Actions run in the ETHGlobal submission README as evidence the real-lock tests ran.

### Optional world server

`WORLD_ENVIRONMENT`, `WORLD_PORTAL_URL`, `PORT` (default `8787`).

This repo has one `.env.example`. Do not add `world/.env.example`.

## `prophecy.eth` runbook

1. Confirm the label is still free (`isAvailable`). PLAN §0 last checked it available on 2026-09-26.
2. `mint` MockUSDC on the team wallet (5+ chars ≈ $8 / year).
3. `commit()` → wait **60 seconds** → `registerName()`.
4. `deployUserRegistry()` — VerifiableFactory proxy of `UserRegistryImpl`.
5. Deploy Launchpad (`Deploy.s.sol`). Constructor: `protocolFeeRecipient`, `worldSigner` (PR #8).
6. Deploy the ENS adapter with `launchpad`, `parentRegistry`, parent DNS name, `factory`, `UserRegistryImpl`, `PermissionedResolverImpl` (TODO(#17) until merge).
7. `linkParent()` — `setSubregistry` on ETHRegistry, `setParent` on the new registry.
8. `grantLaunchpadRegistrar()` — `ROLE_REGISTRAR` to `LAUNCHPAD_ADDRESS` only.
9. Final lock is irreversible. A person confirms before anyone prepares it.

## CI

`ci.yml`: `forge build` + `forge test` with `SEPOLIA_RPC_URL` from the Actions secret (name only). If the secret is missing the PR #19 lock tests skip and CI still passes. Fork PRs do not get secrets. Web: `bun install` / `tsc` / `build`. World: `bun test`.
