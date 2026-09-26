# Infra

Sepolia deploy, GitHub Pages, and the values a person must provide. Agents dry-run. A person sends.

Allowed files for this lane: `.github/`, `contracts/script/`, hosting workflows, this folder, `.env.example`, and this lane's PLAN lines.

## Preview (`web/`)

GitHub Pages workflow is a **separate PR**. Expected URL: `https://akyung123.github.io/Prophecy/`

A person must enable Settings → Pages → source **GitHub Actions**. Until that is on, the deploy job fails. Zero extra secrets. Public `VITE_*` go in Actions variables.

`VITE_RPC_URL` is shipped to browsers. Use a public / rate-limited Sepolia endpoint there — not the private deploy RPC stored as the `SEPOLIA_RPC_URL` Actions secret. Optional `VITE_WALLETCONNECT_PROJECT_ID` is also public; leaving it empty must not fail the Pages build.

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

Preferred path (one wallet, commit-reveal wait included). Does **not** lock the parent name:

```bash
# once, locally — generates WORLD_SIGNER_KEY + WORLD_SIGNER_ADDRESS (do not commit)
../infra/new-world-signer.sh

# from repo root. SEND=1 is person-only. WARP_COMMIT=1 on a local anvil fork.
./infra/scripts/deploy-sepolia.sh
SEND=1 ./infra/scripts/deploy-sepolia.sh
```

Equivalent step-by-step from `contracts/`:

```bash
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
# wait ~70 seconds (forge simulates a run before sending — do not combine with register)
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "fundPaymentToken()"
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "registerName()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployUserRegistry()"
# adapter first (predicted Launchpad CREATE address), then Launchpad, one broadcast
./script/run-sepolia.sh script/Deploy.s.sol
./script/run-sepolia.sh script/SetupParent.s.sol --sig "linkParent()"
./script/run-sepolia.sh script/SetupParent.s.sol --sig "grantAdapterRegistrar()"
```

Sending is opt-in and needs `DEPLOYER_PRIVATE_KEY` in the environment, never on argv. `TEAM_WALLET` defaults to that deployer; a different value reverts.

`Deploy.s.sol` creates `ProphecyEns` at the current nonce, then `Launchpad` at nonce+1, after predicting that address (`LaunchpadEns.t.sol`). Constructor: `new Launchpad(protocolFeeRecipient, worldSigner, ens)` — the order in `contracts/src/Launchpad.sol`. All three args are `public immutable`; zero address reverts. `setUniswap` is coming in the graduation / lock PR; do not call it from this script. Right after deploy the script requires `address(launchpad) == predictedPad`, `adapter.launchpad() == launchpad`, `launchpad.ens() == adapter`, plus the `#24` fee/signer checks. `worldSigner` is derived from `WORLD_SIGNER_KEY` (generated at deploy, never committed). `protocolFeeRecipient` is `PROTOCOL_FEE_RECIPIENT`. `ENS_ADAPTER_ADDRESS` is logged as an output. If that env var is already set, the script skips the adapter CREATE and uses it as `ens` (reject `0` and placeholder `0xe05` off anvil).

`grantAdapterRegistrar()` gives `ROLE_REGISTRAR` on the parent UserRegistry to the **adapter** (`ProphecyEns`), not the Launchpad. The old `grantLaunchpadRegistrar()` name reverts.

The deployer must be a **plain EOA**. `ETHRegistrar.register` mints an ERC-1155 to the owner; a wallet with code or an EIP-7702 delegation (the well-known Anvil addresses have 23-byte designations on Sepolia) reverts on `onERC1155Received`. Fork rehearsals should `anvil_setCode` that account to empty first.

Gas on a Sepolia fork (10 txs, ~4.27M gas, mint skipped because the account already held MockUSDC): about 0.0043 ETH at 1 gwei, 0.021 ETH at 5 gwei, 0.085 ETH at 20 gwei. A 0.05 ETH deployer balance covers 1–5 gwei, not 20 gwei. If `Deploy.s.sol` is split from `deployAdapter()`, do not send any other deployer transaction in between — the Launchpad CREATE nonce is predicted.

The script prints paste-ready lines for a visual check: `WORLD_CHAIN_ID=11155111`, `WORLD_LAUNCHPAD_ADDRESS=<deployed Launchpad>`, and `worldSigner address: 0x…` (address only, never the private key). After a send it also writes the deployment record below and prints `chainId`, `launchpad`, `launchpadBlock`, `adapter`, `parentUserRegistry`, `deployer`, and `commit`.

## Deployment record

