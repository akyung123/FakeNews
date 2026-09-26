# Docs map

Who reads what. Nobody needs to read everything.

| Who | First | Then |
|-----|-------|------|
| New teammate, not a developer | [`PRD.md`](PRD.md) | [`../README.md`](../README.md) "Status" |
| New person or agent | [`../AGENTS.md`](../AGENTS.md) | [`PRD.md`](PRD.md), [`SPEC.md`](SPEC.md) |
| Contracts | [`INTERFACE.md`](INTERFACE.md) | [`ENSV2.md`](ENSV2.md), [`PLAN.md`](PLAN.md) sections 1–2 |
| CCA / auction proposal | [`CCA_RESEARCH.md`](CCA_RESEARCH.md) | [`INTERFACE.md`](INTERFACE.md) (PROPOSAL banner) |
| Web | [`INTERFACE.md`](INTERFACE.md) | [`PLAN.md`](PLAN.md) section 3 |
| World server | [`INTERFACE.md`](INTERFACE.md) | [`PLAN.md`](PLAN.md) section 4 |
| "Why is it like this?" | [`DECISIONS.md`](DECISIONS.md) | — |

## Rules

- What and why (users, goals, scope) goes in PRD, design in SPEC, contracts between folders in INTERFACE, reasons in DECISIONS, tasks in PLAN. Do not repeat content across files; link instead.
- Everything in this repo is written in English: Markdown, code comments, commit messages, PR descriptions.
- Reasons are product reasons: what a choice does for users or for the system.
