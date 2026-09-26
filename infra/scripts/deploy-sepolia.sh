#!/usr/bin/env bash
# Scripted single-wallet Sepolia ENS + Launchpad deploy.
# One key (DEPLOYER_PRIVATE_KEY) does every step. TEAM_WALLET defaults to that
# address; a different TEAM_WALLET reverts in the Solidity scripts.
#
# Does NOT lock the parent name (irreversible). A later lock PR, after a person
# confirms, revokes SET_SUBREGISTRY on .eth for prophecy.
#
# Usage (from repo root):
#   ./infra/scripts/deploy-sepolia.sh              # dry-run each step (registerName needs a prior real commit)
#   SEND=1 ./infra/scripts/deploy-sepolia.sh       # person-only send (or --broadcast)
#   WARP_COMMIT=1 SEND=1 ./infra/scripts/deploy-sepolia.sh
#       warp +70s on a local / anvil-fork RPC instead of sleeping
#
# RPC: SEPOLIA_RPC_URL, or https://ethereum-sepolia-rpc.publicnode.com
# Never commit an RPC key.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
contracts="$root/contracts"
run_sepolia="$contracts/script/run-sepolia.sh"

send=0
warp=0
for arg in "$@"; do
  case "$arg" in
    --broadcast) send=1 ;;
    --warp) warp=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ "${SEND:-}" == "1" ]]; then
  send=1
fi
if [[ "${WARP_COMMIT:-}" == "1" ]]; then
  warp=1
fi

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
      # Skip empty values so Solidity envOr defaults still apply.
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
load_env "$contracts/.env"

if [[ -z "${SEPOLIA_RPC_URL:-}" ]]; then
  export SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
fi

if [[ -z "${ENS_REGISTRATION_SECRET:-}" ]]; then
  export ENS_REGISTRATION_SECRET="0x$(openssl rand -hex 32)"
  echo "Generated ENS_REGISTRATION_SECRET for this run (not printed)." >&2
fi

export PARENT_LABEL="${PARENT_LABEL:-prophecy}"

step_logs=()
gas_report="${DEPLOY_GAS_REPORT:-}"

run_step() {
  local name="$1"
  shift
  local extra=()
  if [[ "$send" -eq 1 ]]; then
    extra+=(--broadcast)
  fi
  echo >&2
  echo "=== $name ===" >&2
  local tmp
  tmp="$(mktemp)"
  set +e
  "$run_sepolia" "$@" "${extra[@]}" | tee "$tmp"
  local rc=${PIPESTATUS[0]}
  set -e
  step_logs+=("$name:$tmp")
  if [[ -n "$gas_report" ]]; then
    {
      echo "----- $name -----"
      grep -E 'Gas used:|Paid:|Transaction:|✅|Success|Hash:' "$tmp" || true
    } >> "$gas_report"
  fi
  if [[ "$rc" -ne 0 ]]; then
    echo "step failed: $name" >&2
    exit "$rc"
  fi
  _ingest_addresses "$tmp"
}

_ingest_addresses() {
  local log="$1"
  local val
  val="$(grep -oE 'PARENT_USER_REGISTRY=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export PARENT_USER_REGISTRY="$val"
  fi
  val="$(grep -oE 'ENS_ADAPTER_ADDRESS=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export ENS_ADAPTER_ADDRESS="$val"
  fi
  val="$(grep -oE 'LAUNCHPAD_ADDRESS=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export LAUNCHPAD_ADDRESS="$val"
  fi
  val="$(grep -oE 'WORLD_LAUNCHPAD_ADDRESS=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export WORLD_LAUNCHPAD_ADDRESS="$val"
    export LAUNCHPAD_ADDRESS="${LAUNCHPAD_ADDRESS:-$val}"
  fi
  val="$(grep -oE 'DEPLOYER=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export DEPLOYER="$val"
  fi
  val="$(grep -oE 'LAUNCHPAD_BLOCK=[0-9]+' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export LAUNCHPAD_BLOCK="$val"
  fi
  val="$(grep -oE 'HOOK_ADDRESS=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export HOOK_ADDRESS="$val"
  fi
  val="$(grep -oE 'LOCKER_ADDRESS=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export LOCKER_ADDRESS="$val"
  fi
  val="$(grep -oE 'POOL_MANAGER=0x[0-9a-fA-F]{40}' "$log" | tail -n1 | cut -d= -f2 || true)"
  if [[ -n "$val" ]]; then
    export POOL_MANAGER="$val"
  fi
}

