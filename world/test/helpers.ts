import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "../src/config.ts";

/** Foundry / Anvil default account 0. Test only. */
export const TEST_SIGNER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

export const TEST_RP_KEY =
  "0xabababababababababababababababababababababababababababababababab" as const;

export const TEST_SIGNER_ADDRESS = privateKeyToAccount(TEST_SIGNER_KEY).address;

export const SEPOLIA_CHAIN_ID = 11155111n;

export const FIXTURE_LAUNCHPAD = "0x1111111111111111111111111111111111111111" as const;
export const FIXTURE_WALLET = "0x2222222222222222222222222222222222222222" as const;
export const FIXTURE_NULLIFIER =
  "0x2bf8406809dcefb1486dadc96c0a897db9bab002053054cf64272db512c6fbd8" as const;

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    appId: "app_test_prophecy",
    action: "register-prophet",
    rpId: "rp_test_prophecy",
    rpSigningKey: TEST_RP_KEY,
    signerKey: TEST_SIGNER_KEY,
    environment: "staging",
    portalBaseUrl: "https://portal.test",
    port: 8787,
    ...overrides,
  };
}

export function uniquenessProof(overrides: Record<string, unknown> = {}) {
  return {
    protocol_version: "4.0",
    nonce: "0xabc123",
    action: "register-prophet",
    environment: "staging",
    responses: [
      {
        identifier: "proof_of_human",
        issuer_schema_id: 1,
        nullifier: FIXTURE_NULLIFIER,
        expires_at_min: 49012345,
        proof: ["0x111", "0x222", "0x333", "0x444", "0x555"],
        signal_hash: "0x0",
      },
    ],
    ...overrides,
  };
}

export function verifyBody(overrides: Record<string, unknown> = {}) {
  return {
    wallet: FIXTURE_WALLET,
    chainId: Number(SEPOLIA_CHAIN_ID),
    launchpad: FIXTURE_LAUNCHPAD,
    idkitResponse: uniquenessProof(),
    ...overrides,
  };
}
