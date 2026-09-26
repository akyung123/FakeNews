#!/usr/bin/env bash
# Dry-run a Sepolia Foundry script. Sending a transaction is opt-in and person-only.
#
# Order after prophecy.eth is registered:
#   deployUserRegistry → Deploy.s.sol (Launchpad) → deployAdapter → linkParent → grantLaunchpadRegistrar
#
#   ./script/run-sepolia.sh script/Deploy.s.sol
#   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
#   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "deployAdapter()"
#   ./script/run-sepolia.sh script/Deploy.s.sol --broadcast
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

load_env() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// /}" ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      val="${val%\"}"
      val="${val#\"}"
      val="${val%\'}"
      val="${val#\'}"
      if [[ -z "${!key:-}" ]]; then
        export "${key}=${val}"
      fi
    fi
  done < "$file"
}

load_env "$root/.env"

if [[ -z "${SEPOLIA_RPC_URL:-}" ]]; then
  echo "Set SEPOLIA_RPC_URL (no API key in git). See docs/INFRA.md." >&2
  exit 1
fi

send=0
args=()
for arg in "$@"; do
  if [[ "$arg" == "--broadcast" ]]; then
    send=1
  else
    args+=("$arg")
  fi
done

if [[ ${#args[@]} -eq 0 ]]; then
  echo "usage: $0 script/Deploy.s.sol [--broadcast] [forge script args]" >&2
  exit 1
fi

cmd=(forge script "${args[@]}" --rpc-url "$SEPOLIA_RPC_URL")

if [[ "$send" -eq 1 ]]; then
  if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
    echo "Sending needs DEPLOYER_PRIVATE_KEY in the environment (or contracts/.env). A person runs this." >&2
    exit 1
  fi
  echo "Sending to Sepolia. This is a real transaction." >&2
  # Do not put the key on argv. The Solidity script reads DEPLOYER_PRIVATE_KEY.
  cmd+=(--broadcast)
else
  echo "Dry-run (simulation only)." >&2
fi

exec "${cmd[@]}"
