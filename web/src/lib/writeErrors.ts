import { UserRejectedRequestError } from "viem";

/**
 * Banner copy for Launchpad custom errors the UI maps.
 * Names match contracts/src/Launchpad.sol (and launchpadAbi).
 * INTERFACE §2 did not list these until this PR; other on-chain errors stay generic.
 */
export const WRITE_REVERT_COPY = {
  NullifierUsed: "This World ID already has a name.",
  LabelTaken: "That name is taken. Try another.",
  AlreadyProphet: "This wallet already has a name.",
  SlugTaken: "That token name is taken. Try another.",
  Slippage: "Price moved. Try again.",
  CurveComplete: "This token has graduated. Trade on Uniswap.",
  InvalidSignature: "The human check doesn't match this wallet. Verify with World ID again.",
  ProphetRecipient: "This wallet receives protocol fees and can't launch.",
  NotProphet: "Claim your name before you launch.",
  BadLabel: "That name can't be used. Use 3–16 characters, a–z and 0–9.",
  BadSlug: "That short name can't be used. Use a–z, 0–9 and hyphens.",
  BadProphecy: "The prophecy is empty or too long.",
} as const;

export type MappedRevertName = keyof typeof WRITE_REVERT_COPY;

/** Launchpad errors that keep the generic write banner. No extra designer sentence. */
export const GENERIC_REVERT_NAMES = ["ZeroAmount"] as const;

export function isGenericRevertName(name: string): boolean {
  return (GENERIC_REVERT_NAMES as readonly string[]).includes(name);
}

export type ClassifiedWriteError =
  | { kind: "rejected" }
  | { kind: "revert"; name: MappedRevertName; message: string }
  | { kind: "unknown" };

function walkCauseChain(error: unknown): object[] {
  const seen = new Set<object>();
  const nodes: object[] = [];
  let current: unknown = error;
  while (current != null && (typeof current === "object" || typeof current === "function")) {
    const node = current as object;
    if (seen.has(node)) break;
    seen.add(node);
    nodes.push(node);
    current = "cause" in node ? (node as { cause: unknown }).cause : undefined;
  }
  return nodes;
}

function isUserRejected(node: object): boolean {
  if (node instanceof UserRejectedRequestError) return true;
  const rec = node as { name?: unknown; code?: unknown };
  if (rec.name === "UserRejectedRequestError") return true;
  return rec.code === 4001 || rec.code === "4001";
}

function revertName(node: object): string | undefined {
  const data = (node as { data?: { errorName?: unknown } }).data;
  if (data && typeof data === "object" && typeof data.errorName === "string" && data.errorName) {
    return data.errorName;
  }
  return undefined;
}

/**
 * The custom error name viem decoded from a revert (`ContractFunctionRevertedError.data.errorName`),
 * anywhere in the cause chain. Never guessed from message text.
 */
export function revertErrorName(error: unknown): string | undefined {
  for (const node of walkCauseChain(error)) {
    const name = revertName(node);
    if (name) return name;
  }
  return undefined;
}

/** Shared by registerProphet, launch, buy, sell, and claimCreatorFee. */
export function classifyWriteError(error: unknown): ClassifiedWriteError {
  const nodes = walkCauseChain(error);
  for (const node of nodes) {
    if (isUserRejected(node)) return { kind: "rejected" };
  }
  for (const node of nodes) {
    const name = revertName(node);
    if (!name) continue;
    if (name in WRITE_REVERT_COPY) {
      const mapped = name as MappedRevertName;
      return { kind: "revert", name: mapped, message: WRITE_REVERT_COPY[mapped] };
    }
    if (isGenericRevertName(name)) return { kind: "unknown" };
    return { kind: "unknown" };
  }
  return { kind: "unknown" };
}
