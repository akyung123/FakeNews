#!/usr/bin/env bash
# PreToolUse guard for Bash commands.
# Blocks what only a person may do: touching main, merging PRs, broadcasting transactions.
# Exit code 2 blocks the call and shows stderr to the agent.
set -euo pipefail

cmd="$(jq -r '.tool_input.command // ""')"

block() {
  echo "Blocked by .claude/hooks/guard-bash.sh: $1" >&2
  echo "Only the repo owner merges into main, and only people broadcast transactions. See AGENTS.md rules 1 and 8." >&2
  exit 2
}

# Merging a PR.
if grep -Eq '(^|[;&|[:space:]])gh[[:space:]]+pr[[:space:]]+merge' <<<"$cmd"; then
  block "gh pr merge"
fi

# Sending transactions.
if grep -Eq -- '--broadcast|(^|[;&|[:space:]])cast[[:space:]]+send' <<<"$cmd"; then
  block "on-chain broadcast"
fi

if grep -Eq '(^|[;&|[:space:]])git[[:space:]]+push' <<<"$cmd"; then
  # Force pushes of any kind.
  if grep -Eq -- '(^|[[:space:]])(-f|--force|--force-with-lease)([[:space:]=]|$)' <<<"$cmd"; then
    block "force push"
  fi
  # An explicit main target: "origin main", "HEAD:main", ":main", "refs/heads/main".
  if grep -Eq '(^|[[:space:]:/])main([[:space:]]|$)' <<<"$cmd"; then
    block "push to main"
  fi
  # A bare "git push" while main is checked out.
  branch="$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ "$branch" == "main" ]]; then
    block "push while on main (create a branch first)"
  fi
fi

# Merging into main locally.
if grep -Eq '(^|[;&|[:space:]])git[[:space:]]+merge' <<<"$cmd"; then
  branch="$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ "$branch" == "main" ]]; then
    block "merge on main"
  fi
fi

exit 0
