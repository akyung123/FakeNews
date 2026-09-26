#!/usr/bin/env bash
# SessionStart: install web dependencies once so builds and tests work in fresh sessions.
set -uo pipefail

web="${CLAUDE_PROJECT_DIR:-.}/web"
if [[ -f "$web/package.json" && ! -d "$web/node_modules" ]] && command -v bun >/dev/null 2>&1; then
  (cd "$web" && bun install --frozen-lockfile >/dev/null 2>&1) || echo "web: bun install failed; run it manually." >&2
fi

branch="$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ "$branch" == "main" ]]; then
  echo "You are on main. Create a branch (<lane>/<topic>) before editing; only the repo owner merges into main."
fi
exit 0
