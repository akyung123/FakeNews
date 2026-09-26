/**
 * Read interface for the prophet page (Screen 4).
 *
 * Today this is a mock. Later, swap the body of `getProphetPage` for:
 *   - prophet wallet: Universal Resolver getEnsAddress(name)
 *   - sentence / deadline: getEnsText(name, "prophecy" | "deadline")
 *   - token: getEnsAddress(slug.name.prophecy.eth)
 *   - curve + fees: Launchpad.curve(token) and creatorFeeOf(wallet) via viem
 *
 * Sentences must come through this module. Screen components never hardcode them.
 */
import { CURVE_SUPPLY as PROTOTYPE_CURVE_SUPPLY } from "./curve";
import { MOCK_PARENT_NAME, MOCK_PROPHETS, MOCK_PROPHECIES } from "./mock";
import { marketCap, type Coin } from "./store";

/** Curve supply from SPEC.md. Used only to turn `sold` into a 0–1 bar. */
const CURVE_SUPPLY = 793_100_000n * 10n ** 18n;

export type Address = `0x${string}`;

export type ProphetIdentity = {
  label: string;
  ensName: string;
  wallet: Address;
};

export type ProphetProphecy = {
  slug: string;
  ensName: string;
  sentence: string;
  deadline: number;
  departed: boolean;
  token: Address;
  sold: bigint;
  complete: boolean;
  /** 0–1 share of CURVE_SUPPLY already sold. 1 when graduated. */
  curveProgress: number;
};

export type ProphetPageData = {
  prophet: ProphetIdentity;
  prophecies: ProphetProphecy[];
  departedCount: number;
  claimableFeeWei: bigint;
};

export function prophetEnsName(label: string, parent = MOCK_PARENT_NAME): string {
  return `${label}.${parent}`;
}

export function prophecyEnsName(slug: string, label: string, parent = MOCK_PARENT_NAME): string {
  return `${slug}.${label}.${parent}`;
}

/** Screen 4 route: `/p/ringo` or `/p/ringo.prophecy.eth`. */
export function prophetPagePath(label: string): string {
  return `/p/${label}`;
}

/** Screen 3 (prophecy detail). Name-based so the token is found without pasting an address. */
export function prophecyDetailPath(ensName: string): string {
  return `/n/${ensName}`;
}

function decodeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed).toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Look up one prophecy by full ENS name or slug. */
export function getProphecyByName(name: string, nowSec = Math.floor(Date.now() / 1000)): ProphetProphecy | null {
  const key = decodeName(name);
  if (!key) return null;
  const row = MOCK_PROPHECIES.find((item) => {
    const ens = prophecyEnsName(item.slug, item.prophetLabel);
    return ens === key || item.slug === key;
  });
  if (!row) return null;
  return toProphetProphecy(row, nowSec);
}

/**
 * Prototype Screen 3 (`CoinPage`) still reads a localStorage coin.
 * Map a name from this read interface onto that shape so `/n/:name` is not blank.
 */
export function prototypeCoinFromName(name: string, nowSec?: number): Coin | null {
  const p = getProphecyByName(name, nowSec);
  if (!p) return null;
  const sold = p.complete ? PROTOTYPE_CURVE_SUPPLY : Number(p.sold / 10n ** 18n);
  const createdAt = (nowSec ?? Math.floor(Date.now() / 1000)) * 1000;
  const coin: Coin = {
    id: p.slug,
    name: p.ensName,
    ticker: p.slug.replace(/-/g, "").slice(0, 10).toUpperCase(),
    prophecy: p.sentence,
    creator: p.ensName.split(".").slice(1).join("."),
    createdAt,
    sold,
    ethRaised: p.complete ? 0.02 : sold > 0 ? 0.001 : 0,
    history: [],
  };
  coin.history = [
    { at: createdAt - 60_000, mcap: marketCap({ sold: 0, ethRaised: 0 }) },
    { at: createdAt, mcap: marketCap(coin) },
  ];
  return coin;
}

export function isDeparted(deadline: number, nowSec: number): boolean {
  return nowSec >= deadline;
}

/** Open rows buy; Departed (and later, held) rows sell. SPEC Screen 4. */
export function prophecyTradeLabel(row: { departed: boolean }): "Buy" | "Sell" {
  return row.departed ? "Sell" : "Buy";
}

export function curveProgress(sold: bigint, complete: boolean): number {
  if (complete || sold >= CURVE_SUPPLY) return 1;
  if (sold <= 0n) return 0;
  return Number((sold * 10_000n) / CURVE_SUPPLY) / 10_000;
}

/**
 * Accept `ringo` or `ringo.prophecy.eth` (any case).
 * Returns the prophet label, or null if the suffix does not match the parent.
 */
export function normalizeProphetLabel(input: string, parent = MOCK_PARENT_NAME): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === parent || trimmed.endsWith(`.${parent}`)) {
    const label = trimmed.slice(0, trimmed.length - (parent.length + 1));
    if (!label || label.includes(".")) return null;
    return label;
  }
  if (trimmed.includes(".")) return null;
  return trimmed;
}

/**
 * Load a prophet page. Mock implementation — replace with ENS + contract reads.
 */
export function getProphetPage(name: string, nowSec = Math.floor(Date.now() / 1000)): ProphetPageData | null {
  const label = normalizeProphetLabel(name);
  if (!label) return null;
  const prophet = MOCK_PROPHETS.find((p) => p.label === label);
  if (!prophet) return null;

  const prophecies = MOCK_PROPHECIES.filter((row) => row.prophetLabel === label)
    .map((row) => toProphetProphecy(row, nowSec))
    .sort(byDeadlineThenSlug);

  return {
    prophet: {
      label: prophet.label,
      ensName: prophetEnsName(prophet.label),
      wallet: prophet.wallet,
    },
    prophecies,
    departedCount: prophecies.filter((p) => p.departed).length,
    claimableFeeWei: prophet.claimableFeeWei,
  };
}

function toProphetProphecy(
  row: (typeof MOCK_PROPHECIES)[number],
  nowSec: number,
): ProphetProphecy {
  return {
    slug: row.slug,
    ensName: prophecyEnsName(row.slug, row.prophetLabel),
    sentence: row.sentence,
    deadline: row.deadline,
    departed: isDeparted(row.deadline, nowSec),
    token: row.token,
    sold: row.sold,
    complete: row.complete,
    curveProgress: curveProgress(row.sold, row.complete),
  };
}

function byDeadlineThenSlug(a: ProphetProphecy, b: ProphetProphecy): number {
  if (a.deadline !== b.deadline) return a.deadline - b.deadline;
  return a.slug.localeCompare(b.slug);
}
