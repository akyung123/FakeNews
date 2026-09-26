/**
 * Demo records for the web app.
 *
 * Sample sentences live only in this file. Screen components read them
 * through a *Data.ts interface so a later ENS + contract reader can replace
 * the mock without touching the screens.
 */

// ---------------------------------------------------------------------------
// Screen 2 — issue
// Another frontend agent owns this section. Add issue-screen mocks below.
// Do not mix those exports with the Screen 4 block.
// ---------------------------------------------------------------------------

import registerProphetSignature from "../../../world/fixture/register-prophet-signature.json";

type Hex = `0x${string}`;

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

/** Sepolia. Values come from world/fixture/register-prophet-signature.json. */
export const MOCK_WORLD_CHAIN_ID = registerProphetSignature.chainId;
export const MOCK_WORLD_LAUNCHPAD = registerProphetSignature.launchpad as Hex;
export const MOCK_WORLD_WALLET = registerProphetSignature.wallet as Hex;
export const MOCK_WORLD_NULLIFIER = registerProphetSignature.nullifier as Hex;

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
 * POST /verify success. nullifier + serverSig imported from
 * world/fixture/register-prophet-signature.json
 * (EIP-191 personal_sign of keccak256(abi.encode(uint256 chainId, address launchpad, address wallet, uint256 nullifier))).
 */
export const MOCK_WORLD_VERIFY = {
  nullifier: MOCK_WORLD_NULLIFIER,
  serverSig: registerProphetSignature.serverSig as Hex,
};

/** GET /health. Signer address imported from the world/ fixture. */
export const MOCK_WORLD_HEALTH = {
  ok: true as const,
  signer: registerProphetSignature.signer,
};

export const DEFAULT_WORLD_SERVER_URL = "http://localhost:8787";

export const MOCK_ISSUE_PLACEHOLDER = {
  prophecy: "The venue projector survives the whole demo",
  prophetLabel: "ringo",
  slug: "lingo-2028",
};

// ---------------------------------------------------------------------------
// Screen 4 — prophet page
// ---------------------------------------------------------------------------

export const MOCK_PARENT_NAME = "prophecy.eth";

export type MockProphet = {
  /** Prophet label, e.g. `ringo`. */
  label: string;
  wallet: `0x${string}`;
  /** Accumulated creator-fee share, wei. Matches Launchpad.creatorFeeOf. */
  claimableFeeWei: bigint;
};

export type MockProphecy = {
  slug: string;
  prophetLabel: string;
  /** One-line sentence. The only place this string is stored in the mock. */
  sentence: string;
  /** Unix seconds. Departed is `now >= deadline` (INTERFACE). */
  deadline: number;
  token: `0x${string}`;
  /** Tokens already sold, 18 decimals. Matches Launchpad.curve().sold. */
  sold: bigint;
  /** Graduation flag. Matches Launchpad.curve().complete. */
  complete: boolean;
};

export const MOCK_PROPHETS: readonly MockProphet[] = [
  {
    label: "ringo",
    wallet: "0x1111111111111111111111111111111111111111",
    claimableFeeWei: 1_200_000_000_000_000n,
  },
  {
    label: "mina",
    wallet: "0x2222222222222222222222222222222222222222",
    claimableFeeWei: 0n,
  },
];

export const MOCK_PROPHECIES: readonly MockProphecy[] = [
  {
    slug: "badges-2028",
    prophetLabel: "ringo",
    sentence: "Every hackathon badge is an ENS name by 2028",
    deadline: 1_830_297_600, // 2028-01-01
    token: "0xa111111111111111111111111111111111111111",
    sold: 317_240_000n * 10n ** 18n, // 40% of curve supply
    complete: false,
  },
  {
    slug: "last-talk",
    prophetLabel: "ringo",
    sentence: "The last hallway talk is standing room only",
    deadline: 1_700_000_000, // 2023-11-14 — Departed
    token: "0xa222222222222222222222222222222222222222",
    sold: 131_693_201_440_406_167_649_784_217n,
    complete: false,
  },
  {
    slug: "two-min",
    prophetLabel: "ringo",
    sentence: "A two-minute demo has already left the stage",
    deadline: 1_720_000_000, // 2024-07-03 — Departed
    token: "0xa333333333333333333333333333333333333333",
    sold: 793_100_000n * 10n ** 18n,
    complete: true,
  },
  {
    slug: "curve-out",
    prophetLabel: "ringo",
    sentence: "The curve sells out before the pitch",
    deadline: 1_893_456_000, // 2030-01-01
    token: "0xa444444444444444444444444444444444444444",
    sold: 0n,
    complete: false,
  },
  {
    slug: "name-points",
    prophetLabel: "mina",
    sentence: "Someone asks why this name points at a token",
    deadline: 1_893_456_000,
    token: "0xb111111111111111111111111111111111111111",
    sold: 79_310_000n * 10n ** 18n, // 10% of curve supply
    complete: false,
  },
];
