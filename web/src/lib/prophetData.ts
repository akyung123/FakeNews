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
import { MOCK_PARENT_NAME, MOCK_PROPHETS, MOCK_PROPHECIES } from "./mock";

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

export function isDeparted(deadline: number, nowSec: number): boolean {
  return nowSec >= deadline;
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
