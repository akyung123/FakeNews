## What

<!-- One or two sentences. Link the PLAN.md task. -->

## How I checked it

- [ ] `cd contracts && forge build && forge test` (if contracts changed)
- [ ] `cd web && bun run build` (if web changed)
- [ ] `contract-reviewer` run on the diff (if contracts changed): no blockers

## Interface and decisions

- [ ] No change to `docs/INTERFACE.md`
- [ ] Changed `docs/INTERFACE.md` (which part, and which lanes need to know)
- [ ] Added a row to `docs/DECISIONS.md`

## Checklist

- [ ] Everything is in English (docs, comments, UI copy, sample data)
- [ ] No secrets, `.env` files or API keys
- [ ] Not merging this myself. Merges into `main` are done by @akyung123
