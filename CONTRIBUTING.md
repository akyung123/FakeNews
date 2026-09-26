# Contributing

How the team works together. Read this once before your first PR.

## First 10 minutes

1. Read [`README.md`](README.md), then [`docs/SPEC.md`](docs/SPEC.md) up to "Screens".
2. Skim [`docs/DECISIONS.md`](docs/DECISIONS.md) so you know what is already settled.
3. Open [`docs/PLAN.md`](docs/PLAN.md), pick a task in your lane and add `@yourname` to it.
4. Run the check for your folder:

```bash
cd contracts && forge build && forge test
cd web && bun install && bun run build
```

## Branches and PRs

- **`main` is protected. Only @akyung123 merges into it.** Nobody else pushes or merges to `main`, including agents.
- One task = one branch = one PR.
- Branch name: `<lane>/<short-topic>`, e.g. `contracts/curve-math`, `web/issue-screen`, `docs/interface-events`.
- Open the PR early as a draft if you want feedback. Mark it ready when the checks pass.
- Fill in the PR template. It asks what changed, how you checked it, and whether INTERFACE.md changed.
- Keep PRs small. A reviewer should be able to read one in ten minutes.

## Lanes

| Lane | Folder | Owns |
|------|--------|------|
| contracts | `contracts/` | Launchpad, token, hook, locker, ENS adapter, deploy scripts |
| web | `web/` | The four screens, wallet, ENS reads |
| world | `world/` | World ID verification server |
| docs | `docs/` | Spec, decisions, plan |

Do not edit another lane's folder. If you need something from it, change [`docs/INTERFACE.md`](docs/INTERFACE.md) in your PR and tell that lane.

## Writing

- **Everything in the repo is in English:** Markdown, code comments, UI copy, sample data, commit messages, PR descriptions.
- Write the product reason for a choice: what it does for users or for the system.
- New decisions go into [`docs/DECISIONS.md`](docs/DECISIONS.md) as a new row with a reason. Never delete old rows.

## Secrets

- Never commit keys, `.env` files or RPC URLs with API keys. Copy `.env.example` to `.env` locally.
- Deployments with `--broadcast` are run by a person, never by an agent.

## Working with Claude Code

The repo ships agent settings in `.claude/`:

- **`AGENTS.md`** is loaded automatically (through `CLAUDE.md`). It holds the rules above.
- **Skills:** `ens-change`, `deploy-sepolia`, `demo-publish`. Invoke them by name, e.g. `/ens-change`.
- **Reviewer agent:** `contract-reviewer` reads a contracts diff for curve math, fee and reentrancy mistakes, and EAC roles that are wider than intended.
- **Guards:**
  - A hook blocks `git push` to `main`, `gh pr merge` and `--broadcast`.
  - A hook formats and builds after every `.sol` edit.
- Run one agent session per lane so sessions do not edit the same files.
