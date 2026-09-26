import { MAX_PROPHECY_BYTES, isProphecyWithinLimit } from "./limits";
import { revertErrorName } from "./writeErrors";
import type { WorldErrorKind } from "./world";

export type WorldStatus = "idle" | "pending" | "success" | "cancelled" | "failed";

/**
 * Who is issuing. `wallet` is the address that signs `registerProphet` and
 * `launch`: the connected wallet in chain mode, a mock address only in mock mode.
 * `prophetLabel` is a known name (mock sessions only); in chain mode it stays
 * null and `prophetOf(wallet)` decides.
 */
export type IssueSession = {
  wallet: string;
  prophetLabel: string | null;
};

export const ISSUE_COPY = {
  title: "Issue a prophecy",
  lead: "Your prophecy opens with a short auction. Each block clears at a single price, then the market opens on Uniswap.",
  immutable:
    "This sentence is written once. Nobody can edit it after you issue it — not you, not us.",
  worldHelp: "World ID is required only when you create a prophet name. One human, one name.",
  returning: "You already have a prophet name. World ID is not asked again.",
  prove: "Prove you are human",
  cancel: "Cancel verification",
  fail: "Simulate failure",
  launch: "Launch prophecy",
  register: "Claim your name",
  disabledLaunch: "Verify with World ID to launch",
  pending: "Still checking. The first check can take up to a minute.",
  pendingSlow: "Taking longer than expected — the World server or the network may be slow right now.",
  retry: "Retry",
  registerPending: "Confirm your name in your wallet.",
  registerSuccess: "Your name is claimed on Sepolia.",
  launchNext: "Next: press Launch prophecy and sign once more in your wallet.",
  registerFailed: "Name claim failed. Nothing was charged except gas. Try again.",
  cancelled: "Verification cancelled. Launching stays locked until you verify.",
  portalRejected: "World ID couldn't confirm this check. Try again in World App.",
  checkFailed: "Something went wrong with the check. Please try again.",
  worldBlocked:
    "We can't reach the World server. If you use an ad blocker, turn it off for this site and try again.",
  nullifierReuse: "This human already has a prophet name. One human, one name.",
  step1: "Step 1 of 2",
  step2: "Step 2 of 2",
  launchStep1: "Step 1 · Claim your name",
  launchStep2: "Step 2 · Launch your prophecy",
  oneTransaction: "One transaction",
  claimTitle: "Claim your name",
  claimLead: "One name per person. World ID is asked only here.",
  continueIssue: "Continue to issue",
  connectWallet: "Connect your wallet first",
  connectWalletHelp: "Your name and prophecies belong to the wallet you connect. Use Connect wallet to continue.",
  connectingWallet: "Connecting your wallet…",
  checkingWallet: "Checking your wallet for a prophet name…",
  lookupFailed: "Couldn't check whether this wallet already has a name. Check your connection and try again.",
} as const;

/** Chain-mode input hints. Demo mode uses the sample placeholders in mock.ts. */
export const ISSUE_PLACEHOLDER = {
  prophecy: "One line, written once",
  prophetLabel: "yourname",
  slug: "short-name",
} as const;

const PROPHET_LABEL = /^[a-z0-9]{3,16}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function isValidProphetLabel(value: string): boolean {
  return PROPHET_LABEL.test(value);
}

export function isValidSlug(value: string): boolean {
  return SLUG.test(value);
}

export function isValidProphecy(value: string): boolean {
  return isProphecyWithinLimit(value.trim(), MAX_PROPHECY_BYTES);
}

export function isIssueFormValid(input: {
  prophetLabel: string;
  prophecy: string;
  slug: string;
}): boolean {
  return (
    isValidProphetLabel(input.prophetLabel) &&
    isValidProphecy(input.prophecy) &&
    isValidSlug(input.slug)
  );
}

export type RegisterStatus = "idle" | "pending" | "success" | "failed";

/** Wallet already has a name, or registerProphet just succeeded. */
export function isNamedProphet(input: {
  returningProphet: boolean;
  registerStatus?: RegisterStatus;
}): boolean {
  return input.returningProphet || input.registerStatus === "success";
}

/** Launch write — hidden until the wallet is a prophet (NotProphet). */
export function isLaunchEnabled(input: {
  returningProphet: boolean;
  worldStatus: WorldStatus;
  formValid: boolean;
  registerStatus?: RegisterStatus;
}): boolean {
  if (!input.formValid) return false;
  return isNamedProphet(input);
}

