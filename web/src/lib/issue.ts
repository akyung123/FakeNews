import { MAX_PROPHECY_BYTES, isProphecyWithinLimit } from "./limits";
import type { WorldErrorKind } from "./world";

export type WorldStatus = "idle" | "pending" | "success" | "cancelled" | "failed";

export type IssueSession = {
  wallet: string;
  prophetLabel: string | null;
};

export const ISSUE_COPY = {
  title: "Issue a prophecy",
  lead: "Write one sentence. It becomes a token. Buying raises the price and selling lowers it.",
  immutable:
    "This sentence is written once. Nobody can edit it after you issue it — not you, not us.",
  worldHelp: "World ID is required only when you create a prophet name. One human, one name.",
  returning: "You already have a prophet name. World ID is not asked again.",
  prove: "Prove you are human",
  cancel: "Cancel verification",
  fail: "Simulate failure",
  launch: "Issue prophecy",
  disabledLaunch: "Verify with World ID to launch",
  pending: "Still checking. This can take a minute the first time.",
  registerPending: "Confirm your name in your wallet.",
  registerSuccess: "Your name is claimed on Sepolia.",
  registerFailed: "Name claim failed. Nothing was charged except gas. Try again.",
  cancelled: "Verification cancelled. Launching stays locked until you verify.",
  portalRejected: "World ID couldn't confirm this check. Try again in World App.",
  checkFailed: "Something went wrong with the check. Please try again.",
  nullifierReuse: "This human already has a prophet name. One human, one name.",
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
  const text = value.trim();
  return text.length >= 1 && text.length <= 140 && isProphecyWithinLimit(text, MAX_PROPHECY_BYTES);
}

export function isValidDeadline(unixSeconds: number, nowSeconds: number): boolean {
  return Number.isInteger(unixSeconds) && unixSeconds > nowSeconds;
}

export function isValidFirstBuy(value: string): boolean {
  if (value.trim() === "") return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function isIssueFormValid(input: {
  prophetLabel: string;
  prophecy: string;
  slug: string;
  deadlineUnix: number;
  firstBuy: string;
  nowSeconds: number;
}): boolean {
  return (
    isValidProphetLabel(input.prophetLabel) &&
    isValidProphecy(input.prophecy) &&
    isValidSlug(input.slug) &&
    isValidDeadline(input.deadlineUnix, input.nowSeconds) &&
    isValidFirstBuy(input.firstBuy)
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

export function launchButtonLabel(input: {
  returningProphet: boolean;
  worldStatus: WorldStatus;
  canLaunch: boolean;
  canRegister?: boolean;
}): string {
  if (input.canLaunch || input.canRegister) return ISSUE_COPY.launch;
  if (!input.returningProphet && input.worldStatus !== "success") return ISSUE_COPY.disabledLaunch;
  return ISSUE_COPY.launch;
}

/** Designer copy only. Never returns a raw server or revert code. */
export function worldUserMessage(kind: WorldErrorKind | null | undefined): string | null {
  if (!kind) return null;
  if (kind === "cancelled") return ISSUE_COPY.cancelled;
  if (kind === "portal_rejected") return ISSUE_COPY.portalRejected;
  if (kind === "nullifier_reuse") return ISSUE_COPY.nullifierReuse;
  return ISSUE_COPY.checkFailed;
}

export function worldErrorKindFromRegisterProphet(error: unknown): WorldErrorKind {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/nullifier/i.test(text)) return "nullifier_reuse";
  return "network";
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

export function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): number {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

const PROPHET_STORAGE_KEY = "prophecy:prophet-label";

export function readStoredProphetLabel(): string | null {
  try {
    return sessionStorage.getItem(PROPHET_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeProphetLabel(label: string): void {
  try {
    sessionStorage.setItem(PROPHET_STORAGE_KEY, label);
  } catch {
    // storage blocked
  }
}
