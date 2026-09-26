#!/usr/bin/env bash
# Scan web/src for copy that DECISIONS #1 and the v2 brief forbid.
# Test files may mention banned words as assertions. Routes and variable names are fine.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)/src"
fail=0

python3 - "$SRC" <<'PY' || fail=1
import sys
from pathlib import Path
src = Path(sys.argv[1])
bad = []
for path in src.rglob("*"):
    if not path.is_file():
        continue
    if path.suffix not in {".ts", ".tsx", ".css", ".html"}:
        continue
    # Main's UTF-8 one-character tests use Hangul as a 3-byte fixture.
    if path.name.endswith(".test.ts") or path.name.endswith(".test.tsx"):
        continue
    text = path.read_text(encoding="utf-8")
    if any("\uac00" <= ch <= "\ud7af" for ch in text):
        bad.append(str(path))
if bad:
    print("FAIL: Korean in", *bad)
    sys.exit(1)
PY

while IFS= read -r file; do
  case "$file" in
    *.test.ts|*.test.tsx) continue ;;
  esac
  if grep -nE -e 'pump' -e 'prediction' -e 'price-prediction' "$file"; then
    echo "FAIL: banned product wording in $file" >&2
    fail=1
  fi
  if grep -nE -e '[+-][0-9]+(\.[0-9]+)?%' "$file"; then
    echo "FAIL: signed percent in $file" >&2
    fail=1
  fi
done < <(find "$SRC" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.html' \))

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "banned_check: ok"