After a successful **send** (`SEND=1` / `--broadcast`), `infra/scripts/write-deployment-record.sh` writes one JSON file. No private keys, RPC URLs, or signer keys.

| File | When |
|------|------|
| `deployments/sepolia.json` | Chain 11155111 on a remote Sepolia RPC. A person may commit this after the live send. |
| `deployments/anvil.json` | Anvil (`31337`) or a local / forked RPC (`127.0.0.1`, `localhost`, `WARP_COMMIT=1`). **Gitignored.** |

```json
{
  "chainId": 11155111,
  "launchpad": "0xLaunchpadAddress…",
  "launchpadBlock": 12345678,
  "adapter": "0xProphecyEnsAddress…",
  "parentUserRegistry": "0xParentUserRegistry…",
  "deployer": "0xDeployerAddress…",
  "commit": "<git rev-parse HEAD>"
}
```

JSON values are hex addresses or numbers — the ellipses above are documentation only.

`launchpadBlock` is the receipt block of the Launchpad CREATE (from Foundry `broadcast/Deploy.s.sol/<chainId>/run-latest.json`). Addresses are checksummed when Foundry logs them.

**Web** (INTERFACE §5):

| JSON field | Web |
|---|---|
| `launchpad` | `VITE_LAUNCHPAD_ADDRESS` (Actions variable / `web/.env`) |
| `launchpadBlock` | `VITE_LAUNCHPAD_DEPLOY_BLOCK` — `fromBlock` for `Launched`. Optional; empty = recent block range |
| `chainId` | `VITE_CHAIN_ID` is already `11155111` on Sepolia |

Stdout after a send (same keys, plus the web env lines to paste):

```
--- deployment ---
chainId=11155111
launchpad=0x…
launchpadBlock=11783750
adapter=0x…
parentUserRegistry=0x…
deployer=0x…
commit=7c075cd…
VITE_LAUNCHPAD_ADDRESS=0x…
VITE_LAUNCHPAD_DEPLOY_BLOCK=11783750
VITE_CHAIN_ID=11155111
wrote /…/deployments/sepolia.json
```

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
| `VITE_LAUNCHPAD_ADDRESS` | `launchpad` from `deployments/sepolia.json` |
| `VITE_LAUNCHPAD_DEPLOY_BLOCK` | `launchpadBlock` from that file. Optional; empty is allowed |
| `VITE_CHAIN_ID` | `11155111` |
| `VITE_RPC_URL` | Public / rate-limited Sepolia RPC (not the `SEPOLIA_RPC_URL` secret) |
| `VITE_PARENT_NAME` | `prophecy.eth` |
| `VITE_UNIVERSAL_RESOLVER` | ENSv2.md section 0 |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional, public. Empty is fine |

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
| `TEAM_WALLET` | Optional; defaults to the deployer. If set, must be that same address |
| `SEPOLIA_RPC_URL` | Private Sepolia RPC for deploy scripts and PR #19 fork tests (Actions secret). Do not ship this to the web app |
| `VITE_RPC_URL` | Public / rate-limited Sepolia RPC shipped to browsers (Actions variable) |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional, public WalletConnect project id |
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
| `WORLD_LAUNCHPAD_ADDRESS` | Deployed Launchpad |
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
2. Script mints MockUSDC via public `mint(address,uint256)` on the 71a3b73 token (`docs/ENSV2.md` section 0). If that mint is gone, fund the deployer by hand (5+ chars ≈ $8 / year).
3. `commit()` → wait **~70 seconds** → `registerName()` (`approve` the ETHRegistrar, `subregistry=0`, `resolver=0`). Same `DEPLOYER_PRIVATE_KEY` for every step.
4. `deployUserRegistry()` — VerifiableFactory proxy of `UserRegistryImpl`.
5. `Deploy.s.sol` — **adapter first** with a predicted Launchpad CREATE address, then Launchpad, in one broadcast. Constructor: `protocolFeeRecipient`, `worldSigner`, `ens`.
6. `linkParent()` — `setSubregistry` on ETHRegistry, `setParent` on the new registry, revoke `SET_PARENT`.
7. `grantAdapterRegistrar()` — `ROLE_REGISTRAR` to `ENS_ADAPTER_ADDRESS` (`ProphecyEns`) only.
8. Final lock is irreversible. **Do not run it from this script.** A person confirms before anyone prepares it.

## CI

`ci.yml`: `forge build` + `forge test` with `SEPOLIA_RPC_URL` from the Actions secret (name only). If the secret is missing the PR #19 lock tests skip and CI still passes. Fork PRs do not get secrets. Web: `bun install` / `tsc` / `build`. World: `bun test`.
