# Interface (CCA)

Companion to [`INTERFACE.md`](INTERFACE.md). **`INTERFACE.md` stays the bonding-curve contract on `main`.** This file is the contract between `contracts/`, `web/`, `world/`, and `infra/` for the CCA path on branch `cca`. It applies when `cca` work is in progress; it supersedes `INTERFACE.md` only after `cca` merges to `main`.

- **Changing it:** edit this file first, in **the same PR** as the CCA code change, and write "INTERFACE_CCA change" in the PR description.
- **Sources:** [`SPEC.md`](SPEC.md), [`DECISIONS.md`](DECISIONS.md) #1 (unchanged), #18–#22. Official Uniswap sources are pinned in section 0. Research notes (not accepted as INTERFACE): [PR #38 `CCA_RESEARCH.md`](https://github.com/prism-toggle-ai/FakeNews/blob/a45aecb37f7e1fdc64bed17b1391bb2f603a8ea3/docs/CCA_RESEARCH.md).
- **TBD answers (this revision):** [PR #42](https://github.com/prism-toggle-ai/FakeNews/pull/42) head `b71c64ed93cd2ca5e87c1b2a5df27f9997bb70b9` — issue comments **INTERFACE_CCA TBD answers** and **Designer Q1-Q4 answers** — plus official pins in section 0. Designer-approved copy v2 is in section 7 (character-for-character).
- `(draft)` means the shape may still change during implementation. Remove the mark once it settles.
- `(removed-on-cca)` is the bonding-curve surface. Do not call it from web on the `cca` branch.
- `TBD(backend)` / `TBD (#42)` is still open on the contracts PR. Do not guess a function, field, event, or error to fill it. Do not invent floor / tick numbers.

## 0. Pinned official sources

Read on 2026-09-26. Every external signature below is copied from these pins. If a name is not in this file, it is not in the official source we read.
