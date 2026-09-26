#!/usr/bin/env bash
# Dry-run a Sepolia Foundry script. Sending a transaction is opt-in and person-only.
#
# Order after prophecy.eth is registered (or use infra/scripts/deploy-sepolia.sh):
#   deployUserRegistry → Deploy.s.sol (adapter then Launchpad, one broadcast)
#   → linkParent → grantAdapterRegistrar
# Do not lock the parent name.
#
#   ./script/run-sepolia.sh script/Deploy.s.sol
#   ./script/run-sepolia.sh script/RegisterParent.s.sol --sig "commit()"
#   ./script/run-sepolia.sh script/SetupParent.s.sol --sig "grantAdapterRegistrar()"
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
      # Empty values must not mask Solidity envOr defaults (e.g. ENS_ADAPTER_ADDRESS).
      if [[ -z "$val" ]]; then
        continue
      fi
      if [[ -z "${!key:-}" ]]; then
        export "${key}=${val}"
      fi
    fi
  done < "$file"
}

load_env "$root/.env"

# Wrapper sets this so Deploy.s.sol creates ProphecyEns instead of reading a leftover override.
if [[ "${CREATE_ENS_ADAPTER:-}" == "1" ]]; then
  unset ENS_ADAPTER_ADDRESS || true
fi

if [[ -z "${SEPOLIA_RPC_URL:-}" ]]; then
  echo "Set SEPOLIA_RPC_URL (no API key in git). See infra/README.md." >&2
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
  echo "Sending to the RPC in SEPOLIA_RPC_URL. This is a real transaction on that endpoint." >&2
  # Do not put the key on argv. The Solidity script reads DEPLOYER_PRIVATE_KEY.
  cmd+=(--broadcast)
else
  echo "Dry-run (simulation only)." >&2
fi

if [[ "${args[0]}" == *Deploy.s.sol* ]]; then
  echo "After a send, paste onto Render and restart:" >&2
  echo "  WORLD_CHAIN_ID=11155111" >&2
  echo "  WORLD_LAUNCHPAD_ADDRESS=<PasteIntoRender line from the log>" >&2
  echo "  ENS_ADAPTER_ADDRESS=<logged ProphecyEns>" >&2
  echo "  worldSigner address: <from the log — address only>" >&2
  echo "  WORLD_SIGNER_KEY: paste from local new-world-signer.sh only. Never print it here or in CI." >&2
  echo "  Web: VITE_LAUNCHPAD_ADDRESS from the log; launchpadBlock is in deployments/*.json (fromBlock)." >&2
fi

if [[ "$send" -eq 1 && "${args[0]}" == *Deploy.s.sol* ]]; then
  tmp="$(mktemp)"
  set +e
  "${cmd[@]}" | tee "$tmp"
  rc=${PIPESTATUS[0]}
  set -e
  if [[ "$rc" -eq 0 ]]; then
    repo="$(cd "$root/.." && pwd)"
    val="$(grep -oE 'LAUNCHPAD_ADDRESS=0x[0-9a-fA-F]{40}' "$tmp" | tail -n1 | cut -d= -f2 || true)"
    [[ -n "$val" ]] && export LAUNCHPAD_ADDRESS="$val"
    val="$(grep -oE 'ENS_ADAPTER_ADDRESS=0x[0-9a-fA-F]{40}' "$tmp" | tail -n1 | cut -d= -f2 || true)"
    [[ -n "$val" ]] && export ENS_ADAPTER_ADDRESS="$val"
    val="$(grep -oE 'DEPLOYER=0x[0-9a-fA-F]{40}' "$tmp" | tail -n1 | cut -d= -f2 || true)"
    [[ -n "$val" ]] && export DEPLOYER="$val"
    if [[ "$SEPOLIA_RPC_URL" == *"127.0.0.1"* || "$SEPOLIA_RPC_URL" == *"localhost"* ]]; then
      export DEPLOY_RECORD_LOCAL=1
    fi
    "$repo/infra/scripts/write-deployment-record.sh" || true
  fi
  rm -f "$tmp"
  exit "$rc"
fi

exec "${cmd[@]}"
