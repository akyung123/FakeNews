/**
 * Read interface for the prophet page (Screen 4).
 *
 * Today this is a mock. Live reads (when `VITE_UNIVERSAL_RESOLVER` is set):
 *   - prophet wallet: getEnsAddress(name)
 *   - sentence: getEnsText(name, "prophecy")
 *   - token: getEnsAddress(slug.name.prophecy.eth)
 *   - curve + fees: Launchpad.curve(token) and creatorFeeOf(wallet) via viem
 *
 * Sentences come through the ENS text helpers. Screens never hardcode them.
 */
import { CURVE_SUPPLY as PROTOTYPE_CURVE_SUPPLY } from "./curve";
import { mockEnsAddress, mockEnsText, ENS_TEXT_PROPHECY } from "./ens";
import { isMockMode } from "./mode";
import { GRADUATION_ETH, MOCK_PARENT_NAME, MOCK_PROPHETS, MOCK_PROPHECIES } from "./mock";
import { slugOf } from "./ensName";
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
  token: Address;
  sold: bigint;
  complete: boolean;
  /** 0–1 share of CURVE_SUPPLY already sold. 1 when graduated. */
  curveProgress: number;
  /** CCA auction from the Launched log. Chain rows only. */
  auction?: Address;
  /** Block of the Launched log. Chain rows only. */
  launchedBlock?: number;
};

