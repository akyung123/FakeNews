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
  worldHelp: "World ID is required only when you create a prophet name. One person, one name.",
  returning: "You already have a prophet name. World ID is not asked again.",
  prove: "Prove you are human",
  cancel: "Cancel verification",
  fail: "Simulate failure",
  launch: "Issue prophecy",
  disabledLaunch: "Verify with World ID to launch",
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
  return text.length >= 1 && text.length <= 140;
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

export function isLaunchEnabled(input: {
  returningProphet: boolean;
  worldStatus: WorldStatus;
  formValid: boolean;
}): boolean {
  if (!input.formValid) return false;
  if (input.returningProphet) return true;
  return input.worldStatus === "success";
}

export function launchButtonLabel(input: {
  returningProphet: boolean;
  worldStatus: WorldStatus;
  canLaunch: boolean;
}): string {
  if (input.canLaunch) return ISSUE_COPY.launch;
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
