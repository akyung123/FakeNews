#!/usr/bin/env bash
# Dry-run a Sepolia Foundry script. Broadcast is opt-in and person-only.
#
#   ./script/run-sepolia.sh script/Deploy.s.sol
#   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
#   ./script/run-sepolia.sh script/Deploy.s.sol --broadcast
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ -z "${SEPOLIA_RPC_URL:-}" ]]; then
  echo "Set SEPOLIA_RPC_URL (no API key in git). See docs/INFRA.md." >&2
  exit 1
fi

broadcast=0
args=()
for arg in "$@"; do
  if [[ "$arg" == "--broadcast" ]]; then
    broadcast=1
  else
    args+=("$arg")
  fi
done

if [[ ${#args[@]} -eq 0 ]]; then
  echo "usage: $0 script/Deploy.s.sol [--broadcast] [forge script args]" >&2
  exit 1
fi

cmd=(forge script "${args[@]}" --rpc-url "$SEPOLIA_RPC_URL")

if [[ "$broadcast" -eq 1 ]]; then
  if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
    echo "Broadcast needs DEPLOYER_PRIVATE_KEY in the environment. A person runs this." >&2
    exit 1
  fi
  echo "Broadcasting to Sepolia. This sends a real transaction." >&2
  cmd+=(--broadcast --private-key "$DEPLOYER_PRIVATE_KEY")
else
  echo "Dry-run (no --broadcast)." >&2
fi

exec "${cmd[@]}"
