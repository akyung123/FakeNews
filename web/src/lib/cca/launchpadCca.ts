/**
 * Our Launchpad / LiquidityLocker surface on the CCA line.
 * Names and arg order come from INTERFACE_CCA.md PR #44 and PR #42 `b71c64e`
 * (backend: that interface is frozen; only floor/tick values and tests change).
 */
import type { Address, Hex } from "viem";
import { encodePacked } from "viem";
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

/** `launchpad.auctionOf(token)` → auction address. No poolOpened flag. */
export function auctionOfRead(launchpad: Address, token: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "auctionOf" as const,
    args: [token] as const,
  };
}

export function isGraduatedRead(launchpad: Address, token: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "isGraduated" as const,
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

/** `launchpad.hook()` — ProphecyHook in the pool key. */
export function hookRead(launchpad: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "hook" as const,
    args: [] as const,
  };
}

/** `launchpad.locker()`. */
export function lockerRead(launchpad: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "locker" as const,
    args: [] as const,
  };
}

export function lbpStrategyRead(launchpad: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "lbpStrategy" as const,
    args: [] as const,
  };
}

export function positionManagerRead(launchpad: Address) {
  return {
    address: launchpad,
    abi: launchpadCcaAbi,
    functionName: "positionManager" as const,
    args: [] as const,
  };
}

/**
 * `launch(slug, prophecy, deadline)` — not payable, no first buy.
 * Returns the token only — read auction from Launched or auctionOf.
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

/** Frontend must not pass a salt. Launchpad computes it on-chain. */
export function initializeDistributionSalt(): never {
  throw new InterfaceCcaPendingError("frontend must not pass a salt");
}

/** Binding after migrate: anyone `register(token, tokenId)`. */
export function lockerTokenIdBinding(): { functionName: "register"; args: ["token", "tokenId"] } {
  return { functionName: "register", args: ["token", "tokenId"] };
}

/** Fees-only collect: DECREASE_LIQUIDITY 0x01 then TAKE_PAIR 0x11, liquidity 0. */
export function lockerCollectActionBytes(): Hex {
  return encodePacked(["uint8", "uint8"], [0x01, 0x11]);
}

/** Launchpad custom-error names from PR #42. */
export function backendLaunchErrorNames(): readonly string[] {
  return [
    "CcaNotSet",
    "CcaAlreadySet",
    "AuctionExists",
    "AuctionNotCreated",
    "InvalidHook",
    "BadAuctionBlocks",
    "ProphetRecipient",
  ] as const;
}

export const INTERFACE_CCA_PENDING = [
  "floor / tick Q96 pending #42 recalculation",
  "Universal Router 2.1.2 calldata not live-verified on Sepolia",
] as const;
