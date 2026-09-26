/**
 * Shared mock data for the web prototype.
 * Each screen owns a clearly marked exported section so parallel PRs can merge cleanly.
 * Mock data lives only in this file.
 */

// ---------------------------------------------------------------------------
// Screen 2 — Issue (World ID + launch form)
// Owned by the Screen 2 / issue-screen change. Do not fold Screen 4 data into this block.
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

export const MOCK_WORLD_APP_ID = "app_staging_prophecy_demo";
export const MOCK_WORLD_ACTION = "register-prophet";
export const MOCK_WORLD_RP_ID = "rp_staging_prophecy_demo";

/** IDKit 4 rp_context shape from the world/ server (INTERFACE §3). */
export const MOCK_RP_CONTEXT = {
  rp_id: MOCK_WORLD_RP_ID,
  nonce: "0x6d6f636b2d6e6f6e63652d70726f7068656379",
  created_at: 1_790_380_800,
  expires_at: 1_790_381_100,
  signature:
    "0x1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
};

/** IDKit 4 Proof of Human result, forwarded as-is to POST /verify. */
export const MOCK_IDKIT_RESULT = {
  protocol_version: "4.0" as const,
  nonce: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  action: MOCK_WORLD_ACTION,
  environment: "staging" as const,
  responses: [
    {
      identifier: "proof_of_human",
      signal_hash: "0x00c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a4",
      proof: [
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333333333333333333333333333",
        "0x4444444444444444444444444444444444444444444444444444444444444444",
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ],
      nullifier: "0x04e5f60000000000000000000000000000000000000000000000000000000001",
      issuer_schema_id: 1,
      expires_at_min: 1_791_000_000,
    },
  ],
};

/**
 * world/ → Launchpad payload after a successful Portal v4 verify.
 * serverSig is EIP-191 of keccak256(abi.encode(chainId, launchpad, wallet, nullifier)).
 */
export const MOCK_WORLD_VERIFY = {
  nullifier: "0x04e5f60000000000000000000000000000000000000000000000000000000001" as const,
  serverSig:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
};

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
