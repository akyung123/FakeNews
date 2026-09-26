/**
 * Demo records for the web app.
 *
 * Sample sentences live only in this file. Screen components read them
 * through a *Data.ts interface so a later ENS + contract reader can replace
 * the mock without touching the screens.
 */

// ---------------------------------------------------------------------------
// Screen 1 — home list (prototype store seed)
// ---------------------------------------------------------------------------

export const SEED_COINS = [
  { id: "wifi", ticker: "WIFI", name: "Wifi Dies", prophecy: "The venue Wi-Fi dies at 3am on Saturday", creator: "yuki.eth", min: 180 },
  { id: "oops", ticker: "OOPS", name: "Mainnet Oops", prophecy: "Someone deploys to mainnet by accident before Sunday", creator: "0xHana", min: 140 },
  { id: "coffee", ticker: "COFFEE", name: "No Coffee", prophecy: "Coffee runs out before Sunday breakfast", creator: "tokyo_bob", min: 95 },
  { id: "yolo", ticker: "YOLO", name: "Zero Tests", prophecy: "A team with zero tests ships on time", creator: "rin_park", min: 60 },
  { id: "why", ticker: "WHY", name: "Why Blockchain", prophecy: "Someone asks “why blockchain?” more than 10 times today", creator: "sam_lee", min: 25 },
  { id: "sleep", ticker: "SLEEP", name: "No Sleep", prophecy: "Nobody on our team sleeps before 5am", creator: "june_kim", min: 6 },
];

// ---------------------------------------------------------------------------
// Screen 2 — issue
// Another frontend agent owns this section. Add issue-screen mocks below.
// Do not mix those exports with the Screen 4 block.
// ---------------------------------------------------------------------------

/** Real ETH at graduation (SPEC). Screen 3 header shows raised vs this target. */
export const GRADUATION_ETH = 0.02;

// ---------------------------------------------------------------------------
// Screen 3 — trade memos (prototype store seed)
// ---------------------------------------------------------------------------

export type SeedEvent =
  | { min: number; coin: string; user: string; buy: number; say?: string }
  | { min: number; coin: string; user: string; sellShare: number; say?: string }
  | { min: number; coin: string; user: string; say: string };

export const SEED_EVENTS: readonly SeedEvent[] = [
  { min: 178, coin: "wifi", user: "yuki.eth", buy: 0.3, say: "I've met this router before." },
  { min: 170, coin: "wifi", user: "tokyo_bob", buy: 0.5 },
  { min: 150, coin: "wifi", user: "rin_park", buy: 0.4, say: "Router light is blinking amber already." },
  { min: 138, coin: "oops", user: "0xHana", buy: 0.2, say: "trust me, I know my teammates" },
  { min: 120, coin: "wifi", user: "0xHana", buy: 0.2 },
  { min: 110, coin: "oops", user: "satoshi_jr", buy: 0.6, say: "someone always does it" },
  { min: 100, coin: "wifi", user: "you", buy: 0.1 },
  { min: 93, coin: "coffee", user: "tokyo_bob", buy: 0.15 },
  { min: 80, coin: "wifi", user: "tokyo_bob", sellShare: 0.8 },
  { min: 75, coin: "wifi", user: "rin_park", say: "Wi-Fi flickered at the demo table just now." },
  { min: 70, coin: "oops", user: "june_kim", buy: 0.3 },
  { min: 60, coin: "coffee", user: "yuki.eth", buy: 0.2, say: "there is no more coffee…" },
  { min: 58, coin: "yolo", user: "rin_park", buy: 0.8, say: "tests are for people who doubt" },
  { min: 50, coin: "yolo", user: "sam_lee", buy: 0.4 },
  { min: 40, coin: "wifi", user: "sam_lee", buy: 0.1, say: "Wi-Fi still up at midnight. Checking again at 3." },
  { min: 35, coin: "yolo", user: "june_kim", buy: 0.6, say: "this is literally us" },
  { min: 24, coin: "why", user: "sam_lee", buy: 0.1 },
  { min: 20, coin: "coffee", user: "rin_park", buy: 0.05 },
  { min: 18, coin: "why", user: "yuki.eth", buy: 0.05, say: "count is at 3 already" },
  { min: 15, coin: "yolo", user: "0xHana", buy: 0.3 },
  { min: 12, coin: "coffee", user: "tokyo_bob", sellShare: 0.6 },
  { min: 10, coin: "coffee", user: "tokyo_bob", say: "They refilled the coffee at 10pm." },
  { min: 5, coin: "yolo", user: "sam_lee", say: "Still haven't written a test." },
  { min: 5, coin: "sleep", user: "june_kim", buy: 0.02, say: "Half the team is still awake at 4am." },
];

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
