/**
 * TBD(INTERFACE_CCA)
 *
 * Every call to our own contracts on the CCA line (Launchpad / ProphecyHook /
 * LiquidityLocker) lives in this file and nowhere else.
 *
 * `docs/INTERFACE.md` is the curve fallback. The CCA surface is defined by the
 * upcoming `docs/INTERFACE_CCA.md`. Until that file exists on main, do not
 * guess function names. Callers in this folder must go through these stubs.
 */
import type { Address } from "viem";

export const INTERFACE_CCA_TBD = "TBD(INTERFACE_CCA)" as const;

export class InterfaceCcaPendingError extends Error {
  readonly code = INTERFACE_CCA_TBD;

  constructor(need: string) {
    super(`${INTERFACE_CCA_TBD}: ${need}`);
    this.name = "InterfaceCcaPendingError";
  }
}

/** TBD(INTERFACE_CCA): how the UI finds the CCA auction for a prophecy token. */
export function auctionAddressForToken(_token: Address): Address {
  throw new InterfaceCcaPendingError("auction address for a prophecy token");
}

/** TBD(INTERFACE_CCA): how the UI finds the LBP initializer (usually the auction). */
export function initializerAddressForToken(_token: Address): Address {
  throw new InterfaceCcaPendingError("LBP initializer address for a prophecy token");
}

/** TBD(INTERFACE_CCA): post-migration v4 hook on our CCA line. */
export function poolHooksForToken(_token: Address): Address {
  throw new InterfaceCcaPendingError("v4 pool hooks for a prophecy token");
}

/** TBD(INTERFACE_CCA): issue / launch write on the CCA Launchpad. */
export function launchCcaWrite(): never {
  throw new InterfaceCcaPendingError("Launchpad launch on the CCA line");
}

/** TBD(INTERFACE_CCA): prophet fee collect on the CCA locker / launchpad. */
export function claimProphetFeeCcaWrite(): never {
  throw new InterfaceCcaPendingError("prophet fee claim on the CCA line");
}

export const INTERFACE_CCA_PENDING = [
  "auctionAddressForToken",
  "initializerAddressForToken",
  "poolHooksForToken",
  "launchCcaWrite",
  "claimProphetFeeCcaWrite",
  "goal-not-reached sub-line (copy.goalNotReachedSub)",
] as const;