/** First-time name claim. Off once the wallet is already a prophet. */
export function isRegisterSubmitEnabled(input: {
  returningProphet: boolean;
  worldStatus: WorldStatus;
  formValid: boolean;
  registerStatus?: RegisterStatus;
}): boolean {
  if (!input.formValid) return false;
  if (isNamedProphet(input)) return false;
  return input.worldStatus === "success";
}

export function isIssueSubmitEnabled(input: {
  returningProphet: boolean;
  worldStatus: WorldStatus;
  formValid: boolean;
  registerStatus?: RegisterStatus;
}): boolean {
  return isLaunchEnabled(input) || isRegisterSubmitEnabled(input);
}

/** Step 1 claims the name (World + registerProphet); step 2 launches with the same inputs. */
export function launchButtonLabel(input: {
  returningProphet: boolean;
  worldStatus: WorldStatus;
  registerStatus?: RegisterStatus;
}): string {
  if (isNamedProphet(input)) return ISSUE_COPY.launch;
  if (input.worldStatus !== "success") return ISSUE_COPY.disabledLaunch;
  return ISSUE_COPY.register;
}

/** Designer copy only. Never returns a raw server or revert code. */
export function worldUserMessage(kind: WorldErrorKind | null | undefined): string | null {
  if (!kind) return null;
  if (kind === "blocked") return ISSUE_COPY.worldBlocked;
  if (kind === "cancelled") return ISSUE_COPY.cancelled;
  if (kind === "portal_rejected") return ISSUE_COPY.portalRejected;
  if (kind === "nullifier_reuse") return ISSUE_COPY.nullifierReuse;
  return ISSUE_COPY.checkFailed;
}

/** registerProphet / launch reverts the issue screen tells apart (Launchpad.sol custom errors). */
export const REGISTER_REVERT_NAMES = [
  "NullifierUsed",
  "AlreadyProphet",
  "LabelTaken",
  "InvalidSignature",
  "ProphetRecipient",
  "NotProphet",
  "BadLabel",
] as const;

export type RegisterRevertName = (typeof REGISTER_REVERT_NAMES)[number];

/** The decoded revert name, or null for anything else (a wallet rejection, a network error). */
export function registerRevertName(error: unknown): RegisterRevertName | null {
  const name = revertErrorName(error);
  return name && (REGISTER_REVERT_NAMES as readonly string[]).includes(name) ? (name as RegisterRevertName) : null;
}

export function worldErrorKindFromRegisterProphet(error: unknown): WorldErrorKind {
  return registerRevertName(error) === "NullifierUsed" ? "nullifier_reuse" : "network";
}

export function worldErrorMessage(status: WorldStatus, returningProphet: boolean): string | null {
  if (returningProphet) return null;
  if (status === "cancelled") return worldUserMessage("cancelled");
  if (status === "failed") return worldUserMessage("network");
  return null;
}

export function prophecyName(slug: string, prophetLabel: string, parentName: string): string {
  return `${slug}.${prophetLabel}.${parentName}`;
}

const PROPHET_STORAGE_KEY = "prophecy:prophet-label";

/** Stored value: `{ [lowercased wallet]: label }`. Anything else reads as empty. */
function readProphetLabelMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PROPHET_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: Record<string, string> = {};
    for (const [wallet, label] of Object.entries(parsed)) {
      if (typeof label === "string" && label) map[wallet] = label;
    }
    return map;
  } catch {
    return {};
  }
}

/** Name this browser saw claimed by `wallet`. Mock mode uses it in place of `prophetOf`. */
export function readStoredProphetLabel(wallet: string): string | null {
  if (!wallet) return null;
  return readProphetLabelMap()[wallet.toLowerCase()] ?? null;
}

export function storeProphetLabel(wallet: string, label: string): void {
  if (!wallet || !label) return;
  try {
    const map = readProphetLabelMap();
    map[wallet.toLowerCase()] = label;
    localStorage.setItem(PROPHET_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // storage blocked
  }
}

export type LaunchDraft = {
  prophetLabel: string;
  prophecy: string;
  slug: string;
};

const DRAFT_STORAGE_KEY = "prophecy:launch-draft";

/** What the Launch form held before a reload. Cleared once the prophecy is launched. */
export function readLaunchDraft(): LaunchDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Record<keyof LaunchDraft, unknown>>;
    const text = (v: unknown) => (typeof v === "string" ? v : "");
    return { prophetLabel: text(value.prophetLabel), prophecy: text(value.prophecy), slug: text(value.slug) };
  } catch {
    return null;
  }
}

export function storeLaunchDraft(draft: LaunchDraft): void {
  try {
    if (!draft.prophetLabel && !draft.prophecy && !draft.slug) {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // storage blocked
  }
}

export function clearLaunchDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // storage blocked
  }
}
