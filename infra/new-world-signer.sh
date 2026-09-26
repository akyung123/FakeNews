#!/usr/bin/env bash
# Create WORLD_SIGNER_KEY locally. Never commit the key or this output.
# The Launchpad constructor takes worldSigner (PR #8). Derive it from this key.
set -euo pipefail

if ! command -v cast >/dev/null 2>&1; then
  echo "cast not found. Install Foundry, then re-run." >&2
  exit 1
fi

echo "Generating a new Ethereum key for the World server signer."
echo "Keep the private key in a local env only. Do not put it in git or a chat."
echo

out="$(cast wallet new)"
addr="$(printf '%s\n' "$out" | sed -n 's/^Address:[[:space:]]*//p')"
key="$(printf '%s\n' "$out" | sed -n 's/^Private key:[[:space:]]*//p')"

if [[ -z "$addr" || -z "$key" ]]; then
  echo "Could not parse cast wallet new. Run it yourself and copy Address / Private key." >&2
  exit 1
fi

echo "Copy into a local env (not git):"
echo "  WORLD_SIGNER_ADDRESS=$addr"
echo "  WORLD_SIGNER_KEY=<the private key printed by cast — not shown again>"
echo
echo "cast Address: $addr"
echo "The deploy script derives worldSigner from WORLD_SIGNER_KEY (PR #8)."
echo "Paste WORLD_SIGNER_KEY onto Render from this local output only. Never commit it or print it in CI."
echo "Re-print the private key? It is only in the cast output above this script's capture."
# Show the key once so a person can copy it. Agents must not commit this output.
echo "  WORLD_SIGNER_KEY=$key"
