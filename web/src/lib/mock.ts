/**
 * Shared mock data for the web prototype.
 * Each screen owns a clearly marked exported section so parallel PRs can merge cleanly.
 * Mock data lives only in this file.
 */

// ---------------------------------------------------------------------------
// Screen 2 — Issue (World ID + launch form)
// Owned by the Screen 2 / issue-screen change. Do not fold Screen 4 data into this block.
//
// Signature + verify fixtures are copied from world/ (PR #10 merged, PR #15 open):
//   world/fixture/register-prophet-signature.json
//   world/test/helpers.ts uniquenessProof / verifyBody
// The Anvil signer key is not copied here.
// ---------------------------------------------------------------------------

/** First-time session: no prophet name yet, so World ID is required. */
export const MOCK_ISSUE_SESSION = {
  wallet: "0xa11ce00000000000000000000000000000000000" as const,
  prophetLabel: null as string | null,
};

/** Returning prophet: already has a name, so World ID is skipped. */
export const MOCK_RETURNING_SESSION = {
  wallet: "0xb0b0000000000000000000000000000000000000" as const,
  prophetLabel: "ringo",
};

/** Same action / ids the world/ server tests use. */
export const MOCK_WORLD_APP_ID = "app_test_prophecy";
export const MOCK_WORLD_ACTION = "register-prophet";
export const MOCK_WORLD_RP_ID = "rp_test_prophecy";
export const MOCK_WORLD_ENVIRONMENT = "staging" as const;

/** Sepolia. Matches world/fixture/register-prophet-signature.json. */
export const MOCK_WORLD_CHAIN_ID = 11_155_111;
export const MOCK_WORLD_LAUNCHPAD = "0x1111111111111111111111111111111111111111" as const;
export const MOCK_WORLD_WALLET = "0x2222222222222222222222222222222222222222" as const;
export const MOCK_WORLD_NULLIFIER =
  "0x2bf8406809dcefb1486dadc96c0a897db9bab002053054cf64272db512c6fbd8" as const;

/** IDKit 4 rp_context object (inner field of GET /rp-context). */
export const MOCK_RP_CONTEXT = {
  rp_id: MOCK_WORLD_RP_ID,
  nonce: "0x6d6f636b2d6e6f6e63652d70726f7068656379",
  created_at: 1_790_380_800,
  expires_at: 1_790_381_100,
  signature:
    "0x1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
};

/** GET /rp-context body published by world/README.md. */
export const MOCK_RP_CONTEXT_RESPONSE = {
  app_id: MOCK_WORLD_APP_ID,
  action: MOCK_WORLD_ACTION,
  environment: MOCK_WORLD_ENVIRONMENT,
  rp_context: MOCK_RP_CONTEXT,
};

/** IDKit 4 uniqueness proof from world/test/helpers.ts uniquenessProof(). */
export const MOCK_IDKIT_RESULT = {
  protocol_version: "4.0" as const,
  nonce: "0xabc123",
  action: MOCK_WORLD_ACTION,
  environment: MOCK_WORLD_ENVIRONMENT,
  responses: [
    {
      identifier: "proof_of_human",
      issuer_schema_id: 1,
      nullifier: MOCK_WORLD_NULLIFIER,
      expires_at_min: 49_012_345,
      proof: ["0x111", "0x222", "0x333", "0x444", "0x555"],
      signal_hash: "0x0",
    },
  ],
};

/**
 * POST /verify success. nullifier + serverSig from
 * world/fixture/register-prophet-signature.json
 * (EIP-191 personal_sign of keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier))).
 */
export const MOCK_WORLD_VERIFY = {
  nullifier: MOCK_WORLD_NULLIFIER,
  serverSig:
    "0x30b81b87f692058fe903c62e6658079e5ed5d399b0498408232b8d1fcc6fde907fb7fad72e0b1e482806e53d0b29ec8a2c766251dceef6e448a9772a2c5c0a801c" as const,
};

/** GET /health. Signer address from the world/ fixture (Anvil account 0). */
export const MOCK_WORLD_HEALTH = {
  ok: true as const,
  signer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
};

export const DEFAULT_WORLD_SERVER_URL = "http://localhost:8787";

export const MOCK_PARENT_NAME = "prophecy.eth";

export const MOCK_ISSUE_PLACEHOLDER = {
  prophecy: "The venue projector survives the whole demo",
  prophetLabel: "ringo",
  slug: "lingo-2028",
};

// ---------------------------------------------------------------------------
// Screen 4 — Prophet page
// Another FE change owns this section. Add Screen 4 mocks below this marker.
// ---------------------------------------------------------------------------
