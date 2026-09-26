#!/usr/bin/env bash
# PostToolUse check: after a .sol file is edited, format it and make sure contracts still build.
# Exit code 2 feeds the build error back to the agent. Skips quietly when forge is missing.
set -uo pipefail

file="$(jq -r '.tool_input.file_path // ""')"
[[ "$file" == *.sol ]] || exit 0
command -v forge >/dev/null 2>&1 || exit 0

root="${CLAUDE_PROJECT_DIR:-.}/contracts"
[[ -d "$root" ]] || exit 0

forge fmt --root "$root" "$file" >/dev/null 2>&1 || true

if ! out="$(forge build --root "$root" 2>&1)"; then
  echo "forge build failed after editing $file:" >&2
  echo "$out" | tail -n 40 >&2
  exit 2
fi
exit 0
