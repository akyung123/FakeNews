/**
 * Place a CCA bid: budget ETH + max price per token (encoded as Q96).
 * Uses the 4-arg `submitBid` overload, which the contract implements as
 * `submitBid(..., FLOOR_PRICE_Q96, hookData)` (v2.1.0 ContinuousClearingAuction.sol).
 */
import { zeroAddress, type Address } from "viem";
import { ccaAbi } from "./abi/cca";
import { alignPriceToTick, budgetEthToAmount, ethPerTokenToQ96 } from "./price";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export type PlaceBidInput = {
  auction: Address;
  owner: Address;
  budgetEth: string;
  maxPricePerTokenEth: string;
  /** Auction `tickSpacing()` in Q96. When set, the max price is snapped to a valid tick. */
  tickSpacingQ96?: bigint;
  hookData?: Hex;
};

export function placeBidArgs(input: PlaceBidInput) {
  const amount = budgetEthToAmount(input.budgetEth);
  let maxPriceQ96 = ethPerTokenToQ96(input.maxPricePerTokenEth);
  if (input.tickSpacingQ96 !== undefined) {
    maxPriceQ96 = alignPriceToTick(maxPriceQ96, input.tickSpacingQ96);
  }
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
