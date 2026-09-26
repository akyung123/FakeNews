#!/usr/bin/env bash
# Write deployments/sepolia.json or deployments/anvil.json after a Launchpad send.
# No secrets. Web copies `launchpad` into VITE_LAUNCHPAD_ADDRESS and
# `launchpadBlock` into VITE_LAUNCHPAD_DEPLOY_BLOCK (Launched fromBlock).
#
# Env: LAUNCHPAD_ADDRESS, ENS_ADAPTER_ADDRESS, PARENT_USER_REGISTRY,
#      HOOK_ADDRESS, LOCKER_ADDRESS, POOL_MANAGER / UNISWAP_V4_POOL_MANAGER,
#      DEPLOYER (optional), LAUNCHPAD_BLOCK (optional), SEPOLIA_RPC_URL,
#      DEPLOY_RECORD_LOCAL=1 for fork / anvil.
set -euo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
contracts="$repo/contracts"

rpc="${SEPOLIA_RPC_URL:-}"
chain_id="${CHAIN_ID:-}"
if [[ -z "$chain_id" && -n "$rpc" ]] && command -v cast >/dev/null 2>&1; then
  chain_id="$(cast chain-id --rpc-url "$rpc" 2>/dev/null || true)"
fi
chain_id="${chain_id:-11155111}"

local_record=0
if [[ "${DEPLOY_RECORD_LOCAL:-}" == "1" || "${WARP_COMMIT:-}" == "1" || "$chain_id" == "31337" ]]; then
  local_record=1
fi
if [[ -n "$rpc" && ( "$rpc" == *"127.0.0.1"* || "$rpc" == *"localhost"* ) ]]; then
  local_record=1
fi

out="${DEPLOY_RECORD_PATH:-}"
if [[ -z "$out" ]]; then
  if [[ "$local_record" -eq 1 ]]; then
    out="$repo/deployments/anvil.json"
  else
    out="$repo/deployments/sepolia.json"
  fi
fi

broadcast="${DEPLOY_BROADCAST_JSON:-$contracts/broadcast/Deploy.s.sol/${chain_id}/run-latest.json}"
commit="$(git -C "$repo" rev-parse HEAD 2>/dev/null || true)"

launchpad="${LAUNCHPAD_ADDRESS:-${WORLD_LAUNCHPAD_ADDRESS:-}}"
adapter="${ENS_ADAPTER_ADDRESS:-}"
parent="${PARENT_USER_REGISTRY:-}"
deployer="${DEPLOYER:-}"
block="${LAUNCHPAD_BLOCK:-}"
hook="${HOOK_ADDRESS:-${VITE_HOOK_ADDRESS:-}}"
locker="${LOCKER_ADDRESS:-${VITE_LOCKER_ADDRESS:-}}"
pool_manager="${POOL_MANAGER:-${UNISWAP_V4_POOL_MANAGER:-}}"

parsed="$(python3 - "$broadcast" "$launchpad" "$adapter" "$deployer" "$block" "$hook" "$locker" "$pool_manager" <<'PY'
import json, sys

path, launchpad, adapter, deployer, block, hook, locker, pool_manager = sys.argv[1:9]

def parse_int(v):
    if v is None or v == "":
        return ""
    if isinstance(v, int):
        return str(v)
    s = str(v)
    try:
        return str(int(s, 16) if s.startswith("0x") else int(s))
    except ValueError:
        return ""

def pick_create(txs, name):
    for t in txs:
        cn = t.get("contractName") or ""
        if cn == name or cn.endswith("/" + name) or cn.endswith("." + name):
            if (t.get("transactionType") or "").upper() in ("CREATE", "CREATE2", ""):
                return t
    return None

data = {}
try:
    data = json.load(open(path))
except OSError:
    pass

txs = data.get("transactions") or []
receipts = data.get("receipts") or []
by_hash = {}
for r in receipts:
    h = (r.get("transactionHash") or r.get("hash") or "").lower()
    if h:
        by_hash[h] = r

pad_tx = pick_create(txs, "Launchpad")
ens_tx = pick_create(txs, "ProphecyEns")
hook_tx = pick_create(txs, "ProphecyHook")
locker_tx = pick_create(txs, "LiquidityLocker")

if not launchpad and pad_tx:
    launchpad = pad_tx.get("contractAddress") or ""
if not adapter and ens_tx:
    adapter = ens_tx.get("contractAddress") or ""
