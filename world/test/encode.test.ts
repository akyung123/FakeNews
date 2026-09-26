import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeAbiParameters, hashMessage, keccak256, recoverMessageAddress } from "viem";
import { encodeRegisterBytes, hashRegisterPayload, SIGNED_PAYLOAD_ABI } from "../src/encode.ts";
import { recoverRegisterSigner, signRegisterPayload } from "../src/sign.ts";
import {
  FIXTURE_LAUNCHPAD,
  FIXTURE_NULLIFIER,
  FIXTURE_WALLET,
  SEPOLIA_CHAIN_ID,
  TEST_SIGNER_ADDRESS,
  TEST_SIGNER_KEY,
} from "./helpers.ts";

const fixturePath = join(import.meta.dir, "..", "fixture", "register-prophet-signature.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  encoding: string;
  chainId: number;
  launchpad: `0x${string}`;
  wallet: `0x${string}`;
  nullifier: `0x${string}`;
  abiEncoded: `0x${string}`;
  payload: `0x${string}`;
  eip191Digest: `0x${string}`;
  serverSig: `0x${string}`;
  signer: `0x${string}`;
};

const payload = {
  chainId: SEPOLIA_CHAIN_ID,
  launchpad: FIXTURE_LAUNCHPAD,
  wallet: FIXTURE_WALLET,
  nullifier: BigInt(FIXTURE_NULLIFIER),
};

describe("INTERFACE section 3 encoding", () => {
  test("hashes keccak256(abi.encode(chainId, launchpad, wallet, nullifier))", () => {
    const encoded = encodeAbiParameters(SIGNED_PAYLOAD_ABI, [
      payload.chainId,
      payload.launchpad,
      payload.wallet,
      payload.nullifier,
    ]);
    expect(encodeRegisterBytes(payload)).toBe(encoded);
    expect(hashRegisterPayload(payload)).toBe(keccak256(encoded));
    expect(hashRegisterPayload(payload)).toBe(fixture.payload);
    expect(encoded).toBe(fixture.abiEncoded);
  });

  test("EIP-191 signature recovers the signer and matches the fixture", async () => {
    const serverSig = await signRegisterPayload(TEST_SIGNER_KEY, payload);
    expect(serverSig).toBe(fixture.serverSig);
    expect(hashMessage({ raw: hashRegisterPayload(payload) })).toBe(fixture.eip191Digest);

    const recovered = await recoverRegisterSigner(payload, serverSig);
    expect(recovered).toBe(TEST_SIGNER_ADDRESS);
    expect(recovered).toBe(fixture.signer);

    const recoveredFromFixture = await recoverMessageAddress({
      message: { raw: fixture.payload },
      signature: fixture.serverSig,
    });
    expect(recoveredFromFixture).toBe(fixture.signer);
  });

  test("fixture documents the exact signed-message encoding", () => {
    expect(fixture.encoding).toBe(
      "EIP-191 personal_sign of keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier))",
    );
    expect(fixture.chainId).toBe(Number(SEPOLIA_CHAIN_ID));
    expect(fixture.launchpad).toBe(FIXTURE_LAUNCHPAD);
    expect(fixture.wallet).toBe(FIXTURE_WALLET);
    expect(fixture.nullifier).toBe(FIXTURE_NULLIFIER);
  });
});