wait_commit() {
  local rpc="$SEPOLIA_RPC_URL"
  if [[ "$warp" -eq 1 || "$rpc" == *"127.0.0.1"* || "$rpc" == *"localhost"* ]]; then
    echo "Warping +70s on local/fork RPC (ENSv2 commit-reveal)." >&2
    cast rpc evm_increaseTime 70 --rpc-url "$rpc" >/dev/null
    cast rpc evm_mine --rpc-url "$rpc" >/dev/null
  else
    echo "Waiting 70s for ENSv2 commit-reveal (do not lock the parent after register)." >&2
    sleep 70
  fi
}

echo "Parent label: $PARENT_LABEL" >&2
echo "RPC: ${SEPOLIA_RPC_URL%%\?*}" >&2
if [[ "$send" -eq 1 ]]; then
  echo "Mode: send (broadcast)." >&2
else
  echo "Mode: dry-run. registerName only succeeds after a broadcast commit." >&2
fi

# 1. commit
run_step "commit" script/RegisterParent.s.sol --sig "commit()"

# wait ~70s (forge cannot simulate the wait in the same run)
wait_commit

# 1b. mint MockUSDC when public mint exists; registerName also mints if needed
run_step "fundPaymentToken" script/RegisterParent.s.sol --sig "fundPaymentToken()"

# 1c. approve + register
run_step "registerName" script/RegisterParent.s.sol --sig "registerName()"

# 2. parent UserRegistry
run_step "deployUserRegistry" script/SetupParent.s.sol --sig "deployUserRegistry()"

# 3+4. ProphecyEns then Launchpad, then CREATE2 Hook + Locker + setUniswap + setCca (one broadcast)
# PARENT_USER_REGISTRY must be in the environment from the previous step.
if [[ -z "${PARENT_USER_REGISTRY:-}" && "$send" -eq 1 ]]; then
  echo "PARENT_USER_REGISTRY missing after deployUserRegistry." >&2
  exit 1
fi
# A leftover ENS_ADAPTER_ADDRESS would skip adapter CREATE and break the predicted address.
unset ENS_ADAPTER_ADDRESS || true
CREATE_ENS_ADAPTER=1 run_step "Deploy adapter+Launchpad" script/Deploy.s.sol

if [[ -z "${ENS_ADAPTER_ADDRESS:-}" && "$send" -eq 1 ]]; then
  echo "ENS_ADAPTER_ADDRESS missing after Deploy.s.sol." >&2
  exit 1
fi

# 6. linkParent (setSubregistry, setParent, revoke SET_PARENT). No lock.
run_step "linkParent" script/SetupParent.s.sol --sig "linkParent()"

# 7. ROLE_REGISTRAR to the adapter
run_step "grantAdapterRegistrar" script/SetupParent.s.sol --sig "grantAdapterRegistrar()"

echo >&2
echo "Done. Parent name is NOT locked." >&2
echo "Paste onto Render (address only, never WORLD_SIGNER_KEY from CI):" >&2
echo "  WORLD_CHAIN_ID=11155111"
if [[ -n "${LAUNCHPAD_ADDRESS:-}" ]]; then
  echo "  WORLD_LAUNCHPAD_ADDRESS=$LAUNCHPAD_ADDRESS"
fi

if [[ "$send" -eq 1 && -n "${LAUNCHPAD_ADDRESS:-}" ]]; then
  if [[ "$warp" -eq 1 ]]; then
    export DEPLOY_RECORD_LOCAL=1
  fi
  "$root/infra/scripts/write-deployment-record.sh"
fi
