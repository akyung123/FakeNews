# Prophecy — agent guide

People and agents both start here. The human-oriented guide is [`CONTRIBUTING.md`](CONTRIBUTING.md).

## What this is

A launchpad that turns a one-line prophecy into a token. Buying raises the price and selling lowers it. When the curve supply sells out, liquidity moves into a Uniswap V4 pool and is locked.

- **No judging.** No oracle, no True / False. No deadline either: once issued, a prophecy keeps trading.
- **The address book is the core feature.**
  - `ringo.prophecy.eth` → the prophet's wallet
  - `lingo-2028.ringo.prophecy.eth` → that prophecy's token
- **Human check (World ID) only when issuing.** One prophet name per person.

## Folders

| Path | Role | Check |
|------|------|-------|
| `contracts/` | Foundry: `Launchpad`, `ProphecyToken`, `ProphecyHook`, `LiquidityLocker` (currently a skeleton with older names) | `cd contracts && forge build && forge test` |
| `web/` | Vite + React 19 + viem. Currently a prototype without a chain | `cd web && bun install && bun run build` |
| `world/` (not yet) | World ID verification server | `cd world && bun test` |
| `docs/` | Spec, decisions, interface, plan, notes | — |

## Rules you must not break

1. **Never push to `main` and never merge.**
   - Only the repo owner (@akyung123) merges into `main`.
   - Agents push to a branch and open a PR. That is the end of the job.
   - Forbidden: `gh pr merge`, `git push origin main`, any force-push to `main`.
2. **A prophecy's sentence lives only in that prophecy's own ENS resolver.**
   - Never store it again in contract storage, events or a server.
   - The UI reads it from ENS. Never hardcode it.
3. **For ENSv2, the official docs (beta) are the source of truth.**
   - Take addresses only from section 0 of [`docs/ENSV2.md`](docs/ENSV2.md).
   - Do not use the older addresses on the contracts-v2 main branch.
4. **One network: Sepolia.**
5. **A prophecy, once written, cannot be changed by anyone.** Any change that widens an EAC role goes through the lock tests and the `contract-reviewer` agent.
6. **Do not reverse decisions on your own.**
   - If a row in [`docs/DECISIONS.md`](docs/DECISIONS.md) looks wrong, ask a person.
   - When a decision changes, add a new row.
7. **[`docs/INTERFACE.md`](docs/INTERFACE.md) is the contract between folders.** Change it first, in the same PR as the code.
8. **No secrets in the repo.**
   - Do not read `.env`.
   - `--broadcast` and `cast send` are run by a person.
9. **English everywhere in the repo.**
   - This covers Markdown, code comments, UI copy, sample data, commit messages and PR descriptions.
10. **Product reasons only.** Every reason written in the repo is about the product and its users.

## How to work

1. Pick one checkbox in your lane in [`docs/PLAN.md`](docs/PLAN.md) and add `@yourname`.
2. Create a branch named `<lane>/<short-topic>` (e.g. `contracts/curve-math`).
3. Implement. The check command for every folder you touched must pass.
4. Tick the box in PLAN.md, fill in the PR template and open a PR. Do not merge.

- **Skills** (`.claude/skills/`)
  - `ens-change`: any ENS-related change
  - `deploy-sepolia`: preparing a deployment
  - `demo-publish`: updating the demo page
- **Review:** run the `contract-reviewer` agent on the diff before opening a contracts PR.
- **Other lanes' folders:** do not edit them. Change the contract in INTERFACE.md and say so in the PR.

## Docs

| Doc | Contents |
|-----|----------|
| [`docs/README.md`](docs/README.md) | Map: who reads what |
| [`docs/SPEC.md`](docs/SPEC.md) | Product spec (source of truth) |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisions and spec review |
| [`docs/INTERFACE.md`](docs/INTERFACE.md) | Contract between folders |
| [`docs/PLAN.md`](docs/PLAN.md) | Task board |
| [`docs/ENSV2.md`](docs/ENSV2.md) | ENSv2 notes and Sepolia addresses |
