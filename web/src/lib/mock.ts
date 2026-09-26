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
    slug: "lingo-2028",
    prophetLabel: "ringo",
    sentence: "ETH prints ten thousand before the next olympics",
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
