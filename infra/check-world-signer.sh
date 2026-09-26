#!/usr/bin/env bash
# Confirm the local WORLD_SIGNER_KEY matches Launchpad.worldSigner() on Sepolia.
# The world/ server must sign with this same key. Never prints the private key.
#
#   WORLD_SIGNER_KEY=… WORLD_LAUNCHPAD_ADDRESS=… SEPOLIA_RPC_URL=… ./infra/check-world-signer.sh
#
# Or fill contracts/.env (never commit it). Run locally before recording. Do not run in CI.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

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

load_env "$root/contracts/.env"

if ! command -v cast >/dev/null 2>&1; then
  echo "cast not found. Install Foundry, then re-run." >&2
  exit 1
fi

if [[ -z "${WORLD_SIGNER_KEY:-}" ]]; then
  echo "Set WORLD_SIGNER_KEY in the local env (from infra/new-world-signer.sh). Do not pass it on argv." >&2
  exit 1
fi

launchpad="${WORLD_LAUNCHPAD_ADDRESS:-${LAUNCHPAD_ADDRESS:-}}"
if [[ -z "$launchpad" || "$launchpad" == "0x0000000000000000000000000000000000000000" ]]; then
  echo "Set WORLD_LAUNCHPAD_ADDRESS (or LAUNCHPAD_ADDRESS) to the deployed Launchpad." >&2
  exit 1
fi

rpc="${SEPOLIA_RPC_URL:-}"
if [[ -z "$rpc" ]]; then
  echo "Set SEPOLIA_RPC_URL (no API key in git)." >&2
  exit 1
fi

# Derive only. Never echo WORLD_SIGNER_KEY.
local_addr="$(cast wallet address --private-key "$WORLD_SIGNER_KEY")"
if [[ -z "$local_addr" ]]; then
  echo "Could not derive an address from WORLD_SIGNER_KEY." >&2
  exit 1
fi

if ! onchain="$(cast call "$launchpad" "worldSigner()(address)" --rpc-url "$rpc")"; then
  echo "Could not read worldSigner() at $launchpad. Deploy Launchpad (PR #8) first." >&2
  exit 1
fi

local_cs="$(cast --to-checksum-address "$local_addr")"
onchain_cs="$(cast --to-checksum-address "$onchain")"

echo "local WORLD_SIGNER_KEY address: $local_cs"
echo "Launchpad.worldSigner():        $onchain_cs"

if [[ "${local_cs,,}" != "${onchain_cs,,}" ]]; then
  echo "Mismatch: the world server key is not the Launchpad worldSigner. Do not record." >&2
  exit 1
fi

echo "Match. The world server and Launchpad share the same signer."