if not hook and hook_tx:
    hook = hook_tx.get("contractAddress") or ""
if not locker and locker_tx:
    locker = locker_tx.get("contractAddress") or ""
if not pool_manager:
    pool_manager = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543"

if pad_tx:
    h = (pad_tx.get("hash") or "").lower()
    rec = by_hash.get(h)
    if rec is None:
        for r in receipts:
            if (r.get("contractAddress") or "").lower() == (launchpad or "").lower():
                rec = r
                break
    if rec is not None:
        rec_block = parse_int(rec.get("blockNumber"))
        if rec_block:
            block = rec_block
        if not deployer:
            deployer = rec.get("from") or ""

if not deployer and receipts:
    deployer = receipts[0].get("from") or ""

print(launchpad or "")
print(adapter or "")
print(deployer or "")
print(block or "")
print(hook or "")
print(locker or "")
print(pool_manager or "")
PY
)"

mapfile -t parsed_lines <<<"$parsed"
[[ ${#parsed_lines[@]} -ge 1 && -n "${parsed_lines[0]}" ]] && launchpad="${parsed_lines[0]}"
[[ ${#parsed_lines[@]} -ge 2 && -n "${parsed_lines[1]}" ]] && adapter="${parsed_lines[1]}"
[[ ${#parsed_lines[@]} -ge 3 && -n "${parsed_lines[2]}" ]] && deployer="${parsed_lines[2]}"
[[ ${#parsed_lines[@]} -ge 4 && -n "${parsed_lines[3]}" ]] && block="${parsed_lines[3]}"
[[ ${#parsed_lines[@]} -ge 5 && -n "${parsed_lines[4]}" ]] && hook="${parsed_lines[4]}"
[[ ${#parsed_lines[@]} -ge 6 && -n "${parsed_lines[5]}" ]] && locker="${parsed_lines[5]}"
[[ ${#parsed_lines[@]} -ge 7 && -n "${parsed_lines[6]}" ]] && pool_manager="${parsed_lines[6]}"

if [[ -z "$launchpad" || "$launchpad" == "0x0000000000000000000000000000000000000000" ]]; then
  echo "write-deployment-record: no Launchpad address (send Deploy.s.sol first)." >&2
  exit 1
fi
if [[ "${launchpad,,}" == "0x0000000000000000000000000000000000000e05" ]]; then
  echo "write-deployment-record: refusing placeholder Launchpad / ens 0xe05." >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"
python3 - "$out" "$chain_id" "$launchpad" "$block" "$adapter" "$parent" "$deployer" "$commit" "$hook" "$locker" "$pool_manager" <<'PY'
import json, sys

out, chain_id, launchpad, block, adapter, parent, deployer, commit, hook, locker, pool_manager = sys.argv[1:]

def addr(v):
    v = (v or "").strip()
    return v if v else None

def num(v):
    v = (v or "").strip()
    if not v:
        return None
    return int(v, 16) if v.startswith("0x") else int(v)

record = {
    "chainId": int(chain_id),
    "launchpad": addr(launchpad),
    "launchpadBlock": num(block),
    "adapter": addr(adapter),
    "parentUserRegistry": addr(parent),
    "hook": addr(hook),
    "locker": addr(locker),
    "poolManager": addr(pool_manager),
    "deployer": addr(deployer),
    "commit": commit or None,
}
with open(out, "w") as f:
    json.dump(record, f, indent=2)
    f.write("\n")
PY

# Machine-readable stdout. Paste VITE_* into Actions variables / web/.env.
echo "--- deployment ---"
echo "chainId=$chain_id"
echo "launchpad=$launchpad"
echo "launchpadBlock=${block:-}"
echo "adapter=${adapter:-}"
echo "parentUserRegistry=${parent:-}"
echo "hook=${hook:-}"
echo "locker=${locker:-}"
echo "poolManager=${pool_manager:-}"
echo "deployer=${deployer:-}"
echo "commit=${commit:-}"
echo "VITE_LAUNCHPAD_ADDRESS=$launchpad"
echo "VITE_LAUNCHPAD_DEPLOY_BLOCK=${block:-}"
echo "VITE_HOOK_ADDRESS=${hook:-}"
echo "VITE_LOCKER_ADDRESS=${locker:-}"
echo "VITE_CHAIN_ID=$chain_id"
echo "wrote $out"
