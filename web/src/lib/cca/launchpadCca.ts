/**
 * Our Launchpad / LiquidityLocker surface on the CCA line.
 *
 * Names and arg order come from INTERFACE_CCA.md (PR #40 head 3e128b5)
 * where they are already specified. Items still marked TBD there stay
 * as `TBD(INTERFACE_CCA)` stubs — do not guess them.
 */
import type { Address } from "viem";
import { launchpadCcaAbi, lockerCcaAbi } from "./abi/launchpadCca";
import type { CcaWriteRequest } from "./writes";

export const INTERFACE_CCA_TBD = "TBD(INTERFACE_CCA)" as const;

export class InterfaceCcaPendingError extends Error {
  readonly code = INTERFACE_CCA_TBD;

  constructor(need: string) {
    super(`${INTERFACE_CCA_TBD}: ${need}`);
    this.name = "InterfaceCcaPendingError";
  }
}

/** `launchpad.auctionOf(token)` → `(auction, poolOpened)`. INTERFACE_CCA §4.2. */
export function auctionOfRead(launchpad: Address, token: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "auctionOf" as const,
    args: [token] as const,
  };
}

/**
 * The LBP initializer is the auction address from `auctionOf` / `Launched`.
 * INTERFACE_CCA §4.6.
 */
export function initializerFromAuction(auction: Address): Address {
  return auction;
}

/** `launchpad.hook()` — ProphecyHook in the pool key. INTERFACE_CCA §2. */
export function hookRead(launchpad: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "hook" as const,
    args: [] as const,
  };
}

/** `launchpad.locker()`. INTERFACE_CCA §2. */
export function lockerRead(launchpad: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "locker" as const,
    args: [] as const,
  };
}

/**
 * `launch(slug, prophecy, deadline)` — not payable, no first buy.
 * Returns `(token, auction)`. INTERFACE_CCA §2.
 */
export function launchCcaWrite(
  launchpad: Address,
  slug: string,
  prophecy: string,
  deadline: bigint,
): CcaWriteRequest {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "launch",
    args: [slug, prophecy, deadline],
  };
}

/** Anyone `collect(token)` on the locker. Prophet 24 : protocol 76. */
export function collectCcaWrite(locker: Address, token: Address): CcaWriteRequest {
  return {
    address: locker,
    abi: lockerCcaAbi,
    functionName: "collect",
    args: [token],
  };
}

/** Prophet later `withdrawAccrued()` if the ETH send in `collect` failed. */
export function withdrawAccruedWrite(locker: Address): CcaWriteRequest {
  return {
    address: locker,
    abi: lockerCcaAbi,
    functionName: "withdrawAccrued",
    args: [],
  };
}

/** TBD(INTERFACE_CCA) §10.1: salt derivation for `initializeDistribution`. */
export function initializeDistributionSalt(): never {
  throw new InterfaceCcaPendingError("salt derivation for initializeDistribution");
}

/**
 * TBD(INTERFACE_CCA) §10.12: how the locker binds a received `tokenId`
 * to `token` / `prophet`.
 */
export function lockerTokenIdBinding(): never {
  throw new InterfaceCcaPendingError("LiquidityLocker tokenId → token / prophet binding");
}

/**
 * TBD(INTERFACE_CCA) §10.13: PositionManager action bytes for a
 * fees-only collect (no liquidity decrease).
 */
export function lockerCollectActionBytes(): never {
  throw new InterfaceCcaPendingError("PositionManager fees-only collect action bytes");
}

/** TBD(INTERFACE_CCA) §10.11: Launchpad custom-error names such as LbpNotSet. */
export function backendLaunchErrorNames(): never {
  throw new InterfaceCcaPendingError("Launchpad custom-error names (LbpNotSet and the like)");
}

export const INTERFACE_CCA_PENDING = [
  "initializeDistribution salt",
  "Universal Router 2.1.2 V4_SWAP command + inputs encoding",
  "LiquidityLocker tokenId → token / prophet binding",
  "Launchpad custom-error names (LbpNotSet and the like)",
  "PositionManager fees-only collect action bytes",
  "reservedTokenAmountForLP",
] as const;
