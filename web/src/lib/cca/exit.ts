/**
 * Exit a bid / refund unused ETH.
 * `exitBid` — after the auction ends; full refund if the goal was not reached.
 * `exitPartiallyFilledBid` — bids that sat at the clearing price (needs checkpoint hints).
 * Verified: IContinuousClearingAuction v2.1.0.
 */
import type { Address } from "viem";
import { ccaAbi } from "./abi/cca";
import { sendCcaWrite, type CcaWriteOptions, type CcaWriteRequest } from "./writes";
import type { Hex } from "../world";

export function exitBidWrite(auction: Address, bidId: bigint): CcaWriteRequest {
  return {
    address: auction,
    abi: ccaAbi,
    functionName: "exitBid",
    args: [bidId],
  };
}

export function exitPartiallyFilledBidWrite(
  auction: Address,
  bidId: bigint,
  lastFullyFilledCheckpointBlock: bigint,
  outbidBlock: bigint,
): CcaWriteRequest {
  return {
    address: auction,
    abi: ccaAbi,
    functionName: "exitPartiallyFilledBid",
    args: [bidId, lastFullyFilledCheckpointBlock, outbidBlock],
  };
}

export async function exitBid(auction: Address, bidId: bigint, options: CcaWriteOptions = {}): Promise<Hex> {
  return sendCcaWrite(exitBidWrite(auction, bidId), "exitBid", options);
}

export async function exitPartiallyFilledBid(
  auction: Address,
  bidId: bigint,
  lastFullyFilledCheckpointBlock: bigint,
  outbidBlock: bigint,
  options: CcaWriteOptions = {},
): Promise<Hex> {
  return sendCcaWrite(
    exitPartiallyFilledBidWrite(auction, bidId, lastFullyFilledCheckpointBlock, outbidBlock),
    "exitPartiallyFilledBid",
    options,
  );
}
