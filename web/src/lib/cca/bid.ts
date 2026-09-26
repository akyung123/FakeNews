/**
 * Place a CCA bid: budget ETH + max price per token (encoded as Q96).
 * Uses the 4-arg `submitBid` overload, which the contract implements as
 * `submitBid(..., FLOOR_PRICE_Q96, hookData)` (v2.1.0 ContinuousClearingAuction.sol).
 *
 * Max price is always snapped DOWN onto `floor + k * tick` (PR #41).
 * A max price below the floor throws `MaxPriceBelowFloorError`.
 */
import { zeroAddress, type Address } from "viem";
import { ccaAbi } from "./abi/cca";
import { CCA_CONFIG } from "./config";
import { budgetEthToAmount, ethPerTokenToQ96, snapMaxPriceToTick } from "./price";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export type PlaceBidInput = {
  auction: Address;
  owner: Address;
  budgetEth: string;
  maxPricePerTokenEth: string;
  /** Override auction `floorPrice()` in Q96. Defaults to `CCA_CONFIG.floorPriceQ96`. */
  floorPriceQ96?: bigint;
  /** Override auction `tickSpacing()` in Q96. Defaults to `CCA_CONFIG.tickSpacingQ96`. */
  tickSpacingQ96?: bigint;
  hookData?: Hex;
};

export function placeBidArgs(input: PlaceBidInput) {
  const amount = budgetEthToAmount(input.budgetEth);
  const maxPriceQ96 = snapMaxPriceToTick(
    ethPerTokenToQ96(input.maxPricePerTokenEth),
    input.floorPriceQ96 ?? CCA_CONFIG.floorPriceQ96,
    input.tickSpacingQ96 ?? CCA_CONFIG.tickSpacingQ96,
  );
  const owner = input.owner;
  if (owner === zeroAddress) {
    throw new Error("bid owner cannot be the zero address");
  }
  return {
    maxPriceQ96,
    amount,
    owner,
    hookData: input.hookData ?? "0x",
  };
}

export function placeBidWrite(input: PlaceBidInput): CcaWriteRequest {
  const args = placeBidArgs(input);
  return {
    address: input.auction,
    abi: ccaAbi,
    functionName: "submitBid",
    args: [args.maxPriceQ96, args.amount, args.owner, args.hookData],
    value: args.amount,
  };
}

export async function placeBid(input: PlaceBidInput, options: CcaWriteOptions = {}): Promise<Hex> {
  return sendCcaWrite(placeBidWrite(input), "submitBid", options);
}
