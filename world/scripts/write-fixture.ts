import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashMessage, toHex } from "viem";
import { encodeRegisterBytes, hashRegisterPayload } from "../src/encode.ts";
import { signRegisterPayload } from "../src/sign.ts";
import {
  FIXTURE_LAUNCHPAD,
  FIXTURE_NULLIFIER,
  FIXTURE_WALLET,
  SEPOLIA_CHAIN_ID,
  TEST_SIGNER_ADDRESS,
  TEST_SIGNER_KEY,
} from "../test/helpers.ts";

const payload = {
  chainId: SEPOLIA_CHAIN_ID,
  launchpad: FIXTURE_LAUNCHPAD,
  wallet: FIXTURE_WALLET,
  nullifier: BigInt(FIXTURE_NULLIFIER),
};

const abiEncoded = encodeRegisterBytes(payload);
const hashed = hashRegisterPayload(payload);
const serverSig = await signRegisterPayload(TEST_SIGNER_KEY, payload);
const eip191Digest = hashMessage({ raw: hashed });

const fixture = {
  encoding:
    "EIP-191 personal_sign of keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier))",
  abiEncodeTypes: ["uint256", "address", "address", "uint256"],
  chainId: Number(SEPOLIA_CHAIN_ID),
  launchpad: FIXTURE_LAUNCHPAD,
  wallet: FIXTURE_WALLET,
  nullifier: toHex(payload.nullifier, { size: 32 }),
  nullifierDecimal: payload.nullifier.toString(10),
  abiEncoded,
  payload: hashed,
  eip191Digest,
  serverSig,
  signer: TEST_SIGNER_ADDRESS,
  signerKey: TEST_SIGNER_KEY,
  signerKeyNote: "Foundry / Anvil default account 0. Test only. Never use on a funded network.",
};

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "fixture", "register-prophet-signature.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(out);