export type ProphetPageData = {
  prophet: ProphetIdentity;
  prophecies: ProphetProphecy[];
  claimableFeeWei: bigint;
  /** Set when the page came from prophetOf / creatorFeeOf, not MOCK_PROPHETS. */
  fromChain?: boolean;
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
export function getProphecyByName(name: string): ProphetProphecy | null {
  const key = decodeName(name);
  if (!key) return null;
  const row = MOCK_PROPHECIES.find((item) => {
    const ens = prophecyEnsName(item.slug, item.prophetLabel);
    return ens === key || item.slug === key;
  });
  if (!row) return null;
  return toProphetProphecy(row);
}

/**
 * Mock-mode Screen 3 only. Chain mode reads Launched + curve(token).
 */
export function prototypeCoinFromName(
  name: string,
  nowSec?: number,
  options?: { mock?: boolean },
): Coin | null {
  const mock = options?.mock ?? isMockMode();
  if (!mock) return null;
  const p = getProphecyByName(name);
  if (!p) return null;
  const sold = p.complete ? PROTOTYPE_CURVE_SUPPLY : Number(p.sold / 10n ** 18n);
  const createdAt = (nowSec ?? Math.floor(Date.now() / 1000)) * 1000;
  const coin: Coin = {
    id: p.slug,
    name: p.ensName,
    ticker: p.slug.toUpperCase().slice(0, 11),
    prophecy: p.sentence,
    creator: p.ensName.split(".").slice(1).join("."),
    createdAt,
    sold,
    ethRaised: p.complete ? GRADUATION_ETH : sold > 0 ? 0.001 : 0,
    history: [],
    token: p.token,
    complete: p.complete,
  };
  coin.history = [
    { at: createdAt - 60_000, mcap: marketCap({ sold: 0, ethRaised: 0 }) },
    { at: createdAt, mcap: marketCap(coin) },
  ];
  return coin;
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

export function prophetPageFromChain(input: {
  label: string;
  wallet: Address;
  claimableFeeWei: bigint;
  prophecies?: ProphetProphecy[];
  parentName?: string;
}): ProphetPageData {
  const prophecies = input.prophecies ?? [];
  return {
    prophet: {
      label: input.label,
      ensName: prophetEnsName(input.label, input.parentName),
      wallet: input.wallet,
    },
    prophecies,
    claimableFeeWei: input.claimableFeeWei,
    fromChain: true,
  };
}

/** Mock seed prophets (ringo / mina) — never a claimCreatorFee target in chain mode. */
export function isMockProphetRecord(data: Pick<ProphetPageData, "fromChain" | "prophet">): boolean {
  if (data.fromChain) return false;
  const label = data.prophet.label.toLowerCase();
  const wallet = data.prophet.wallet.toLowerCase();
  return MOCK_PROPHETS.some((row) => row.label === label || row.wallet.toLowerCase() === wallet);
}

/** Chain mode hides claim on mock rows; a live own page still sends claimCreatorFee. */
export function canClaimCreatorFee(
  data: Pick<ProphetPageData, "fromChain" | "prophet">,
  options: { chain?: boolean; claimFee?: unknown } = {},
): boolean {
  if (options.claimFee) return true;
  if (!options.chain) return true;
  return !isMockProphetRecord(data);
}

/**
 * Load a prophet page. Mock implementation — replace with ENS + contract reads.
 */
export function getProphetPage(name: string): ProphetPageData | null {
  const label = normalizeProphetLabel(name);
  if (!label) return null;
  const prophet = MOCK_PROPHETS.find((p) => p.label === label);
  if (!prophet) return null;

  const prophecies = MOCK_PROPHECIES.filter((row) => row.prophetLabel === label)
    .map(toProphetProphecy)
    .sort(bySlug);

  return {
    prophet: {
      label: prophet.label,
      ensName: prophetEnsName(prophet.label),
      wallet: prophet.wallet,
    },
    prophecies,
    claimableFeeWei: prophet.claimableFeeWei,
  };
}

function toProphetProphecy(row: (typeof MOCK_PROPHECIES)[number]): ProphetProphecy {
  const ensName = prophecyEnsName(row.slug, row.prophetLabel);
  const sentence = mockEnsText(ensName, ENS_TEXT_PROPHECY) ?? row.sentence;
  const token = mockEnsAddress(ensName) ?? row.token;
  return {
    slug: row.slug,
    ensName,
    sentence,
    token,
    sold: row.sold,
    complete: row.complete,
    curveProgress: curveProgress(row.sold, row.complete),
  };
}

function bySlug(a: ProphetProphecy, b: ProphetProphecy): number {
  return a.slug.localeCompare(b.slug);
}

/** A Launched-log coin (launched.ts) as a prophet-page row. Sentence comes from ENS, never the log. */
export function prophecyFromCoin(coin: Coin): ProphetProphecy | null {
  const token = coin.token;
  if (!token) return null;
  return {
    slug: slugOf(coin.name) || coin.ticker.toLowerCase(),
    ensName: coin.name,
    sentence: coin.prophecy,
    token,
    sold: 0n,
    complete: Boolean(coin.complete),
    curveProgress: coin.complete ? 1 : 0,
    auction: coin.auction,
    launchedBlock: coin.launchedBlock,
  };
}

/** Chain rows for one prophet label, newest launch first. */
export function prophetProphecies(label: string, coins: readonly Coin[]): ProphetProphecy[] {
  const key = label.toLowerCase();
  const out: ProphetProphecy[] = [];
  for (const coin of coins) {
    if (!coin.fromChain || coin.creator.toLowerCase() !== key) continue;
    const row = prophecyFromCoin(coin);
    if (row) out.push(row);
  }
  return out.sort(byNewest);
}

function mockOrder(row: ProphetProphecy): number {
  return MOCK_PROPHECIES.findIndex((item) => item.token.toLowerCase() === row.token.toLowerCase());
}

function byNewest(a: ProphetProphecy, b: ProphetProphecy): number {
  const rank = (row: ProphetProphecy) => row.launchedBlock ?? mockOrder(row);
  return rank(b) - rank(a);
}

/** Newest launch first: Launched block on chain, sample record order in demo mode. */
export function newestFirst(rows: readonly ProphetProphecy[]): ProphetProphecy[] {
  return [...rows].sort(byNewest);
}

/** Most recent prophecy: highest Launched block on chain, last sample record in demo mode. */
export function latestProphecy(rows: readonly ProphetProphecy[]): ProphetProphecy | null {
  return newestFirst(rows)[0] ?? null;
}
