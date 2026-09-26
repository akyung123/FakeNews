/**
 * Place a CCA bid: budget ETH + max price per token (encoded as Q96).
 * INTERFACE_CCA §4.4 / §8: use the 5-arg `submitBid`. Do not use the
 * 4-arg overload in the demo (it scans from the floor).
 *
 * `maxPrice = floor + n * tick` (snapped DOWN).
 * `prevTick = floor + (n - 1) * tick` (floor itself when n = 0).
 * A max price below the floor throws `MaxPriceBelowFloorError`.
 */
import { zeroAddress, type Address } from "viem";
import { ccaAbi } from "./abi/cca";
import { CCA_CONFIG } from "./config";
import { budgetEthToAmount, ethPerTokenToQ96, prevTickHintQ96, snapMaxPriceToTick } from "./price";
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
  const floor = input.floorPriceQ96 ?? CCA_CONFIG.floorPriceQ96;
  const tick = input.tickSpacingQ96 ?? CCA_CONFIG.tickSpacingQ96;
  const amount = budgetEthToAmount(input.budgetEth);
  const maxPriceQ96 = snapMaxPriceToTick(ethPerTokenToQ96(input.maxPricePerTokenEth), floor, tick);
  const owner = input.owner;
  if (owner === zeroAddress) {
    throw new Error("bid owner cannot be the zero address");
  }
  return {
    maxPriceQ96,
    amount,
    owner,
    prevTickPriceQ96: prevTickHintQ96(maxPriceQ96, floor, tick),
    hookData: input.hookData ?? "0x",
  };
}

export function placeBidWrite(input: PlaceBidInput): CcaWriteRequest {
  const args = placeBidArgs(input);
  return {
    address: input.auction,
    abi: ccaAbi,
    functionName: "submitBid",
    args: [args.maxPriceQ96, args.amount, args.owner, args.prevTickPriceQ96, args.hookData],
    value: args.amount,
  };
}

export async function placeBid(input: PlaceBidInput, options: CcaWriteOptions = {}): Promise<Hex> {
  return sendCcaWrite(placeBidWrite(input), "submitBid", options);
}
