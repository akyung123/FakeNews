# World verification server

Small Bun server for IDKit 4. The web app asks it for an `rp-context`, then sends the IDKit result here. The server forwards that result unchanged to the World Developer Portal v4 verify API. On success it signs the INTERFACE section 3 payload so `registerProphet` can recover `WORLD_SIGNER` and store the nullifier.

World ID is required only when a prophet name is first created. One human produces one nullifier, so one name.

Official docs used while building this:

- [IDKit 4 integrate](https://docs.world.org/world-id/idkit/integrate)
- [RP signatures](https://docs.world.org/world-id/idkit/signatures)
- [Portal v4 verify](https://docs.world.org/world-id/reference/api-v4)

## Run locally

```bash
cd world
bun install
cp .env.example .env   # fill in the names; never commit .env
bun run dev            # http://localhost:8787
```

```bash
bun test
```

Create a World Developer Portal app, enable World ID 4.0, and keep `app_id`, `rp_id`, and the RP `signing_key`. `WORLD_SIGNER_KEY` is a separate Ethereum key. Its address is what the Launchpad stores as `WORLD_SIGNER`.

`WORLD_ENVIRONMENT=staging` is for the World ID simulator. Sepolia is the chain; it is not a World ID environment.

This server does not store nullifiers. The Launchpad does, so a restart cannot mint a second prophet name for the same person.

## Env

Names only live in `.env.example`. Required:

| Name | Used for |
|---|---|
| `WORLD_APP_ID` | Returned on `/rp-context` (`app_...`) |
| `WORLD_ACTION` | IDKit action; must match the proof |
| `WORLD_RP_ID` | Portal path and `rp_context.rp_id` |
| `WORLD_RP_SIGNING_KEY` | IDKit 4 RP signature |
| `WORLD_SIGNER_KEY` | EIP-191 key for INTERFACE section 3 |
| `PORT` | Listen port (default `8787`) |

Optional: `WORLD_ENVIRONMENT` (`production` or `staging`), `WORLD_PORTAL_URL` (override the Portal base URL).

## HTTP

`GET /rp-context` — IDKit 4 fields the widget needs:

```json
{
  "app_id": "app_...",
  "action": "register-prophet",
  "environment": "production",
  "rp_context": {
    "rp_id": "rp_...",
    "nonce": "0x...",
    "created_at": 1700000000,
    "expires_at": 1700000300,
    "signature": "0x..."
  }
}
```

`POST /verify` — forward the IDKit result as-is after adding the wallet the user will use for `registerProphet`:

```json
{
  "wallet": "0x...",
  "chainId": 11155111,
  "launchpad": "0x...",
  "idkitResponse": { "protocol_version": "4.0", "nonce": "0x...", "action": "register-prophet", "responses": [] }
}
```

`proof` is accepted as an alias for `idkitResponse`. Success:

```json
{
  "nullifier": "0x...",
  "serverSig": "0x..."
}
```

Call `registerProphet(label, nullifier, serverSig)` with those two values. Failures: `malformed_payload` or `portal_rejected`.

`GET /health` — `{ "ok": true, "signer": "0x..." }`.

## Signed-message encoding

INTERFACE section 3:

```text
EIP-191 personal_sign of keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier))
```

Solidity check:

```solidity
bytes32 payload = keccak256(abi.encode(chainId, launchpad, wallet, nullifier));
address recovered = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(payload), serverSig);
require(recovered == WORLD_SIGNER);
```

A reusable test vector is in [`fixture/register-prophet-signature.json`](fixture/register-prophet-signature.json). The key in that file is Foundry/Anvil account 0, test only.
