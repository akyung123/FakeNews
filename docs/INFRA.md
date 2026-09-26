# Infra

How a person deploys contracts to Sepolia, how the web app is hosted, and which values a human must provide. Agents prepare and dry-run. A person broadcasts.

Related: [INTERFACE](INTERFACE.md) section 5 (env names), [ENSV2](ENSV2.md) section 0 (addresses), [PLAN](PLAN.md) sections 1 and 6, skill `deploy-sepolia`.

## Hosting (`web/`)

**GitHub Pages** is the host. It is a static site, needs no extra secret in the repo, and uses the default `GITHUB_TOKEN`.

1. Repo Settings → Pages → source **GitHub Actions**.
2. Set public `VITE_*` values as Actions **variables** (not repository secrets): Settings → Secrets and variables → Actions → Variables.
3. Push to `main` (paths under `web/`) or run the `pages` workflow by hand.
4. The site is served at `https://akyung123.github.io/Prophecy/` (`VITE_BASE=/Prophecy/`).

The workflow copies `index.html` to `404.html` so client-side routes do not 404 on refresh.

Do not put `DEPLOYER_PRIVATE_KEY`, `WORLD_RP_SIGNING_KEY` or `WORLD_SIGNER_KEY` in Actions variables. Those never go to the static build.

Vercel also works (`web/` is a Vite app) if the team prefers it later. This repo ships the Pages workflow so hosting does not depend on a third-party account.

## Sepolia deploy

Contracts are still a skeleton (`ProphecyFactory` / `ProphecyCoin`). The script deploys what exists and is written so Launchpad, `ProphecyHook` and `LiquidityLocker` can be added next to it. Do not implement curve or ENS lock logic here.

### Dry-run (default)

From `contracts/`, with env loaded (see below):

```bash
./script/run-sepolia.sh script/Deploy.s.sol
```

Same as `forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL` with no send flag.

Parent name, two steps, 60 seconds apart:

```bash
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
# wait 60 seconds
./script/run-sepolia.sh script/RegisterParent.s.sol --sig "registerName()"
```

### Broadcast (person only)

Add the send flag. The wrapper also requires `DEPLOYER_PRIVATE_KEY` in the environment:

```bash
./script/run-sepolia.sh script/Deploy.s.sol --broadcast
```

Agents must not run that. After a successful send, copy `deployments/sepolia.example.json` to `deployments/sepolia.json` and fill in the new addresses.

### After Launchpad exists

1. Recheck ENS addresses in [ENSV2](ENSV2.md) section 0 against docs.ens.domains/learn/deployments.
2. Recheck the Uniswap v4 `PoolManager` on Sepolia.
3. Mine a CREATE2 salt so the hook address carries the permission flags. Put it in `HOOK_SALT`.
4. Compute hook and launchpad addresses before deploying either (they point at each other).
5. Dry-run, then a person broadcasts.
6. Grant the Launchpad `ROLE_REGISTRAR` on the parent UserRegistry ([PLAN](PLAN.md) section 1). The final lock is irreversible — confirm with a person first.

## Human-input checklist

A person provides every item. Nothing below is stored in git except the env **names**.

### Team wallet and gas

- [ ] A team wallet that will own `prophecy.eth` and deploy.
- [ ] Sepolia ETH on that wallet (gas).
- [ ] Env: `TEAM_WALLET`

### RPC

- [ ] A Sepolia JSON-RPC URL. Use a public endpoint or a personal key kept out of git.
- [ ] Env: `SEPOLIA_RPC_URL` (Foundry), `VITE_RPC_URL` (web; may be the same URL)

### Deploy key and fee recipient

- [ ] Deployer private key for the team wallet. Local env only. Never paste it into a workflow file, a chat, or git.
- [ ] Protocol fee recipient address (still undecided in [DECISIONS](DECISIONS.md); pick it before Launchpad deploy).
- [ ] Env: `DEPLOYER_PRIVATE_KEY`, `PROTOCOL_FEE_RECIPIENT`

### World ID (issue flow only)

Create an app in the World Developer Portal (Sepolia / staging). Buying and browsing are not verified.

- [ ] App ID
- [ ] Action name(s) for issuing a prophet name
- [ ] RP id if the IDKit 4 / Portal v4 action uses a relying party
- [ ] Env (web): `VITE_WORLD_APP_ID`, `VITE_WORLD_ACTION`, `VITE_WORLD_RP_ID`
- [ ] Env (world server, when it exists): `WORLD_APP_ID`, `WORLD_ACTION`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_SIGNER_KEY`
- [ ] Env (Launchpad constructor): `WORLD_SIGNER` — the address that matches `WORLD_SIGNER_KEY`

### `prophecy.eth` on Sepolia ENS

Follow [ENSV2](ENSV2.md) section 6 and [PLAN](PLAN.md) section 1. Confirm the name is still free first.

1. `mint` MockUSDC (`0x16f95D91DBa7dA3Aca778Ec053dF0FF6C6A8aA8e`) to the team wallet. 5+ character names cost about $8 / year in that token.
2. Set `PARENT_LABEL=prophecy`, `ENS_REGISTRATION_SECRET` (a local random `bytes32`), `ENS_DURATION_SECONDS` (default one year).
3. Dry-run, then a person broadcasts `commit()`.
4. Wait **60 seconds**.
5. A person broadcasts `registerName()` (the script approves MockUSDC and calls `register`).
6. Later: deploy the parent UserRegistry, `setSubregistry`, `setParent`, grant Launchpad `ROLE_REGISTRAR`. Last: the lock.

Env: `PARENT_LABEL`, `ENS_REGISTRATION_SECRET`, `ENS_DURATION_SECONDS`, `TEAM_WALLET`

### Web after deploy

- [ ] `VITE_LAUNCHPAD_ADDRESS` — the deployed Launchpad (or today's factory, for a smoke test)
- [ ] `VITE_PARENT_NAME` — `prophecy.eth` once registered, otherwise a name the team already owns
- [ ] `VITE_UNIVERSAL_RESOLVER` — already filled from [ENSV2](ENSV2.md) section 0
- [ ] `VITE_BASE` — `/` locally; `/Prophecy/` on GitHub Pages

## Env file layout

Copy [`.env.example`](../.env.example) locally. Names only in git.

| File | Who reads it |
|---|---|
| `web/.env` | Vite (`VITE_*`) |
| `contracts/.env` | Foundry (`SEPOLIA_RPC_URL`, keys, fee recipient, ENS) |
| `world/.env` | World server (not started) |

Foundry also accepts exported shell variables. `foundry.toml` maps `sepolia` to `SEPOLIA_RPC_URL`.

## CI

`.github/workflows/ci.yml` on every PR and on `main`:

| Job | Command | Today |
|---|---|---|
| `contracts` | `forge build` and `forge test` | Passes on the skeleton |
| `web` | `bun install`, `lint`, `typecheck`, `build` | Passes. `lint` is `tsc --noEmit` until the web lane adds ESLint |
| `world` | install / lint / typecheck / build / test | **Skipped** — `world/` is not in the repo. The job is kept so it runs when the folder appears. Not a fake pass. |

## What this folder does not do

- It does not write curve, fee, graduation or ENS-lock logic.
- It does not store a prophecy sentence or deadline (those live only on the prophecy resolver).
- It does not broadcast, and it does not merge to `main`.
